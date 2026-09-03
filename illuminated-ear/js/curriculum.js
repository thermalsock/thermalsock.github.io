export const NOTE_NAMES = [ "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" ];

export const INTERVALS = [ {
  semitones: 0,
  name: "Unison",
  short: "P1",
  ratio: "1:1",
  quality: "perfect",
  character: "Identity — the same note. No movement, no tension, just confirmation."
}, {
  semitones: 1,
  name: "Minor 2nd",
  short: "m2",
  ratio: "16:15",
  quality: "dissonant",
  character: "Maximum tension in the smallest space. A semitone apart — grating, urgent, the sound of a doorbell or a horror-film cluster. Think of the Jaws theme."
}, {
  semitones: 2,
  name: "Major 2nd",
  short: "M2",
  ratio: "9:8",
  quality: "mild",
  character: "A whole step — still close, but breathable. The sound of a scale moving one note at a time. Neutral, neither happy nor sad, just motion."
}, {
  semitones: 3,
  name: "Minor 3rd",
  short: "m3",
  ratio: "6:5",
  quality: "consonant",
  character: "The sad one. Dark, warm, introspective — this single interval is the entire difference between a major chord and a minor chord. If you can hear this vs. the major 3rd, you can hear major vs. minor."
}, {
  semitones: 4,
  name: "Major 3rd",
  short: "M3",
  ratio: "5:4",
  quality: "consonant",
  character: "The happy one. Bright, warm, resolved — the backbone of every major chord. One semitone wider than the minor 3rd, but the emotional difference is enormous."
}, {
  semitones: 5,
  name: "Perfect 4th",
  short: "P4",
  ratio: "4:3",
  quality: "perfect",
  character: 'Open and expectant — stable, but leaning forward slightly. The first two notes of "Here Comes the Bride" or the NBC chime. Often confused with the 5th; the 4th has more tension, more "wanting to go somewhere."'
}, {
  semitones: 6,
  name: "Tritone",
  short: "TT",
  ratio: "45:32",
  quality: "dissonant",
  character: 'The devil\'s interval. Exactly halfway through the octave — maximally ambiguous, unstable, wants to resolve in either direction. The opening of "The Simpsons" or "Maria" from West Side Story.'
}, {
  semitones: 7,
  name: "Perfect 5th",
  short: "P5",
  ratio: "3:2",
  quality: "perfect",
  character: 'The most stable interval after the octave. Open, hollow, strong — the sound of a power chord, a church bell, the first two notes of the Star Wars theme. If anything in music sounds "right," it\'s probably built on fifths.'
}, {
  semitones: 8,
  name: "Minor 6th",
  short: "m6",
  ratio: "8:5",
  quality: "consonant",
  character: "Bittersweet and wide. A minor 3rd inverted — the same colour, but stretched across a bigger space. Romantic, yearning."
}, {
  semitones: 9,
  name: "Major 6th",
  short: "M6",
  ratio: "5:3",
  quality: "consonant",
  character: 'Warm and wide. The first two notes of "My Bonnie Lies Over the Ocean." Bright like the major 3rd but more spacious.'
}, {
  semitones: 10,
  name: "Minor 7th",
  short: "m7",
  ratio: "9:5",
  quality: "mild",
  character: 'Bluesy, unresolved, wants to move. The interval that makes a dominant 7th chord feel like it needs to go somewhere. A semitone short of the octave\'s "evil twin."'
}, {
  semitones: 11,
  name: "Major 7th",
  short: "M7",
  ratio: "15:8",
  quality: "dissonant",
  character: 'Bright but tense — one semitone away from the octave, pulling hard toward it. The "jazz" interval. Sophisticated, angular, slightly uncomfortable.'
}, {
  semitones: 12,
  name: "Octave",
  short: "P8",
  ratio: "2:1",
  quality: "perfect",
  character: "The same note, doubled. So consonant it barely registers as a separate pitch — more like a thickening than a harmony. The most fundamental ratio in all of music."
} ];

