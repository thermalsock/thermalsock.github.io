import { INTERVALS, intervalBySemitones, SCALE_DEGREES } from "./curriculum.js";

import { completeLesson, setTryScore } from "./progress.js";

const NOTE_NAMES = [ "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" ];

let _audioCtx = null;

let _tonicFreq = 261.63;

export function setAudioCtx(ctx) {
  _audioCtx = ctx;
}

export function setTonic(freq) {
  _tonicFreq = freq;
}

function semitoneToFreq(semitones) {
  return _tonicFreq * Math.pow(2, semitones / 12);
}

let _activeOscs = [];

function stopAll() {
  _activeOscs.forEach(o => {
    try {
      o.gain.gain.setValueAtTime(0, _audioCtx.currentTime);
      o.osc.stop(_audioCtx.currentTime + .05);
    } catch {}
  });
  _activeOscs = [];
}

let _tempoScale = 1;

export function setTempoScale(scale) {
  _tempoScale = Math.max(.25, Math.min(2, scale || 1));
}

export function getTempoScale() {
  return _tempoScale;
}

function t(seconds) {
  return seconds / _tempoScale;
}

function playTone(semitones, startSec, durSec, vol = .18) {
  if (!_audioCtx) return;
  const freq = semitoneToFreq(semitones);
  const osc = _audioCtx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = freq;
  const gain = _audioCtx.createGain();
  gain.gain.value = 0;
  osc.connect(gain);
  gain.connect(_audioCtx.destination);
  osc.start(startSec);
  const att = .03, rel = .08;
  gain.gain.setValueAtTime(0, startSec);
  gain.gain.linearRampToValueAtTime(vol, startSec + att);
  gain.gain.setValueAtTime(vol, startSec + durSec - rel);
  gain.gain.linearRampToValueAtTime(0, startSec + durSec);
  osc.stop(startSec + durSec + .05);
  _activeOscs.push({
    osc: osc,
    gain: gain
  });
}

function playPair(a, b, gap = .45) {
  stopAll();
  if (!_audioCtx) return;
  const now = _audioCtx.currentTime + .05;
  playTone(a, now, t(.5));
  playTone(b, now + t(.5 + gap), t(.5));
}

function playDegreeInContext(offset, context) {
  stopAll();
  if (!_audioCtx) return;
  const now = _audioCtx.currentTime + .05;
  context.forEach((s, i) => {
    const vol = s === offset ? .22 : .12;
    playTone(s, now + i * t(.42), t(.38), vol);
  });
}

function playDegreeMove(from, to) {
  stopAll();
  if (!_audioCtx) return;
  const now = _audioCtx.currentTime + .05;
  playTone(from, now, t(.45), .16);
  playTone(to, now + t(.55), t(.55), .2);
}

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "onclick") e.addEventListener("click", v); else if (k === "className") e.className = v; else e.setAttribute(k, v);
  }
  children.forEach(c => {
    if (typeof c === "string") e.appendChild(document.createTextNode(c)); else if (c) e.appendChild(c);
  });
  return e;
}

function playBtn(label, onClick) {
  return el("button", {
    className: "lesson-play-btn",
    onclick: onClick
  }, [ "▶ " + label ]);
}

function renderListen(section) {
  const wrap = el("div", {
    className: "lesson-section"
  });
  wrap.appendChild(el("h4", {}, [ "Listen" ]));
  wrap.appendChild(el("p", {
    className: "lesson-text"
  }, [ section.text ]));
  const list = el("div", {
    className: "example-list"
  });
  section.examples.forEach(ex => {
    const row = el("div", {
      className: "example-row"
    });
    if (ex.type === "pair") {
      row.appendChild(playBtn("Play", () => playPair(ex.intervals[0], ex.intervals[1])));
    } else if (ex.type === "interval") {
      row.appendChild(playBtn("Play", () => playPair(0, ex.semitones)));
    } else if (ex.type === "degree") {
      row.appendChild(playBtn("Play", () => {
        stopAll();
        const now = _audioCtx.currentTime + .05;
        playTone(0, now, t(.35), .13);
        playTone(ex.offset, now + t(.45), t(.5), .2);
      }));
    } else if (ex.type === "degree_in_context") {
      row.appendChild(playBtn("Play", () => playDegreeInContext(ex.offset, ex.context)));
    } else if (ex.type === "degree_move") {
      row.appendChild(playBtn("Play", () => playDegreeMove(ex.from, ex.to)));
    }
    row.appendChild(el("span", {
      className: "example-label"
    }, [ ex.label ]));
    list.appendChild(row);
  });
  wrap.appendChild(list);
  return wrap;
}

