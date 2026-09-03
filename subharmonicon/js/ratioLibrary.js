export const RATIO_CATEGORIES = [ "Open & Stable", "Rich & Consonant", "Cluster & Dissonant", "Drone" ];

export const RATIO_PRESETS = [ {
  id: "octave-fifth",
  name: "Octave + Fifth",
  category: "Open & Stable",
  vco2Ratio: {
    n: 1,
    direction: "above"
  },
  vco1: {
    sub1: 2,
    sub2: 3
  },
  vco2: {
    sub1: 4,
    sub2: 3
  },
  blurb: "The classic starting point. VCO1/2 in unison, Sub1 an octave down, Sub2 a fifth down — wide and unambiguous, good for testing whether your VCOs themselves are actually in tune before adding complexity."
}, {
  id: "fifths-fourths",
  name: "Stacked Fifths & Fourths",
  category: "Open & Stable",
  vco2Ratio: {
    n: 3,
    direction: "above"
  },
  vco1: {
    sub1: 2,
    sub2: 4
  },
  vco2: {
    sub1: 2,
    sub2: 3
  },
  blurb: "VCO2 tuned a fifth above VCO1, subs on both sides pulling in octaves and fourths — open, quartal, no clashing thirds. Good foundation for ambient/psybient work."
}, {
  id: "major-triad",
  name: "Major Triad Spread",
  category: "Rich & Consonant",
  vco2Ratio: {
    n: 5,
    direction: "above"
  },
  vco1: {
    sub1: 2,
    sub2: 4
  },
  vco2: {
    sub1: 5,
    sub2: 8
  },
  blurb: "VCO2 a major third above VCO1, with subs reinforcing octaves of the root and third — as close as the divider architecture gets to an outright major chord."
}, {
  id: "minor-triad",
  name: "Minor Triad Spread",
  category: "Rich & Consonant",
  vco2Ratio: {
    n: 6,
    direction: "above"
  },
  vco1: {
    sub1: 2,
    sub2: 4
  },
  vco2: {
    sub1: 3,
    sub2: 6
  },
  blurb: 'VCO2 tuned toward a minor third above VCO1 (the divider ladder can only approximate just-minor-third ratios, so expect a few cents of natural "character" here rather than equal-tempered precision).'
}, {
  id: "seventh-stack",
  name: "Seventh Stack",
  category: "Rich & Consonant",
  vco2Ratio: {
    n: 7,
    direction: "above"
  },
  vco1: {
    sub1: 2,
    sub2: 3
  },
  vco2: {
    sub1: 4,
    sub2: 7
  },
  blurb: 'VCO2 up at the 7th harmonic of VCO1 — a naturally flat, "barbershop"-flavored seventh equal temperament can’t reach. Distinctive rather than dissonant; a signature Subharmonicon color.'
}, {
  id: "tone-cluster",
  name: "Tight Cluster",
  category: "Cluster & Dissonant",
  vco2Ratio: {
    n: 8,
    direction: "above"
  },
  vco1: {
    sub1: 5,
    sub2: 7
  },
  vco2: {
    sub1: 6,
    sub2: 8
  },
  blurb: 'Adjacent, non-matching divisors on both VCOs — subs land close together rather than on shared clean ratios, producing beating and grit rather than a chord. Good for tension or texture, not for "in tune."'
}, {
  id: "wide-dissonance",
  name: "Wide Dissonant Spread",
  category: "Cluster & Dissonant",
  vco2Ratio: {
    n: 5,
    direction: "below"
  },
  vco1: {
    sub1: 3,
    sub2: 5
  },
  vco2: {
    sub1: 5,
    sub2: 7
  },
  blurb: "VCO2 dropped well below VCO1 with odd divisors on both sides — nothing lines up cleanly across the full six-voice stack. Useful for horror/hauntology textures or as a deliberate palate-cleanser between clean patches."
}, {
  id: "drone-fifth",
  name: "Long Drone (Root + Fifth)",
  category: "Drone",
  vco2Ratio: {
    n: 3,
    direction: "above"
  },
  vco1: {
    sub1: 2,
    sub2: 2
  },
  vco2: {
    sub1: 2,
    sub2: 4
  },
  blurb: "Minimal, wide-spaced octaves under a root/fifth pair — built to sit and sustain rather than move. Both Sub2s doubled at ÷2/÷4 so the low end reinforces itself rather than adding new pitch material."
}, {
  id: "drone-cluster-slow",
  name: "Slow-Shifting Drone Cluster",
  category: "Drone",
  vco2Ratio: {
    n: 4,
    direction: "above"
  },
  vco1: {
    sub1: 3,
    sub2: 5
  },
  vco2: {
    sub1: 7,
    sub2: 8
  },
  blurb: "Higher, less-common divisors (5, 7, 8) spread across both VCOs — individually near-clean, collectively slow-beating against each other. Pair with a slow sequencer clock rather than held notes for the full effect."
}, {
  id: "sub-bass-anchor",
  name: "Sub-Bass Anchor",
  category: "Open & Stable",
  vco2Ratio: {
    n: 1,
    direction: "above"
  },
  vco1: {
    sub1: 8,
    sub2: 6
  },
  vco2: {
    sub1: 4,
    sub2: 2
  },
  blurb: "VCO1 pushed all the way down via /8 and /6 for genuine sub-bass, VCO2 in unison covering the higher octaves/fourths above it. Useful as a foundation layer under a separate lead voice."
} ];