// game.js
// The state machine for one game session. Deliberately has no rendering or
// audio-output code in it — main.js owns the canvas and the synth voice
// used for playback; this file just tracks what round we're in, what the
// target sequence is, and whether what the player just played matches it.
// That split is what makes the note-matching logic testable in isolation
// (see the accompanying test harness) without needing a real AudioContext.
//
// Two independent ways of confirming "the player just played this note"
// feed the same scoring path (scoreOffset): the mic/pitch-detection route
// (processRecallFrame, driven by onset+PitchLock, run every audio frame)
// and the MIDI route (processMidiNoteOn, driven by exact note-on events —
// no ambiguity to resolve, so it scores immediately). Neither one
// duplicates the actual matching/round-ending/scoring rules.

import { PitchLock } from './pitchDetect.js';
import { generateSequence, freqToRelativeOffset } from './sequence.js';

export const PHASE = {
  IDLE: 'idle',           // no round in progress (tuning screen, or between rounds)
  LISTENING: 'listening',  // sequence is being played back / written
  RECALLING: 'recalling',  // waiting for the player to play it back
  ROUND_OVER: 'round_over', // brief result display before the next round starts
};

const MIN_LENGTH = 1; // start every session on a single note — the constructor sets sequenceLength to this, so the very first round is genuinely one note, not three
const MAX_LENGTH = 8;
const NOTE_TIMEOUT_MS = 4500; // how long the player has to produce each note before the round auto-fails

// XP / leveling — "Incorrect answers end the round but grant partial XP
// toward upgrades": XP is awarded per note actually matched, whether or
// not the round as a whole succeeded, so a round that dies on note 3 of 5
// still counts for something rather than being wasted effort.
const XP_PER_CORRECT_NOTE = 12;
const XP_ROUND_COMPLETE_BONUS = 20;
export const LEVELS = [
  { level: 1, name: 'Basic Hearing', xpRequired: 0, unlocks: [] },
  { level: 2, name: 'Partial Vision', xpRequired: 120, unlocks: ['pitch'] },
  { level: 3, name: 'Full Vision', xpRequired: 360, unlocks: ['pitch', 'interval'] },
];

export class Game {
  constructor(scale) {
    this.scale = scale;
    this.tonicFreq = null;
    this.phase = PHASE.IDLE;
    this.sequence = [];
    this.responses = []; // {offset, correct} per note the player has played this round
    this.expectedIndex = 0;
    this.sequenceLength = MIN_LENGTH;
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.roundsPlayed = 0;
    this.noteDeadlineMs = null;
    this.xp = 0;

    this._onsetWaiting = true; // recall-phase sub-state: waiting for a fresh onset vs. tracking a held note
    this.pitchLock = new PitchLock();
  }

  setTonic(freq) {
    this.tonicFreq = freq;
  }

  setScale(scale) {
    this.scale = scale;
  }

  /** Current level info, derived from XP rather than stored directly —
   * there's only ever one source of truth (xp), so a level readout can
   * never drift out of sync with what XP actually says it should be. */
  get levelInfo() {
    let current = LEVELS[0];
    for (const l of LEVELS) {
      if (this.xp >= l.xpRequired) current = l;
    }
    return current;
  }

  get nextLevelInfo() {
    const idx = LEVELS.indexOf(this.levelInfo);
    return LEVELS[idx + 1] || null;
  }

  /** Which vision hints are currently unlocked, e.g. {pitch: true, interval: false}. */
  get visionUnlocked() {
    const unlocked = {};
    for (const key of this.levelInfo.unlocks) unlocked[key] = true;
    return unlocked;
  }

  /** Starts a new round: generates a sequence and moves to LISTENING.
   * The caller (main.js) is responsible for actually scheduling audio/
   * glyph playback for the sequence — this just records what the target
   * is and what phase we're in. */
  startRound() {
    this.sequence = generateSequence(this.scale, this.sequenceLength);
    this.responses = [];
    this.expectedIndex = 0;
    this.phase = PHASE.LISTENING;
    this._onsetWaiting = true;
    this.pitchLock.reset();
    return this.sequence;
  }

  /** Called once listen-phase playback has finished. */
  beginRecall(nowMs) {
    this.phase = PHASE.RECALLING;
    this._onsetWaiting = true;
    this.pitchLock.reset();
    this.noteDeadlineMs = nowMs + NOTE_TIMEOUT_MS;
  }

