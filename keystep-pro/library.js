/* Thermalsock Labs — KeyStep Pro pattern library.
 *
 * Saves the steps, not just the recipe.
 *
 * That is a deliberate choice and it costs a little space. A pattern is fully
 * reproducible from its seed and settings, so storing eight numbers would be
 * enough — today. But the generator keeps changing: every time a weighting is
 * tuned or a relation fixed, the same seed produces something slightly
 * different. A library of recipes would quietly rot, and the one pattern you
 * saved because it was perfect would come back wrong months later with no way
 * to tell. So the notes are stored verbatim, and the recipe is kept alongside
 * as metadata for when you want to generate more like it.
 *
 * window.KSPLibrary
 */
(function () {
  'use strict';

  var KEY = 'library';
  var MAX = 200;
  var store = window.TSStore ? window.TSStore.create('keystep-arp') : null;

  function read() {
    if (!store) return [];
    var raw = store.get(KEY, []);
    return Array.isArray(raw) ? raw : [];
  }
  function write(list) {
    if (!store) return false;
    try { store.set(KEY, list); return true; }
    catch (e) { return false; }      /* quota — caller reports it */
  }

  function uid() {
    return 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  }

  /* A name you can recognise in a list six weeks later. */
  function autoName(meta) {
    var bits = [meta.styleName, meta.rootName + ' ' + meta.scaleName];
    if (meta.phrasingName && meta.phrasingName !== 'Through-composed') bits.push(meta.phrasingName);
    bits.push(meta.length + ' steps');
    return bits.join(' \u00b7 ');
  }

  function savePattern(pattern, recipe, name) {
    var list = read();
    var entry = {
      id: uid(),
      kind: 'pattern',
      name: name || autoName(pattern.meta),
      savedAt: Date.now(),
      steps: pattern.steps,
      meta: pattern.meta,
      recipe: recipe || null
    };
    list.unshift(entry);
    if (list.length > MAX) list = list.slice(0, MAX);
    return write(list) ? entry : null;
  }

  function saveEnsemble(ens, recipe, name) {
    var list = read();
    var entry = {
      id: uid(),
      kind: 'ensemble',
      name: name || ('Polyrhythm \u00b7 ' + ens.lengths.join('/') + ' \u00b7 ' + ens.tracks.length + ' tracks'),
      savedAt: Date.now(),
      lengths: ens.lengths,
      cycle: ens.cycle,
      tracks: ens.tracks.map(function (t) {
        return { index: t.index, role: t.role, length: t.length,
                 steps: t.pattern.steps, meta: t.pattern.meta };
      }),
      recipe: recipe || null
    };
    list.unshift(entry);
    if (list.length > MAX) list = list.slice(0, MAX);
    return write(list) ? entry : null;
  }

  /* Rebuild something the rest of the app can treat as a freshly generated
     pattern, so loading and generating produce the same shape of object. */
  function toPattern(entry) {
    return { steps: entry.steps, meta: entry.meta };
  }
  function toEnsemble(entry) {
    return {
      tracks: entry.tracks.map(function (t) {
        return { index: t.index, role: t.role, length: t.length,
                 pattern: { steps: t.steps, meta: t.meta } };
      }),
      lengths: entry.lengths, cycle: entry.cycle,
      cycleBars: entry.cycle / 16,
      occupancy: [], maxStack: 0
    };
  }

  function remove(id) {
    return write(read().filter(function (e) { return e.id !== id; }));
  }
  function rename(id, name) {
    var list = read();
    list.forEach(function (e) { if (e.id === id) e.name = name; });
    return write(list);
  }
  function get(id) {
    var found = null;
    read().forEach(function (e) { if (e.id === id) found = e; });
    return found;
  }

  /* Export is a plain JSON file. Browser storage is not a backup — clearing
     site data takes the lot, and there is no warning before it happens. */
  function exportAll() {
    return JSON.stringify({
      format: 'thermalsock-keystep-library',
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: read()
    }, null, 2);
  }

  function importAll(json, mode) {
    var data;
    try { data = JSON.parse(json); }
    catch (e) { return { ok: false, error: 'That file is not valid JSON.' }; }
    if (!data || data.format !== 'thermalsock-keystep-library' || !Array.isArray(data.entries)) {
      return { ok: false, error: 'That does not look like a KeyStep Pro library file.' };
    }
    var incoming = data.entries.filter(function (e) {
      return e && e.id && (e.kind === 'ensemble' ? Array.isArray(e.tracks) : Array.isArray(e.steps));
    });
    var list = mode === 'replace' ? [] : read();
    var have = {};
    list.forEach(function (e) { have[e.id] = true; });
    var added = 0;
    incoming.forEach(function (e) {
      if (have[e.id]) return;              /* re-importing must not duplicate */
      list.unshift(e); added++;
    });
    if (list.length > MAX) list = list.slice(0, MAX);
    if (!write(list)) return { ok: false, error: 'Could not save — browser storage is full.' };
    return { ok: true, added: added, skipped: incoming.length - added };
  }

  function clear() { return write([]); }

  /* Rough footprint, so the UI can warn before storage runs out rather than
     after a save silently fails. */
  function usage() {
    var bytes = 0;
    try { bytes = JSON.stringify(read()).length; } catch (e) { bytes = 0; }
    return { entries: read().length, bytes: bytes, max: MAX };
  }

  window.KSPLibrary = {
    list: read, savePattern: savePattern, saveEnsemble: saveEnsemble,
    toPattern: toPattern, toEnsemble: toEnsemble,
    remove: remove, rename: rename, get: get,
    exportAll: exportAll, importAll: importAll, clear: clear,
    usage: usage, autoName: autoName
  };
})();
