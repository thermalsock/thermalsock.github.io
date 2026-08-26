import { _internals } from '../sound-design/js/audition.js';
const { lvl, envTime, shapeFor, octaveMultiplier } = _internals;

let fails = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${JSON.stringify(got)}${ok ? '' : ` (want ${JSON.stringify(want)})`}`);
};
const near = (label, got, want, tol = 1e-6) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${got}${ok ? '' : ` (want ~${want})`}`);
};

// levels
check('min -> 0', lvl('min'), 0);
check('max -> 1', lvl('max'), 1);
check('mid -> 0.5', lvl('mid'), 0.5);
check('unknown falls back', lvl('nonsense'), 0.5);
check('numbers pass through', lvl(0.33), 0.33);
check('undefined uses supplied fallback', lvl(undefined, 0.9), 0.9);

// envelope times must be monotonic and hit the endpoints exactly
near('envTime min endpoint', envTime('min', 0.002, 2.5), 0.002);
near('envTime max endpoint', envTime('max', 0.002, 2.5), 2.5);
const times = ['min','low','mid','high','max'].map(l => envTime(l, 0.002, 2.5));
check('envelope times increase monotonically',
      times.every((v, i) => i === 0 || v > times[i-1]), true);
// exponential, not linear: mid should be the geometric mean, well below halfway
near('mid is geometric mean', envTime('mid', 0.002, 2.5), Math.sqrt(0.002 * 2.5), 1e-9);
check('mid is below the linear midpoint', envTime('mid', 0.002, 2.5) < (0.002 + 2.5) / 2, true);

// shapes sweep triangle -> saw -> square
check('min shape', shapeFor('min'), 'triangle');
check('low shape', shapeFor('low'), 'triangle');
check('mid shape', shapeFor('mid'), 'sawtooth');
check('high shape', shapeFor('high'), 'square');
check('max shape', shapeFor('max'), 'square');

// octaves
check('min octave', octaveMultiplier('min'), 0.25);
check('low octave', octaveMultiplier('low'), 0.5);
check('mid octave', octaveMultiplier('mid'), 1);
check('max octave', octaveMultiplier('max'), 2);
check('octave multipliers are powers of two',
      ['min','low','mid','high','max'].every(l => Number.isInteger(Math.log2(octaveMultiplier(l)))), true);

// cutoff mapping used by the filter
const cutoff = t => 80 * Math.pow(150, t);
near('cutoff at 0', cutoff(0), 80);
near('cutoff at 1', cutoff(1), 12000, 1);
check('cutoff stays inside audible range',
      [0,0.25,0.5,0.75,1].every(t => cutoff(t) >= 20 && cutoff(t) <= 20000), true);

// resonance -> Q must stay stable (a runaway Q self-oscillates and screams)
const Q = r => 0.7 + r * 14;
check('Q range is sane', [Q(0), Q(1)], [0.7, 14.7]);

console.log(fails === 0 ? '\n✓ all audition tests passed' : `\n✗ ${fails} failure(s)`);
process.exit(fails === 0 ? 0 : 1);
