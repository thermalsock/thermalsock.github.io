
// The Vault — core game logic. Pure functions, no DOM, no localStorage
// calls buried inside — everything here is directly testable in Node.
// ES5-safe throughout on purpose (no async/await, no padStart) after a
// previous project taught this lesson the hard way.

// ---- Deterministic date-seeded randomness (same technique as Wordle) ----

function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

// mulberry32 — small, fast, deterministic PRNG. Same seed, same sequence,
// forever, on every device. This is what lets everyone get the same code
// on the same day without a server.
function mulberry32(seed) {
  return function() {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Today's secret: 4 unique digits (0-9), deterministic from the date string.
function codeForDate(dateStr) {
  const seed = hashString(dateStr);
  const rng = mulberry32(seed);
  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = digits[i]; digits[i] = digits[j]; digits[j] = tmp;
  }
  return digits.slice(0, 4).map(String);
}

// ---- Date helpers ----

function pad2(n) {
  n = String(n);
  return n.length < 2 ? "0" + n : n;
}

function todayUTCString() {
  const d = new Date();
  return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
}

function yesterdayUTCString(todayStr) {
  const d = new Date(todayStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
}

// Day number since a fixed epoch, purely for the "#N" display (matches the
// familiar Wordle-style day counter people recognize).
const EPOCH = "2024-01-01";
function dayNumber(dateStr) {
  const epoch = new Date(EPOCH + "T00:00:00Z");
  const d = new Date(dateStr + "T00:00:00Z");
  return Math.floor((d - epoch) / 86400000) + 1;
}

// ---- Scoring (Mastermind/Wordle-style duplicate-safe algorithm) ----

// Returns an array of 4 results: "green" | "yellow" | "black".
// Handles duplicate digits correctly even though the secret code itself
// is always 4 unique digits — the guess isn't guaranteed to be.
function scoreGuess(guessDigits, codeDigits) {
  const result = ["black", "black", "black", "black"];
  const codeUsed = [false, false, false, false];

  // Pass 1: exact matches (green)
  for (let i = 0; i < 4; i++) {
    if (guessDigits[i] === codeDigits[i]) {
      result[i] = "green";
      codeUsed[i] = true;
    }
  }
  // Pass 2: present but wrong position (yellow), respecting remaining counts
  for (let i = 0; i < 4; i++) {
    if (result[i] === "green") continue;
    for (let j = 0; j < 4; j++) {
      if (!codeUsed[j] && guessDigits[i] === codeDigits[j]) {
        result[i] = "yellow";
        codeUsed[j] = true;
        break;
      }
    }
  }
  return result;
}

function isWin(scoreResult) {
  return scoreResult.every(function(r) { return r === "green"; });
}

// ---- Streak state (pure function, same pattern as One Small Thing) ----
// state shape: { streak: number, lastWinDate: string|null }

function applyOutcome(state, today, won) {
  if (!won) {
    return { streak: 0, lastWinDate: state.lastWinDate };
  }
  const yesterday = yesterdayUTCString(today);
  const newStreak = state.lastWinDate === yesterday ? state.streak + 1 : 1;
  return { streak: newStreak, lastWinDate: today };
}

// ---- Shareable result text (Wordle-style, spoiler-free) ----

const EMOJI = { green: "\uD83D\uDFE9", yellow: "\uD83D\uDFE8", black: "\u2B1B" };

function buildShareText(dateStr, guessScores, won, guessLimit) {
  const n = dayNumber(dateStr);
  const attempts = won ? String(guessScores.length) : "X";
  let out = "The Vault #" + n + " " + attempts + "/" + guessLimit + "\n\n";
  for (let i = 0; i < guessScores.length; i++) {
    out += guessScores[i].map(function(r) { return EMOJI[r]; }).join("") + "\n";
  }
  out += "\nthermalsock.github.io/vault";
  return out;
}


if (typeof module !== "undefined") {
  module.exports = {
    hashString, mulberry32, codeForDate, todayUTCString, yesterdayUTCString,
    dayNumber, scoreGuess, isWin, applyOutcome, buildShareText, EPOCH,
  };
}
