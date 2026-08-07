// One Small Thing — app logic.
// No backend, no accounts. Everyone gets the same prompt on the same UTC
// day because it's derived deterministically from the date string itself
// (same technique Wordle uses) — no server needed for that to be true for
// everyone simultaneously. Streaks live in localStorage only: nobody's
// but yours, on your device, never transmitted anywhere.

// Manual zero-pad instead of String.prototype.padStart, for maximum
// compatibility across older browsers/engines that don't support it.
function pad2(n) {
  n = String(n);
  return n.length < 2 ? "0" + n : n;
}

function todayUTCString() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  return `${y}-${m}-${day}`;
}

// Simple deterministic string hash (djb2). Same input, same output, always
// — that's the entire trick that makes this work without a server.
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

function promptForDate(dateStr, prompts) {
  const idx = hashString(dateStr) % prompts.length;
  return prompts[idx];
}

const STORAGE_KEY = "ost_state_v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { lastCompletedDate: null, streak: 0 };
  } catch (e) {
    return { lastCompletedDate: null, streak: 0 };
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    /* localStorage unavailable (private browsing etc) — streak just won't persist */
  }
}

function yesterdayUTCString(todayStr) {
  const d = new Date(todayStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  return `${y}-${m}-${day}`;
}

// Marks today done and returns the updated state. Pure function of
// (state, today) so it's testable without touching localStorage directly.
function markDone(state, today) {
  if (state.lastCompletedDate === today) {
    return state; // already done today, no-op
  }
  const yesterday = yesterdayUTCString(today);
  const newStreak = state.lastCompletedDate === yesterday ? state.streak + 1 : 1;
  return { lastCompletedDate: today, streak: newStreak };
}

// Export for Node-based testing (no-op in the browser, where these
// globals are just used directly by index.html's inline script).
if (typeof module !== "undefined") {
  module.exports = { hashString, promptForDate, markDone, yesterdayUTCString, todayUTCString };
}
