function dbToLinear01(db, minDb, maxDb) {
  const t = (db - minDb) / (maxDb - minDb);
  return Math.max(0, Math.min(1, t));
}

const DEFAULT_BANDS = {
  low: [ 20, 250 ],
  mid: [ 250, 2e3 ],
  high: [ 2e3, 9e3 ]
};

export function bandEnergies(freqDb, sampleRate, minDb, maxDb, bands = DEFAULT_BANDS) {
  const binHz = sampleRate / (2 * freqDb.length);
  const out = {};
  for (const [name, [loHz, hiHz]] of Object.entries(bands)) {
    const loBin = Math.max(0, Math.floor(loHz / binHz));
    const hiBin = Math.min(freqDb.length - 1, Math.ceil(hiHz / binHz));
    let sum = 0, count = 0;
    for (let i = loBin; i <= hiBin; i++) {
      sum += dbToLinear01(freqDb[i], minDb, maxDb);
      count++;
    }
    out[name] = count > 0 ? sum / count : 0;
  }
  return out;
}

export function spectralCentroid(freqDb, sampleRate, minDb, maxDb) {
  const binHz = sampleRate / (2 * freqDb.length);
  let weightedSum = 0, totalWeight = 0;
  for (let i = 0; i < freqDb.length; i++) {
    const mag = dbToLinear01(freqDb[i], minDb, maxDb);
    if (mag <= .001) continue;
    weightedSum += i * binHz * mag;
    totalWeight += mag;
  }
  if (totalWeight < .02) return null;
  return weightedSum / totalWeight;
}

export function zeroCrossingRate(buffer) {
  let crossings = 0;
  for (let i = 1; i < buffer.length; i++) {
    if (buffer[i - 1] < 0 !== buffer[i] < 0) crossings++;
  }
  const rate = crossings / buffer.length;
  return Math.max(0, Math.min(1, rate / .18));
}