export function intervalBySemitones(s) {
  return INTERVALS.find(iv => iv.semitones === Math.abs(s) % 13) || INTERVALS[0];
}

export const SCALE_DEGREES = {
  major: [ {
    degree: 1,
    offset: 0,
    name: "Tonic",
    symbol: "I",
    character: "Home. Everything resolves here. The note that makes a phrase feel finished. If you sing a scale and stop on any other note, you'll feel the pull back to this one."
  }, {
    degree: 2,
    offset: 2,
    name: "Supertonic",
    symbol: "ii",
    character: 'One step above home — a stepping stone, not a destination. Mild tension, wants to move either back down to the tonic or up to the 3rd. The "and then..." note.'
  }, {
    degree: 3,
    offset: 4,
    name: "Mediant",
    symbol: "iii",
    character: "The note that defines whether you're in major or minor. Bright, warm, settled — but not as final as the tonic. A resting point, not an ending."
  }, {
    degree: 4,
    offset: 5,
    name: "Subdominant",
    symbol: "IV",
    character: 'Open and broad — a sense of lift, expansion, leaving home without tension. The "amen" chord. Wants to either settle back to the tonic or push forward to the 5th.'
  }, {
    degree: 5,
    offset: 7,
    name: "Dominant",
    symbol: "V",
    character: 'Maximum pull toward the tonic. This is the note that makes music feel like it MUST resolve — the strongest "wanting to go home" in the entire scale. The engine of tonal music.'
  }, {
    degree: 6,
    offset: 9,
    name: "Submediant",
    symbol: "vi",
    character: 'The relative minor — same notes as the major scale but recentred here, it sounds completely different. Bittersweet, reflective. The "plot twist" degree.'
  }, {
    degree: 7,
    offset: 11,
    name: "Leading tone",
    symbol: "vii°",
    character: "One semitone below the tonic, pulling toward it with almost physical force. The most unstable degree — you can feel it leaning upward. This pull is what makes V-I resolutions so satisfying."
  } ],
  minor: [ {
    degree: 1,
    offset: 0,
    name: "Tonic",
    symbol: "i",
    character: "Home, but a darker home. The same sense of finality as the major tonic, but coloured by the minor 3rd above it."
  }, {
    degree: 2,
    offset: 2,
    name: "Supertonic",
    symbol: "ii°",
    character: "More restless than its major counterpart — the diminished chord built on this degree gives it an inherent instability."
  }, {
    degree: 3,
    offset: 3,
    name: "Mediant",
    symbol: "III",
    character: "The relative major — bright, open, a relief from the minor darkness. The note that connects every minor key to its major cousin."
  }, {
    degree: 4,
    offset: 5,
    name: "Subdominant",
    symbol: "iv",
    character: 'Darker than the major subdominant. A minor chord here deepens the melancholy — the "amen" becomes a sigh.'
  }, {
    degree: 5,
    offset: 7,
    name: "Dominant",
    symbol: "v",
    character: "In natural minor, this is a minor chord — it pulls toward the tonic but less forcefully than in major, because there's no leading tone. That's why harmonic minor raises the 7th — to put the pull back."
  }, {
    degree: 6,
    offset: 8,
    name: "Submediant",
    symbol: "VI",
    character: 'A major chord in a minor key — warm and surprising. Often used as a "deceptive" resolution (you expected the tonic, but landed here instead).'
  }, {
    degree: 7,
    offset: 10,
    name: "Subtonic",
    symbol: "VII",
    character: "A whole step below the tonic instead of a half step — no leading-tone pull. This is what gives natural minor its characteristic lack of drive compared to major. The 7th just... sits there, not pulling anywhere."
  } ]
};