  /**
   * Feeds one audio frame's analysis into the recall-phase note matcher.
   * @param {boolean} onset - did activity.js detect a fresh onset this frame?
   * @param {{freq:number,confidence:number}|null} pitchResult - detectPitch() output this frame, or null
   * @param {number} nowMs
   * @returns {{noteScored: boolean, correct: boolean, offset: number, roundOver: boolean, success: boolean} | null}
   *   null if nothing happened this frame (still waiting), otherwise a
   *   result describing what just got scored and whether the round ended.
   */
  processRecallFrame(onset, pitchResult, nowMs) {
    if (this.phase !== PHASE.RECALLING || this.tonicFreq == null) return null;

    if (this.noteDeadlineMs != null && nowMs > this.noteDeadlineMs) {
      return this._endRound(false, nowMs);
    }

    if (this._onsetWaiting) {
      if (onset) {
        this._onsetWaiting = false;
        this.pitchLock.reset();
      }
      return null;
    }

    // Tracking a held note, waiting for PitchLock to confirm a stable reading.
    const locked = this.pitchLock.update(pitchResult ? pitchResult.freq : null);
    if (locked == null) return null;

    this._onsetWaiting = true;
    this.pitchLock.reset();
    const offset = freqToRelativeOffset(locked, this.tonicFreq);
    return this.scoreOffset(offset, nowMs);
  }

  /**
   * MIDI equivalent of processRecallFrame — a note-on event is already an
   * exact, unambiguous "the player just played this note," so it scores
   * immediately rather than needing onset-detection + pitch-lock-stability
   * to first confirm what happened (there's nothing to disambiguate: MIDI
   * hands us the exact note number directly).
   * @param {number} midiNoteNumber 0-127
   */
  processMidiNoteOn(midiNoteNumber, nowMs) {
    if (this.phase !== PHASE.RECALLING || this.tonicFreq == null) return null;
    if (this.noteDeadlineMs != null && nowMs > this.noteDeadlineMs) {
      return this._endRound(false, nowMs);
    }
    const freq = 440 * Math.pow(2, (midiNoteNumber - 69) / 12);
    const offset = freqToRelativeOffset(freq, this.tonicFreq);
    return this.scoreOffset(offset, nowMs);
  }

  /** Shared by both input pathways above: scores one confirmed note
   * offset against the current expected sequence position, advances or
   * ends the round, and resets the per-note deadline either way. */
  scoreOffset(offset, nowMs) {
    const expected = this.sequence[this.expectedIndex];
    const correct = offset === expected;
    this.responses.push({ offset, correct });
    this.noteDeadlineMs = nowMs + NOTE_TIMEOUT_MS;

    if (correct) this.xp += XP_PER_CORRECT_NOTE;

    if (!correct) {
      const result = this._endRound(false, nowMs);
      return { noteScored: true, correct: false, offset, expected, ...result };
    }

    this.expectedIndex++;
    if (this.expectedIndex >= this.sequence.length) {
      const result = this._endRound(true, nowMs);
      return { noteScored: true, correct: true, offset, expected, ...result };
    }

    return { noteScored: true, correct: true, offset, expected, roundOver: false, success: null };
  }

  _endRound(success, nowMs) {
    this.phase = PHASE.ROUND_OVER;
    this.roundsPlayed++;
    if (success) {
      const notesThisRound = this.sequence.length;
      this.score += notesThisRound * 10 + this.streak * 5;
      this.xp += XP_ROUND_COMPLETE_BONUS;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      // Adaptive difficulty: grow every successful round, capped.
      this.sequenceLength = Math.min(MAX_LENGTH, this.sequenceLength + 1);
    } else {
      this.streak = 0;
      // Step back by 1 rather than resetting all the way to MIN_LENGTH —
      // one mistake shouldn't erase several rounds of earned progress.
      // (XP for whatever notes WERE matched this round was already
      // awarded per-note in scoreOffset, so a failed round still nets
      // some XP — that's the "partial XP toward upgrades" behavior.)
      this.sequenceLength = Math.max(MIN_LENGTH, this.sequenceLength - 1);
    }
    return { roundOver: true, success };
  }

  /** Replays the current round's sequence from the start — resets recall
   * progress (expectedIndex/responses) too, since the visual page also
   * gets rewritten from scratch when replaying. Letting those silently
   * diverge would mean a correctly-replayed first note gets checked
   * against whatever sequence position the player had already reached
   * before asking to replay, which would wrongly reject it. */
  restartListen() {
    this.responses = [];
    this.expectedIndex = 0;
    this.phase = PHASE.LISTENING;
    this._onsetWaiting = true;
    this.pitchLock.reset();
  }

  reset() {
    this.phase = PHASE.IDLE;
    this.sequence = [];
    this.responses = [];
    this.expectedIndex = 0;
    this.sequenceLength = MIN_LENGTH;
    this.score = 0;
    this.streak = 0;
    this.roundsPlayed = 0;
    this.xp = 0;
  }
}