function renderUnderstand(text) {
  const wrap = el("div", {
    className: "lesson-section"
  });
  wrap.appendChild(el("h4", {}, [ "Understand" ]));
  wrap.appendChild(el("p", {
    className: "lesson-text"
  }, [ text ]));
  return wrap;
}

function renderCompare(section) {
  const wrap = el("div", {
    className: "lesson-section"
  });
  wrap.appendChild(el("h4", {}, [ "Compare" ]));
  wrap.appendChild(el("p", {
    className: "lesson-text"
  }, [ section.text ]));
  const list = el("div", {
    className: "example-list"
  });
  section.pairs.forEach(pair => {
    const row = el("div", {
      className: "example-row"
    });
    row.appendChild(playBtn("Play", () => playPair(pair.a, pair.b)));
    row.appendChild(el("span", {
      className: "example-label"
    }, [ pair.label ]));
    list.appendChild(row);
  });
  wrap.appendChild(list);
  return wrap;
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function generateTryQuestion(config) {
  if (config.type === "higher_lower") {
    const base = randInt(0, 7);
    const gap = randInt(config.gapRange[0], config.gapRange[1]);
    const ascending = Math.random() < .5;
    const second = ascending ? base + gap : base - gap;
    const correctAnswer = ascending ? "higher" : "lower";
    if (Math.random() < .12) {
      return {
        type: "higher_lower",
        a: base,
        b: base,
        correct: "same",
        choices: [ "higher", "lower", "same" ]
      };
    }
    return {
      type: "higher_lower",
      a: base,
      b: second,
      correct: correctAnswer,
      choices: [ "higher", "lower", "same" ]
    };
  }
  if (config.type === "identify_interval") {
    const semitones = randomFrom(config.intervals);
    const iv = intervalBySemitones(semitones);
    const ascending = Math.random() < .5;
    const a = 0, b = ascending ? semitones : -semitones;
    const choices = config.intervals.map(s => intervalBySemitones(s).name);
    return {
      type: "identify_interval",
      a: a,
      b: b,
      semitones: semitones,
      correct: iv.name,
      choices: choices,
      ascending: ascending,
      explanation: iv.character
    };
  }
  if (config.type === "identify_degree") {
    const offset = randomFrom(config.degrees);
    const degrees = SCALE_DEGREES[config.scale || "major"];
    const degInfo = degrees.find(d => d.offset === offset) || {
      degree: "?",
      name: "Unknown"
    };
    const choices = config.degrees.map(o => {
      const d = degrees.find(dd => dd.offset === o);
      return d ? `${d.degree} — ${d.name}` : `? — offset ${o}`;
    });
    const correct = `${degInfo.degree} — ${degInfo.name}`;
    return {
      type: "identify_degree",
      offset: offset,
      correct: correct,
      choices: choices,
      explanation: degInfo.character
    };
  }
  return null;
}

function renderTry(config, lessonId, onComplete) {
  const wrap = el("div", {
    className: "lesson-section"
  });
  wrap.appendChild(el("h4", {}, [ "Try" ]));
  const total = config.count;
  let current = 0, correctCount = 0;
  let answered = false;
  const statusEl = el("div", {
    className: "try-status"
  }, [ `Question 1 of ${total}` ]);
  const questionArea = el("div", {
    className: "try-question"
  });
  const feedbackEl = el("div", {
    className: "try-feedback"
  });
  wrap.appendChild(statusEl);
  wrap.appendChild(questionArea);
  wrap.appendChild(feedbackEl);
  function showQuestion() {
    answered = false;
    feedbackEl.textContent = "";
    feedbackEl.className = "try-feedback";
    questionArea.innerHTML = "";
    statusEl.textContent = `Question ${current + 1} of ${total}`;
    const q = generateTryQuestion(config);
    if (!q) {
      questionArea.textContent = "Configuration error";
      return;
    }
    const listenBtn = playBtn("Listen", () => {
      if (q.type === "higher_lower") playPair(q.a, q.b); else if (q.type === "identify_interval") {
        stopAll();
        const now = _audioCtx.currentTime + .05;
        playTone(0, now, t(.4), .15);
        playTone(q.b, now + t(.5), t(.5), .2);
      } else if (q.type === "identify_degree") {
        stopAll();
        const now = _audioCtx.currentTime + .05;
        playTone(0, now, t(.4), .15);
        playTone(q.offset, now + t(.5), t(.5), .2);
      }
    });
    questionArea.appendChild(listenBtn);
    if (q.type === "higher_lower") {
      questionArea.appendChild(el("p", {
        className: "try-prompt"
      }, [ "You'll hear two tones. Is the second one higher, lower, or the same as the first?" ]));
    } else if (q.type === "identify_interval") {
      questionArea.appendChild(el("p", {
        className: "try-prompt"
      }, [ "You'll hear your tonic first, then a second note. What interval separates them?" ]));
    } else if (q.type === "identify_degree") {
      questionArea.appendChild(el("p", {
        className: "try-prompt"
      }, [ "You'll hear your tonic first, then a scale degree. Which degree is the second note?" ]));
    }
    const choicesWrap = el("div", {
      className: "try-choices"
    });
    q.choices.forEach(choice => {
      const btn = el("button", {
        className: "try-choice-btn",
        onclick: () => {
          if (answered) return;
          answered = true;
          const isCorrect = choice === q.correct;
          if (isCorrect) correctCount++;
          btn.classList.add(isCorrect ? "correct" : "wrong");
          if (!isCorrect) {
            choicesWrap.querySelectorAll(".try-choice-btn").forEach(b => {
              if (b.textContent === q.correct) b.classList.add("correct");
            });
          }
          feedbackEl.className = "try-feedback " + (isCorrect ? "fb-correct" : "fb-wrong");
          if (isCorrect) {
            feedbackEl.textContent = "Correct!";
          } else {
            let msg = `The answer was: ${q.correct}.`;
            if (q.explanation) msg += " " + q.explanation;
            feedbackEl.textContent = msg;
          }
          setTimeout(() => {
            current++;
            if (current >= total) {
              finishTry();
            } else {
              showQuestion();
            }
          }, isCorrect ? 1e3 : 2800);
        }
      }, [ choice ]);
      choicesWrap.appendChild(btn);
    });
    questionArea.appendChild(choicesWrap);
    listenBtn.click();
  }
  function finishTry() {
    questionArea.innerHTML = "";
    feedbackEl.className = "try-feedback";
    const pct = Math.round(100 * correctCount / total);
    const passed = pct >= 60;
    statusEl.textContent = `${correctCount}/${total} correct (${pct}%)`;
    feedbackEl.className = "try-feedback " + (passed ? "fb-correct" : "fb-wrong");
    feedbackEl.textContent = passed ? "Passed — this lesson is complete. The concepts here will now appear in Game mode." : "Not quite — try the Listen and Compare sections again, then come back.";
    setTryScore(lessonId, correctCount, total);
    if (passed) completeLesson(lessonId);
    const retryBtn = el("button", {
      className: "lesson-play-btn",
      onclick: () => {
        current = 0;
        correctCount = 0;
        showQuestion();
      }
    }, [ "Try again" ]);
    const doneBtn = el("button", {
      className: "lesson-play-btn",
      onclick: () => onComplete(passed)
    }, [ "Continue" ]);
    const btnRow = el("div", {
      className: "try-btn-row"
    });
    btnRow.appendChild(retryBtn);
    btnRow.appendChild(doneBtn);
    questionArea.appendChild(btnRow);
  }
  showQuestion();
  return wrap;
}

export function renderLesson(container, lesson, onComplete) {
  container.innerHTML = "";
  stopAll();
  const header = el("div", {
    className: "lesson-header"
  });
  header.appendChild(el("h2", {}, [ lesson.name ]));
  header.appendChild(el("p", {
    className: "lesson-subtitle"
  }, [ lesson.subtitle ]));
  container.appendChild(header);
  container.appendChild(renderListen(lesson.listen));
  container.appendChild(renderUnderstand(lesson.understand));
  container.appendChild(renderCompare(lesson.compare));
  container.appendChild(renderTry(lesson.tryConfig, lesson.id, onComplete));
}

export { stopAll };