export const STAGES = [ {
  id: "pitch",
  name: "Pitch Discrimination",
  desc: "The real foundation — can you tell two tones apart, and which is higher? Most ear-training skips this and jumps straight to intervals, which is like teaching spelling before the alphabet.",
  lessons: [ {
    id: "pitch-wide",
    name: "Wide gaps",
    subtitle: "Octaves and larger",
    listen: {
      text: 'You\'ll hear two tones. The gap between them is large — an octave (12 semitones) or more. Focus on which one feels "higher" in your head, not just louder.',
      examples: [ {
        type: "pair",
        intervals: [ 0, 12 ],
        label: "An octave apart — same note, different register"
      }, {
        type: "pair",
        intervals: [ 0, 7 ],
        label: "A perfect 5th — wide and obvious"
      }, {
        type: "pair",
        intervals: [ 0, -12 ],
        label: "An octave DOWN — the second tone is lower"
      } ]
    },
    understand: "Pitch is how fast air vibrates. A tone at 440 Hz vibrates 440 times per second; its octave at 880 Hz vibrates exactly twice as fast. Your ear resolves this easily at wide gaps — the challenge comes when the gap narrows. Right now we're building the habit of actually *listening for* pitch height rather than loudness or timbre, which your brain can confuse at first.",
    compare: {
      text: "Same vs. different, ascending vs. descending:",
      pairs: [ {
        a: 0,
        b: 12,
        label: "Ascending octave — second is higher"
      }, {
        a: 12,
        b: 0,
        label: "Descending octave — second is lower"
      }, {
        a: 7,
        b: 7,
        label: "Unison — same pitch, no movement"
      } ]
    },
    tryConfig: {
      type: "higher_lower",
      gapRange: [ 5, 12 ],
      count: 6
    }
  }, {
    id: "pitch-medium",
    name: "Medium gaps",
    subtitle: "2–5 semitones",
    listen: {
      text: "The gap narrows. Two to five semitones — close enough that you need to really listen, but still clearly different pitches.",
      examples: [ {
        type: "pair",
        intervals: [ 0, 4 ],
        label: "A major 3rd — 4 semitones"
      }, {
        type: "pair",
        intervals: [ 0, 2 ],
        label: "A major 2nd — 2 semitones, a whole step"
      }, {
        type: "pair",
        intervals: [ 0, 3 ],
        label: "A minor 3rd — 3 semitones"
      } ]
    },
    understand: 'At this range, the two tones are close enough that your ear starts to hear them as *related* rather than just "two separate sounds." This is the sweet spot where interval quality starts to matter — a 3-semitone gap and a 4-semitone gap are only 1 semitone apart, but they sound meaningfully different (minor vs. major). You\'re not just hearing "higher or lower" anymore; you\'re starting to hear *how much* higher or lower.',
    compare: {
      text: "Can you hear the difference between 2 semitones and 3?",
      pairs: [ {
        a: 0,
        b: 2,
        label: "2 semitones (whole step) — open, neutral"
      }, {
        a: 0,
        b: 3,
        label: "3 semitones (minor 3rd) — darker, warmer"
      }, {
        a: 0,
        b: 4,
        label: "4 semitones (major 3rd) — brighter, warmer"
      } ]
    },
    tryConfig: {
      type: "higher_lower",
      gapRange: [ 2, 5 ],
      count: 8
    }
  }, {
    id: "pitch-narrow",
    name: "Narrow gaps",
    subtitle: "1–2 semitones",
    listen: {
      text: "Now the hard part. One semitone is the smallest step in standard Western tuning — a single piano key. Can you reliably tell the difference?",
      examples: [ {
        type: "pair",
        intervals: [ 0, 1 ],
        label: "1 semitone (half step) — barely different, but real"
      }, {
        type: "pair",
        intervals: [ 0, 2 ],
        label: "2 semitones (whole step) — for comparison, this is twice as wide"
      }, {
        type: "pair",
        intervals: [ 0, -1 ],
        label: "1 semitone DOWN — same tiny gap, opposite direction"
      } ]
    },
    understand: 'A single semitone is about a 6% frequency change. Most untrained listeners can detect a gap this small but often guess the *direction* wrong — they hear "different" but not reliably "higher" or "lower." If you can consistently get the direction right at 1 semitone, your pitch discrimination is genuinely good. Professional musicians typically resolve down to about 5–10 cents (a tenth to a twentieth of a semitone).',
    compare: {
      text: "Same, one semitone apart, or two?",
      pairs: [ {
        a: 5,
        b: 5,
        label: "Unison — identical"
      }, {
        a: 5,
        b: 6,
        label: "1 semitone up"
      }, {
        a: 5,
        b: 7,
        label: "2 semitones up"
      } ]
    },
    tryConfig: {
      type: "higher_lower",
      gapRange: [ 1, 2 ],
      count: 10
    }
  } ]
}, {
  id: "intervals",
  name: "Interval Recognition",
  desc: 'Not "repeat this interval" but "this is what a perfect fifth sounds like, and here\'s why." Each interval has a character — learn the character, not just the name.',
  lessons: [ {
    id: "int-perfect",
    name: "The perfect intervals",
    subtitle: "Unison, 4th, 5th, octave",
    listen: {
      text: 'The "perfect" intervals — unison (P1), fourth (P4), fifth (P5), and octave (P8) — are called that because they sound stable and pure. They\'re the bones of music; everything else hangs on them.',
      examples: [ {
        type: "interval",
        semitones: 0,
        label: "Unison — identity, no movement"
      }, {
        type: "interval",
        semitones: 5,
        label: 'Perfect 4th — open, expectant ("Here Comes the Bride")'
      }, {
        type: "interval",
        semitones: 7,
        label: 'Perfect 5th — strong, hollow ("Star Wars" theme)'
      }, {
        type: "interval",
        semitones: 12,
        label: "Octave — same note doubled, the most fundamental ratio"
      } ]
    },
    understand: "The perfect intervals have the simplest frequency ratios: 1:1, 4:3, 3:2, 2:1. Simple ratios = consonant sound. Your ear evolved to recognise these because they're the loudest overtones in any natural sound — when you hear a voice or a string, the 2nd, 3rd, and 4th harmonics are already producing octaves, fifths, and fourths above the fundamental. You've been hearing these intervals your entire life inside every single sound.",
    compare: {
      text: "The 4th and the 5th are the most commonly confused pair. Listen carefully:",
      pairs: [ {
        a: 0,
        b: 5,
        label: "Perfect 4th — leaning forward, wants to go somewhere"
      }, {
        a: 0,
        b: 7,
        label: "Perfect 5th — settled, complete, doesn't need to move"
      }, {
        a: 0,
        b: 5,
        label: "4th again — hear the restlessness compared to the 5th?"
      } ]
    },
    tryConfig: {
      type: "identify_interval",
      intervals: [ 0, 5, 7, 12 ],
      count: 8
    }
  }, {
    id: "int-thirds",
    name: "Major and minor thirds",
    subtitle: "The colour of chords",
    listen: {
      text: "The 3rd is the single most important interval for harmony — it determines whether a chord sounds major (bright) or minor (dark). One semitone difference, enormous emotional difference.",
      examples: [ {
        type: "interval",
        semitones: 3,
        label: "Minor 3rd — dark, warm, melancholic"
      }, {
        type: "interval",
        semitones: 4,
        label: "Major 3rd — bright, warm, joyful"
      }, {
        type: "interval",
        semitones: 3,
        label: "Minor 3rd again — compare with the one above"
      } ]
    },
    understand: 'The minor 3rd is 3 semitones (ratio 6:5). The major 3rd is 4 semitones (ratio 5:4). That single semitone is the entire emotional difference between "happy birthday" and a funeral march. Every chord, every key, every mode — the quality comes down to which third it uses. If you learn one interval by ear, make it this one.',
    compare: {
      text: "Major vs minor, ascending vs descending:",
      pairs: [ {
        a: 0,
        b: 3,
        label: "Minor 3rd ascending — dark"
      }, {
        a: 0,
        b: 4,
        label: "Major 3rd ascending — bright"
      }, {
        a: 7,
        b: 4,
        label: "Minor 3rd descending (from the 5th down) — same quality, opposite direction"
      } ]
    },
    tryConfig: {
      type: "identify_interval",
      intervals: [ 3, 4 ],
      count: 8
    }
  }, {
    id: "int-seconds",
    name: "Steps: major and minor 2nds",
    subtitle: "The building blocks of melody",
    listen: {
      text: "Seconds are the smallest melodic steps — the notes right next to each other on a keyboard. A half step (minor 2nd) is one key; a whole step (major 2nd) is two keys with one skipped.",
      examples: [ {
        type: "interval",
        semitones: 1,
        label: 'Minor 2nd — tense, grating, "Jaws" theme'
      }, {
        type: "interval",
        semitones: 2,
        label: "Major 2nd — neutral, a scale step"
      } ]
    },
    understand: "Seconds are what melodies are mostly made of — most melodic movement is stepwise (seconds), not leaps. The minor 2nd (semitone) is the most dissonant interval in music — two notes so close that they almost merge into beating/roughness rather than harmony. The major 2nd (whole tone) is already much smoother. Debussy built entire pieces out of whole-tone scales specifically because they avoid the tension of semitones.",
    compare: {
      text: "Semitone vs whole tone:",
      pairs: [ {
        a: 0,
        b: 1,
        label: "Half step — maximum closeness, tense"
      }, {
        a: 0,
        b: 2,
        label: "Whole step — still close, but breathable"
      } ]
    },
    tryConfig: {
      type: "identify_interval",
      intervals: [ 1, 2 ],
      count: 6
    }
  }, {
    id: "int-tensions",
    name: "Tension intervals",
    subtitle: "Tritone, 7ths",
    listen: {
      text: "These are the intervals that make music feel unresolved — the ones that pull toward a resolution.",
      examples: [ {
        type: "interval",
        semitones: 6,
        label: 'Tritone — unstable, ambiguous, the "devil\'s interval"'
      }, {
        type: "interval",
        semitones: 10,
        label: "Minor 7th — bluesy, leaning"
      }, {
        type: "interval",
        semitones: 11,
        label: "Major 7th — bright but tense, jazzy"
      } ]
    },
    understand: "The tritone divides the octave exactly in half — it's equidistant from the tonic in both directions, which is why it feels so unsettled (it doesn't \"belong\" to either side). The 7ths are both one step from the octave — the major 7th is just a semitone short, pulling hard upward; the minor 7th is a whole step short, leaning but less urgently. These intervals are what give dominant and diminished chords their restless character.",
    compare: {
      text: "The tritone vs the 5th — stability vs instability:",
      pairs: [ {
        a: 0,
        b: 7,
        label: "Perfect 5th — stable, complete"
      }, {
        a: 0,
        b: 6,
        label: "Tritone — one semitone narrower, completely different character"
      }, {
        a: 0,
        b: 10,
        label: "Minor 7th — for comparison, wide and bluesy"
      } ]
    },
    tryConfig: {
      type: "identify_interval",
      intervals: [ 6, 10, 11 ],
      count: 8
    }
  }, {
    id: "int-all",
    name: "All intervals",
    subtitle: "The full set",
    listen: {
      text: "Putting it all together. You'll hear intervals from across the full chromatic range — can you identify them by ear?",
      examples: [ {
        type: "interval",
        semitones: 8,
        label: "Minor 6th — wide, bittersweet"
      }, {
        type: "interval",
        semitones: 9,
        label: 'Major 6th — wide, warm ("My Bonnie")'
      }, {
        type: "interval",
        semitones: 5,
        label: "Perfect 4th — for reference"
      } ]
    },
    understand: 'You now have the full set: unison, minor/major 2nd, minor/major 3rd, perfect 4th, tritone, perfect 5th, minor/major 6th, minor/major 7th, octave. Thirteen intervals (including unison and octave). In practice, recognition comes from learning *families*: perfect intervals (stable), 3rds (colour), 2nds (steps), 6ths (wide 3rds), 7ths (tension), and the tritone (chaos). When you hear an interval, first ask "is it stable, coloured, or tense?" — that narrows it to 2–3 options immediately.',
    compare: {
      text: "6ths are inverted 3rds — same colour, wider:",
      pairs: [ {
        a: 0,
        b: 3,
        label: "Minor 3rd — dark, close"
      }, {
        a: 0,
        b: 8,
        label: "Minor 6th — same darkness, wider apart"
      }, {
        a: 0,
        b: 4,
        label: "Major 3rd — bright, close"
      }, {
        a: 0,
        b: 9,
        label: "Major 6th — same brightness, wider apart"
      } ]
    },
    tryConfig: {
      type: "identify_interval",
      intervals: [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 ],
      count: 10
    }
  } ]
}, {
  id: "degrees",
  name: "Scale Degree Function",
  desc: 'How each note functions in a key — not just what interval it makes with the root, but where it wants to go. The 5th doesn\'t just "sound stable" — it actively pulls toward the tonic. The 7th doesn\'t just "sound tense" — it\'s one semitone away from home and leaning hard.',
  lessons: [ {
    id: "deg-tonic-dominant",
    name: "Home and away",
    subtitle: "Tonic (1) and Dominant (5)",
    listen: {
      text: "The tonic is home — every phrase wants to end here. The dominant is its opposite — maximum pull toward home. Together, they're the most fundamental tension-resolution pair in all of tonal music.",
      examples: [ {
        type: "degree",
        offset: 0,
        label: "The tonic — home, rest, arrival"
      }, {
        type: "degree",
        offset: 7,
        label: 'The dominant — tension, pull, "not home yet"'
      }, {
        type: "degree_move",
        from: 7,
        to: 0,
        label: "Dominant resolving to tonic — hear the relief?"
      } ]
    },
    understand: "Play or sing a major scale and stop on the 5th degree. Hold it. Feel the pull downward to the tonic. That pull is the engine of Western music — nearly every phrase, every cadence, every song landing is some version of V → I (dominant to tonic). It works because the 5th is a perfect fifth above the root (the most consonant non-octave interval) but sits in a context where it's not *the* root — close to home, but not home.",
    compare: {
      text: "Tonic vs dominant — rest vs pull:",
      pairs: [ {
        a: -1,
        b: 0,
        label: "Arriving at the tonic from below — hear the finality"
      }, {
        a: -1,
        b: 7,
        label: "Arriving at the dominant from below — stable, but not finished"
      } ]
    },
    tryConfig: {
      type: "identify_degree",
      degrees: [ 0, 7 ],
      scale: "major",
      count: 8
    }
  }, {
    id: "deg-third",
    name: "The colour note",
    subtitle: "The 3rd degree",
    listen: {
      text: "The 3rd degree defines whether you're in major or minor. It's the single most expressive note in any scale.",
      examples: [ {
        type: "degree_in_context",
        offset: 4,
        context: [ 0, 4, 7, 4, 0 ],
        label: "Major 3rd in a major context — bright, settled"
      }, {
        type: "degree_in_context",
        offset: 3,
        context: [ 0, 3, 7, 3, 0 ],
        label: "Minor 3rd in a minor context — dark, introspective"
      } ]
    },
    understand: 'The 3rd is called the "mediant" — literally "the middle one" — because it sits between the tonic and the dominant, colouring everything in between. Switch a major 3rd to a minor 3rd (one semitone) and the entire emotional world changes. This is why modes matter: Dorian emphasises a different set of notes than Aeolian, but both have a minor 3rd — it\'s the *other* degrees that distinguish them.',
    compare: {
      text: "Major 3rd vs minor 3rd — the same phrase in two colours:",
      pairs: [ {
        a: 0,
        b: 4,
        label: "Major 3rd — the bright version"
      }, {
        a: 0,
        b: 3,
        label: "Minor 3rd — the dark version"
      } ]
    },
    tryConfig: {
      type: "identify_degree",
      degrees: [ 0, 3, 4, 7 ],
      scale: "major",
      count: 8
    }
  }, {
    id: "deg-tendency",
    name: "Tendency tones",
    subtitle: "4th, 7th, and the pull of resolution",
    listen: {
      text: 'Some degrees are restless — they "want" to move to a neighbouring degree. The 7th pulls up to the tonic; the 4th pulls down to the 3rd. These tendencies are what make melody feel directional rather than random.',
      examples: [ {
        type: "degree_move",
        from: 11,
        to: 0,
        label: "7th resolving up to tonic — hear the pull?"
      }, {
        type: "degree_move",
        from: 5,
        to: 4,
        label: "4th falling to the 3rd — a gentler resolution"
      }, {
        type: "degree_move",
        from: 6,
        to: 7,
        label: "Tritone resolving outward to the 5th"
      } ]
    },
    understand: "Tendency tones explain why melodies don't just wander randomly through a scale. The leading tone (7th degree, 11 semitones above the root) is the strongest tendency — it's a single semitone below home and the pull is almost physical. The 4th degree tends to fall to the 3rd (a gentler pull, but real). The tritone (built between the 4th and 7th degrees of a major scale) resolves both ways simultaneously — the 4th falls to the 3rd while the 7th rises to the tonic. That double resolution is what makes a dominant 7th chord resolve so satisfyingly.",
    compare: {
      text: "Resolved vs unresolved — the same notes, different endings:",
      pairs: [ {
        a: 7,
        b: 11,
        label: "Landing on the leading tone — tense, unfinished"
      }, {
        a: 7,
        b: 0,
        label: "Landing on the tonic — resolved, complete"
      } ]
    },
    tryConfig: {
      type: "identify_degree",
      degrees: [ 0, 4, 5, 7, 11 ],
      scale: "major",
      count: 10
    }
  }, {
    id: "deg-all",
    name: "All seven degrees",
    subtitle: "The full major scale",
    listen: {
      text: "Every degree of the major scale, each with its own function and character. Can you identify where you are in the scale just by how the note feels against the tonic?",
      examples: [ {
        type: "degree",
        offset: 2,
        label: "2nd — the stepping stone"
      }, {
        type: "degree",
        offset: 9,
        label: "6th — warm, wide, the relative minor"
      }, {
        type: "degree",
        offset: 5,
        label: "4th — open, expectant"
      } ]
    },
    understand: "By now you're hearing *function*, not just *pitch*. When a note sounds \"bright and settled,\" that's the 3rd. When it sounds \"wide and warm,\" that's the 6th. When it pulls upward urgently, that's the 7th. This is what makes sight-singing, transcription, and improvisation possible — you're not identifying notes by their absolute frequency, you're hearing their role in the key. This is the ear a musician actually uses.",
    compare: {
      text: 'The "colour" degrees vs the "structural" degrees:',
      pairs: [ {
        a: 0,
        b: 0,
        label: "Tonic — structural, stable"
      }, {
        a: 0,
        b: 4,
        label: "Major 3rd — colour, bright"
      }, {
        a: 0,
        b: 7,
        label: "Dominant — structural, pulling"
      }, {
        a: 0,
        b: 9,
        label: "Major 6th — colour, warm"
      } ]
    },
    tryConfig: {
      type: "identify_degree",
      degrees: [ 0, 2, 4, 5, 7, 9, 11 ],
      scale: "major",
      count: 10
    }
  } ]
} ];

export const ALL_LESSON_IDS = STAGES.flatMap(s => s.lessons.map(l => l.id));