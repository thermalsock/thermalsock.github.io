export function findTriggerOffset(data, searchLimit = null) {
    const limit = searchLimit ? Math.min(searchLimit, data.length - 1) : data.length - 1;
    for (let i = 1; i < limit; i++) {
        if (data[i - 1] < 0 && data[i] >= 0)
            return i;
    }
    return 0;
}
export function computeAutoGain(waveform, startOffset, sampleCount, maxGain = 20, targetPeak = 0.92) {
    let maxDev = 0;
    const end = Math.min(startOffset + sampleCount, waveform.length);
    for (let i = startOffset; i < end; i++) {
        const dev = Math.abs(waveform[i]);
        if (dev > maxDev)
            maxDev = dev;
    }
    if (maxDev < 0.006)
        return 1;
    return Math.min(targetPeak / maxDev, maxGain);
}
export function smoothSamples(data, windowSize = 3) {
    const half = Math.floor(windowSize / 2);
    const out = new Float64Array(data.length);
    for (let i = 0; i < data.length; i++) {
        let sum = 0, count = 0;
        for (let k = -half; k <= half; k++) {
            const j = i + k;
            if (j >= 0 && j < data.length) {
                sum += data[j];
                count++;
            }
        }
        out[i] = sum / count;
    }
    return out;
}
export function bucketSpectrumLog(freqData, sampleRate, fftSize, numBars, minHz = 30, maxHz = null) {
    const nyquist = sampleRate / 2;
    const maxFreq = maxHz ? Math.min(maxHz, nyquist) : nyquist;
    const binCount = freqData.length;
    const hzPerBin = nyquist / binCount;
    const logMin = Math.log10(minHz);
    const logMax = Math.log10(maxFreq);
    const bars = new Array(numBars).fill(0);
    for (let b = 0; b < numBars; b++) {
        const loFreq = Math.pow(10, logMin + (logMax - logMin) * (b / numBars));
        const hiFreq = Math.pow(10, logMin + (logMax - logMin) * ((b + 1) / numBars));
        let loBin = Math.max(0, Math.floor(loFreq / hzPerBin));
        let hiBin = Math.min(binCount - 1, Math.ceil(hiFreq / hzPerBin));
        if (hiBin < loBin)
            hiBin = loBin;
        let sum = 0, count = 0;
        for (let i = loBin; i <= hiBin; i++) {
            sum += freqData[i];
            count++;
        }
        bars[b] = count > 0 ? sum / count : 0;
    }
    return bars;
}
