/* Thermalsock Labs — KeyStep Pro step editor.
 *
 * The point of this file is lock-and-reroll. A generator that can only replace
 * everything is a slot machine: when fourteen of sixteen steps are right, your
 * options are to accept two wrong notes or lose the fourteen. Locking says
 * "these are settled, argue about the rest", which is the difference between
 * a toy and an instrument.
 *
 * Everything here mutates a pattern in place and reports it. Nothing draws,
 * nothing knows about the DOM, and no edit is applied without first pushing
 * the previous state onto the undo stack — an edit you cannot take back is an
 * edit you hesitate before making.
 *
 * window.KSPEdit
 */
(function () {
  'use strict';

  var G = window.KSPGen;
  var HISTORY = 60;

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function create(opts) {
    opts = opts || {};
    var getPattern = opts.getPattern;
    var onChange = opts.onChange || function () {};

    var sel = -1;
    var locks = {};              /* index -> true */
    var undoStack = [], redoStack = [];

    function pattern() { return getPattern(); }

    function snapshot() {
      var p = pattern();
      if (!p) return;
      undoStack.push({ steps: clone(p.steps), locks: clone(locks) });
      if (undoStack.length > HISTORY) undoStack.shift();
      redoStack.length = 0;
    }

    function changed(kind) {
      var p = pattern();
      if (p) refreshMeta(p);
      onChange(kind || 'edit');
    }

    /* Range and note count are shown in the header and drive the injection
       warnings, so they have to follow the edits rather than describe the
       pattern as it was generated. */
    function refreshMeta(p) {
      var used = [];
      p.steps.forEach(function (s) {
        if (!s.rest && s.notes) s.notes.forEach(function (n) { used.push(n); });
      });
      p.meta.onsetCount = p.steps.filter(function (s) { return !s.rest; }).length;
      if (used.length) {
        p.meta.low = Math.min.apply(null, used);
        p.meta.high = Math.max.apply(null, used);
        p.meta.lowName = G.noteName(p.meta.low);
        p.meta.highName = G.noteName(p.meta.high);
      }
      p.meta.edited = true;
    }

    function step(i) {
      var p = pattern();
      return p && p.steps[i] ? p.steps[i] : null;
    }

    /* ---------- selection ---------- */

    function select(i) {
      var p = pattern();
      if (!p) return;
      sel = (i === null || i === undefined || i < 0 || i >= p.steps.length) ? -1 : i;
      onChange('select');
    }
    function move(delta) {
      var p = pattern();
      if (!p) return;
      if (sel < 0) { select(0); return; }
      select(Math.max(0, Math.min(p.steps.length - 1, sel + delta)));
    }

    /* ---------- pitch ---------- */

    /* Nudging by scale degree keeps edits inside the key, which is what you
       want nine times out of ten. Chromatic is there for the tenth. */
    function nudgePitch(degrees, chromatic) {
      var s = step(sel);
      if (!s || s.rest) return;
      snapshot();
      var m = pattern().meta;
      if (!chromatic && s.degree !== undefined && m.scalePcs && m.rootMidi !== undefined) {
        var before = G.degreeToMidi(s.degree, m.scalePcs, m.rootMidi);
        s.degree += degrees;
        var after = G.degreeToMidi(s.degree, m.scalePcs, m.rootMidi);
        var shift = after - before;
        s.notes = s.notes.map(function (n) { return clampNote(n + shift); });
      } else {
        s.notes = s.notes.map(function (n) { return clampNote(n + degrees); });
      }
      changed();
    }
    function nudgeOctave(dir) {
      var s = step(sel);
      if (!s || s.rest) return;
      snapshot();
      var m = pattern().meta, len = (m.scalePcs && m.scalePcs.length) || 7;
      if (s.degree !== undefined) s.degree += dir * len;
      s.notes = s.notes.map(function (n) { return clampNote(n + dir * 12); });
      changed();
    }
    function clampNote(n) { return Math.max(0, Math.min(127, n)); }

    /* ---------- the rest of a step ---------- */

    function setVelocity(v) {
      var s = step(sel);
      if (!s || s.rest) return;
      snapshot();
      s.vel = Math.max(1, Math.min(127, Math.round(v)));
      s.accent = s.vel > 100;
      changed();
    }
    function setGate(g) {
      var s = step(sel);
      if (!s || s.rest) return;
      snapshot();
      s.gate = Math.max(0.05, Math.min(1.9, g));
      changed();
    }
    function setRatchet(n) {
      var s = step(sel);
      if (!s || s.rest) return;
      snapshot();
      s.ratchet = Math.max(1, Math.min(8, Math.round(n)));
      changed();
    }
    function setShift(v) {
      var s = step(sel);
      if (!s || s.rest) return;
      snapshot();
      s.shift = Math.max(-0.49, Math.min(0.49, v));
      changed();
    }
    function toggleTie() {
      var s = step(sel);
      if (!s || s.rest) return;
      snapshot();
      s.tie = !s.tie;
      changed();
    }

    /* A rest remembers what it was, so toggling twice gets the note back
       rather than inventing a new one. */
    function toggleRest() {
      var p = pattern(), s = step(sel);
      if (!p || !s) return;
      snapshot();
      if (s.rest) {
        p.steps[sel] = s.wasNote || makeNote(p, sel);
      } else {
        p.steps[sel] = { rest: true, wasNote: clone(s) };
      }
      changed();
    }

    /* A note conjured for an empty step takes its pitch from its neighbours,
       so filling a gap does not drop something unrelated into the middle. */
    function makeNote(p, i) {
      var near = null;
      for (var d = 1; d < p.steps.length; d++) {
        var a = p.steps[i - d], b = p.steps[i + d];
        if (a && !a.rest) { near = a; break; }
        if (b && !b.rest) { near = b; break; }
      }
      if (!near) {
        var rm = p.meta.rootMidi || 60;
        return { rest: false, notes: [rm], degree: 0, vel: 90, gate: 0.5, tie: false, accent: false };
      }
      var s = clone(near);
      delete s.wasNote;
      s.vel = Math.max(30, s.vel - 6);
      return s;
    }

    function addNote(interval) {
      var s = step(sel);
      if (!s || s.rest) return;
      snapshot();
      var top = Math.max.apply(null, s.notes);
      var m = pattern().meta;
      var add = top + (interval || 4);
      if (s.degree !== undefined && m.scalePcs) {
        /* Stack the next third above whatever is already there. Deriving it
           from the note count rather than from the top note stops the second
           addition landing an octave out. */
        add = G.degreeToMidi(s.degree + 2 * s.notes.length, m.scalePcs, m.rootMidi);
        var floorNote = Math.min.apply(null, s.notes);
        while (add <= top) add += 12;
        while (add - floorNote > 24) add -= 12;
      }
      if (s.notes.indexOf(add) === -1 && s.notes.length < 6) s.notes.push(clampNote(add));
      changed();
    }
    function removeNote() {
      var s = step(sel);
      if (!s || s.rest || s.notes.length < 2) return;
      snapshot();
      s.notes.pop();
      changed();
    }

    /* ---------- locks ---------- */

    function toggleLock(i) {
      var idx = i === undefined ? sel : i;
      if (idx < 0) return;
      if (locks[idx]) delete locks[idx]; else locks[idx] = true;
      onChange('lock');
    }
    function isLocked(i) { return !!locks[i]; }
    function lockedIndices() {
      return Object.keys(locks).map(Number).sort(function (a, b) { return a - b; });
    }
    function lockAll() {
      var p = pattern();
      if (!p) return;
      p.steps.forEach(function (s, i) { if (!s.rest) locks[i] = true; });
      onChange('lock');
    }
    function clearLocks() { locks = {}; onChange('lock'); }
    function lockCount() { return Object.keys(locks).length; }

    /* Reroll: take a freshly generated pattern and put the locked steps back.
       Straightforward and predictable, which matters more here than clever —
       you should be able to look at a locked step and know it did not move. */
    function applyLocks(fresh, previous) {
      if (!previous) return fresh;
      lockedIndices().forEach(function (i) {
        if (previous.steps[i] && fresh.steps[i] !== undefined) {
          fresh.steps[i] = clone(previous.steps[i]);
        }
      });
      refreshMeta(fresh);
      return fresh;
    }

    /* ---------- history ---------- */

    function undo() {
      var p = pattern();
      if (!p || !undoStack.length) return false;
      redoStack.push({ steps: clone(p.steps), locks: clone(locks) });
      var prev = undoStack.pop();
      p.steps = prev.steps; locks = prev.locks;
      refreshMeta(p);
      onChange('undo');
      return true;
    }
    function redo() {
      var p = pattern();
      if (!p || !redoStack.length) return false;
      undoStack.push({ steps: clone(p.steps), locks: clone(locks) });
      var next = redoStack.pop();
      p.steps = next.steps; locks = next.locks;
      refreshMeta(p);
      onChange('redo');
      return true;
    }
    function reset() {
      sel = -1; locks = {}; undoStack.length = 0; redoStack.length = 0;
    }

    return {
      select: select, selected: function () { return sel; }, move: move,
      nudgePitch: nudgePitch, nudgeOctave: nudgeOctave,
      setVelocity: setVelocity, setGate: setGate, setRatchet: setRatchet,
      setShift: setShift, toggleTie: toggleTie, toggleRest: toggleRest,
      addNote: addNote, removeNote: removeNote,
      toggleLock: toggleLock, isLocked: isLocked, lockAll: lockAll,
      clearLocks: clearLocks, lockCount: lockCount, lockedIndices: lockedIndices,
      applyLocks: applyLocks,
      undo: undo, redo: redo, reset: reset,
      canUndo: function () { return undoStack.length > 0; },
      canRedo: function () { return redoStack.length > 0; },
      snapshot: snapshot
    };
  }

  window.KSPEdit = { create: create };
})();
