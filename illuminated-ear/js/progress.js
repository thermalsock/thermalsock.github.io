// progress.js
// Tracks which lessons the user has completed (visited all four sections
// and passed the Try exercise) and their best scores per exercise.
// localStorage-backed, keyed so it survives across sessions.

const STORAGE_KEY = 'illuminatedEar.progress';

let _data = null;

function load() {
  if (_data) return _data;
  try {
    _data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch { _data = {}; }
  if (!_data.completed) _data.completed = [];
  if (!_data.tryScores) _data.tryScores = {};
  if (!_data.lastLesson) _data.lastLesson = null;
  return _data;
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_data)); } catch {}
}

export function isLessonCompleted(lessonId) {
  return load().completed.includes(lessonId);
}

export function completeLesson(lessonId) {
  const d = load();
  if (!d.completed.includes(lessonId)) d.completed.push(lessonId);
  d.lastLesson = lessonId;
  save();
}

export function getTryScore(lessonId) {
  return load().tryScores[lessonId] || null;
}

export function setTryScore(lessonId, correct, total) {
  const d = load();
  const prev = d.tryScores[lessonId];
  if (!prev || correct > prev.correct) {
    d.tryScores[lessonId] = { correct, total, ts: Date.now() };
  }
  save();
}

export function getCompletedLessonIds() {
  return [...load().completed];
}

export function getLastLessonId() {
  return load().lastLesson;
}

/** Which stages have at least one completed lesson (for game-mode filtering). */
export function getTrainedStageIds() {
  const completed = load().completed;
  // Import-free: stage id is the prefix before the first hyphen
  const stages = new Set();
  completed.forEach(id => {
    if (id.startsWith('pitch')) stages.add('pitch');
    else if (id.startsWith('int')) stages.add('intervals');
    else if (id.startsWith('deg')) stages.add('degrees');
  });
  return [...stages];
}

export function resetProgress() {
  _data = { completed: [], tryScores: {}, lastLesson: null };
  save();
}
