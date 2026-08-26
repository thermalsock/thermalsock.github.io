// game.js
// The game-mode state machine — now structured by lesson, testing the exact
// same skills the training mode teaches rather than a disconnected
// sequence-recall mechanic. Each game round draws from a specific lesson's
// tryConfig (the same exercise types: higher_lower, identify_interval,
// identify_degree), but in a faster, streak-based, XP-earning format.
//
// Two ways to play:
//  - Pick a specific lesson to drill (only completed lessons available)
//  - "Mixed" mode that randomly draws from all completed lessons

import { STAGES, intervalBySemitones, SCALE_DEGREES } from './curriculum.js';
import { getCompletedLessonIds } from './progress.js';

const XP_PER_CORRECT = 10;
const XP_STREAK_BONUS = 3;  // multiplied by current streak length
const ROUND_SIZE = 10;       // questions per game round

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

// --- Question generation (reuses the exact same logic as lessonEngine's
// Try exercises, deliberately — what you're tested on IS what you trained) ---

function generateQuestion(config) {
  if (config.type === 'higher_lower') {
    const base = randInt(0, 7);
    const gap = randInt(config.gapRange[0], config.gapRange[1]);
    const ascending = Math.random() < 0.5;
    if (Math.random() < 0.1) {
      return { type: 'higher_lower', a: base, b: base, correct: 'same', choices: ['higher', 'lower', 'same'], prompt: 'Is the second tone higher, lower, or the same?' };
    }
    const second = ascending ? base + gap : base - gap;
    return { type: 'higher_lower', a: base, b: second, correct: ascending ? 'higher' : 'lower', choices: ['higher', 'lower', 'same'], prompt: 'Is the second tone higher, lower, or the same?' };
  }

  if (config.type === 'identify_interval') {
    const semitones = randomFrom(config.intervals);
    const iv = intervalBySemitones(semitones);
    const ascending = Math.random() < 0.5;
    const a = 0, b = ascending ? semitones : -semitones;
    const choices = config.intervals.map(s => intervalBySemitones(s).name);
    const choiceSemitones = config.intervals.slice(); // parallel array: choiceSemitones[i] is the semitone value for choices[i]
    return { type: 'identify_interval', a, b, semitones, correct: iv.name, choices, choiceSemitones, prompt: 'What interval is this?', explanation: iv.character };
  }

  if (config.type === 'identify_degree') {
    const offset = randomFrom(config.degrees);
    const degrees = SCALE_DEGREES[config.scale || 'major'];
    const degInfo = degrees.find(d => d.offset === offset) || { degree: '?', name: 'Unknown' };
    const choices = config.degrees.map(o => {
      const d = degrees.find(dd => dd.offset === o);
      return d ? `${d.degree} — ${d.name}` : `? — offset ${o}`;
    });
    const correct = `${degInfo.degree} — ${degInfo.name}`;
    const choiceOffsets = config.degrees.slice(); // parallel array: choiceOffsets[i] is the semitone offset for choices[i]
    return { type: 'identify_degree', offset, correct, choices, choiceOffsets, prompt: 'Which scale degree? (First note is the tonic.)', explanation: degInfo.character };
  }
  return null;
}

// --- Lesson lookup ---

function getAllLessons() {
  return STAGES.flatMap(s => s.lessons);
}

function getLessonById(id) {
  return getAllLessons().find(l => l.id === id) || null;
}

export function getAvailableGameLessons() {
  const completed = getCompletedLessonIds();
  return getAllLessons().filter(l => completed.includes(l.id));
}

export function getStageName(lessonId) {
  for (const s of STAGES) {
    if (s.lessons.some(l => l.id === lessonId)) return s.name;
  }
  return '';
}

// --- Game session ---

export class GameSession {
  constructor() {
    this.lessonId = null;    // null = mixed mode
    this.lessonName = '';
    this.questions = [];
    this.currentIndex = 0;
    this.correct = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.xpEarned = 0;
    this.totalQuestions = ROUND_SIZE;
    this.isActive = false;
    this.currentQuestion = null;
    this.answered = false;
  }

  /** Start a round for a specific lesson, or mixed (null). */
  start(lessonId) {
    const available = getAvailableGameLessons();
    if (available.length === 0) return false;

    this.lessonId = lessonId;
    this.currentIndex = 0;
    this.correct = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.xpEarned = 0;
    this.answered = false;
    this.isActive = true;

    if (lessonId) {
      const lesson = getLessonById(lessonId);
      this.lessonName = lesson ? lesson.name : '';
      this.totalQuestions = ROUND_SIZE;
      // Pre-generate all questions from this lesson's config
      this.questions = [];
      for (let i = 0; i < this.totalQuestions; i++) {
        this.questions.push(generateQuestion(lesson.tryConfig));
      }
    } else {
      this.lessonName = 'Mixed — all completed lessons';
      this.totalQuestions = ROUND_SIZE;
      this.questions = [];
      for (let i = 0; i < this.totalQuestions; i++) {
        const lesson = randomFrom(available);
        this.questions.push(generateQuestion(lesson.tryConfig));
      }
    }

    this.currentQuestion = this.questions[0];
    return true;
  }

  /** Score the player's answer for the current question.
   * Returns { correct, xpGained, explanation, roundOver, summary } */
  answer(choice) {
    if (!this.isActive || this.answered) return null;
    this.answered = true;

    const q = this.currentQuestion;
    const isCorrect = choice === q.correct;

    let xpGained = 0;
    if (isCorrect) {
      this.correct++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      xpGained = XP_PER_CORRECT + this.streak * XP_STREAK_BONUS;
      this.xpEarned += xpGained;
    } else {
      this.streak = 0;
    }

    const roundOver = this.currentIndex >= this.totalQuestions - 1;

    return {
      correct: isCorrect,
      xpGained,
      correctAnswer: q.correct,
      explanation: isCorrect ? null : (q.explanation || null),
      roundOver,
      summary: roundOver ? {
        correct: this.correct,
        total: this.totalQuestions,
        pct: Math.round(100 * this.correct / this.totalQuestions),
        bestStreak: this.bestStreak,
        xpEarned: this.xpEarned,
      } : null,
    };
  }

  /** Advance to the next question. Returns false if the round is over. */
  next() {
    this.currentIndex++;
    this.answered = false;
    if (this.currentIndex >= this.totalQuestions) {
      this.isActive = false;
      return false;
    }
    this.currentQuestion = this.questions[this.currentIndex];
    return true;
  }
}
