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
  } catch {}
}

function keyFor(packName, lessonName) {
  return `${packName}::${lessonName}`;
}

export function recordRun(packName, lessonName, judgements) {
  const d = load();
  const k = keyFor(packName, lessonName);
  const scored = judgements.filter(j => j && j !== "pending");
  if (scored.length === 0) return null;
  const hits = scored.filter(j => j === "hit").length;
  const accuracy = hits / scored.length;
  const entry = d.lessons[k] || {
    runs: 0,
    bestAccuracy: 0,
    lastAccuracy: 0,
    history: []
  };
  entry.runs += 1;
  entry.lastAccuracy = accuracy;
  entry.bestAccuracy = Math.max(entry.bestAccuracy, accuracy);
  entry.lastPlayed = Date.now();
  entry.history.push(Math.round(accuracy * 100));
  if (entry.history.length > 20) entry.history.shift();
  d.lessons[k] = entry;
  d.last = {
    pack: packName,
    lesson: lessonName
  };
  save();
  return entry;
}

export function getLessonProgress(packName, lessonName) {
  return load().lessons[keyFor(packName, lessonName)] || null;
}

export function isLessonPassed(packName, lessonName) {
  const e = getLessonProgress(packName, lessonName);
  return !!e && e.bestAccuracy >= .8;
}

export function getLastPlayed() {
  return load().last;
}

export function getSummary() {
  const d = load();
  const keys = Object.keys(d.lessons);
  const passed = keys.filter(k => d.lessons[k].bestAccuracy >= .8).length;
  const runs = keys.reduce((n, k) => n + d.lessons[k].runs, 0);
  return {
    attempted: keys.length,
    passed: passed,
    runs: runs
  };
}

export function resetProgress() {
  _data = {
    lessons: {},
    last: null
  };
  save();
}

export function exportProgress() {
  const d = load();
  return {
    kind: "transient-lab-progress",
    version: 1,
    exported: (new Date).toISOString(),
    lessons: d.lessons,
    summary: getSummary()
  };
}