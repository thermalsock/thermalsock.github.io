// core/state/Progress.js
//
// Lesson progress and accuracy history.
//
// Before this, localStorage held exactly one key — "themeName". With 216
// scale packs and 5 genre packs, "where was I" was unanswerable across
// sessions, and the judgement engine evaluated live but retained nothing, so
// there was no way to see whether you were actually improving. For a trainer,
// that's the whole point.
//
// Stored per lesson, keyed by pack + lesson id so a lesson keeps its history
// even if pack ordering changes later.

const STORAGE_KEY = "transientLab.progress";

let _data = null;

function load() {
  if (_data) return _data;
  try {
    _data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    _data = {};
  }
  if (!_data.lessons) _data.lessons = {};
  if (!_data.last) _data.last = null;
  return _data;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_data));
  } catch {
    // Private browsing, or quota. Progress is best-effort — never let a
    // failed write interrupt a run in progress.
  }
}

function keyFor(packName, lessonName) {
  return `${packName}::${lessonName}`;
}

/**
 * Record one completed run. `judgements` is the array from
 * getAllJudgements() — values are "hit", "missed", "dropped" or "pending".
 *
 * Pending entries are chords the run never reached (the user stopped early),
 * so they're excluded from the denominator rather than counted as failures —
 * otherwise quitting a lesson halfway would permanently tank its accuracy.
 */
export function recordRun(packName, lessonName, judgements) {
  const d = load();
  const k = keyFor(packName, lessonName);

  const scored = judgements.filter(j => j && j !== "pending");
  if (scored.length === 0) return null;

  const hits = scored.filter(j => j === "hit").length;
  const accuracy = hits / scored.length;

  const entry = d.lessons[k] || { runs: 0, bestAccuracy: 0, lastAccuracy: 0, history: [] };
  entry.runs += 1;
  entry.lastAccuracy = accuracy;
  entry.bestAccuracy = Math.max(entry.bestAccuracy, accuracy);
  entry.lastPlayed = Date.now();

  // Keep a short rolling window — enough to see a trend, not an archive.
  entry.history.push(Math.round(accuracy * 100));
  if (entry.history.length > 20) entry.history.shift();

  d.lessons[k] = entry;
  d.last = { pack: packName, lesson: lessonName };
  save();
  return entry;
}

export function getLessonProgress(packName, lessonName) {
  return load().lessons[keyFor(packName, lessonName)] || null;
}

/** A lesson counts as passed once any run reaches 80% or better. */
export function isLessonPassed(packName, lessonName) {
  const e = getLessonProgress(packName, lessonName);
  return !!e && e.bestAccuracy >= 0.8;
}

export function getLastPlayed() {
  return load().last;
}

/** Totals across everything attempted, for the header readout. */
export function getSummary() {
  const d = load();
  const keys = Object.keys(d.lessons);
  const passed = keys.filter(k => d.lessons[k].bestAccuracy >= 0.8).length;
  const runs = keys.reduce((n, k) => n + d.lessons[k].runs, 0);
  return { attempted: keys.length, passed, runs };
}

export function resetProgress() {
  _data = { lessons: {}, last: null };
  save();
}

/** Everything, for the export button. */
export function exportProgress() {
  const d = load();
  return {
    kind: "transient-lab-progress",
    version: 1,
    exported: new Date().toISOString(),
    lessons: d.lessons,
    summary: getSummary(),
  };
}
