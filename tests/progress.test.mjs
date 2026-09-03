let store = {};

globalThis.localStorage = {
  getItem: k => k in store ? store[k] : null,
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: k => {
    delete store[k];
  }
};

const P = await (import("../transient-lab/core/state/Progress.js"));

let fails = 0;

const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};

let e = P.recordRun("BoC", "Fifths 1", [ "hit", "hit", "hit", "hit" ]);

check("perfect run -> accuracy 1", e.bestAccuracy, 1);

check("perfect run -> passed", P.isLessonPassed("BoC", "Fifths 1"), true);

e = P.recordRun("BoC", "Fifths 1", [ "hit", "missed", "hit", "missed" ]);

check("best is retained", e.bestAccuracy, 1);

check("last reflects the poor run", e.lastAccuracy, .5);

check("run count increments", e.runs, 2);

e = P.recordRun("BoC", "Quit Early", [ "hit", "hit", "pending", "pending" ]);

check("pending excluded from denominator", e.lastAccuracy, 1);

check("quitting early does not fail the lesson", P.isLessonPassed("BoC", "Quit Early"), true);

e = P.recordRun("BoC", "Holds", [ "hit", "dropped", "hit", "hit" ]);

check("dropped counts as not-hit", e.lastAccuracy, .75);

check("75% is below the 80% pass bar", P.isLessonPassed("BoC", "Holds"), false);

const before = P.getSummary().runs;

const none = P.recordRun("BoC", "Untouched", [ "pending", "pending" ]);

check("all-pending run returns null", none, null);

check("all-pending run is not counted", P.getSummary().runs, before);

for (let i = 0; i < 30; i++) P.recordRun("BoC", "Long", [ "hit", "missed" ]);

check("history caps at 20", P.getLessonProgress("BoC", "Long").history.length, 20);

const sum = P.getSummary();

check("attempted counts distinct lessons", sum.attempted, 4);

check("passed counts only >=80%", sum.passed, 2);

check("last played tracked", P.getLastPlayed(), {
  pack: "BoC",
  lesson: "Long"
});

check("export shape", P.exportProgress().kind, "transient-lab-progress");

P.resetProgress();

check("reset clears everything", P.getSummary(), {
  attempted: 0,
  passed: 0,
  runs: 0
});

console.log(fails === 0 ? "\n✓ all progress tests passed" : `\n✗ ${fails} failure(s)`);

process.exit(fails === 0 ? 0 : 1);