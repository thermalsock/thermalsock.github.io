(function() {
  "use strict";
  var G = window.KSPGen;
  var P = window.KSPPoly;
  function base(extra) {
    return Object.assign({
      style: "motorik",
      role: "lead",
      scale: "minor",
      root: 2,
      octave: 3,
      seed: 20250,
      density: .75,
      range: 2,
      phrasing: "through"
    }, extra || {});
  }
  function gen(extra) {
    return G.generate(base(extra));
  }
  function map(pattern, fn) {
    var copy = JSON.parse(JSON.stringify(pattern));
    copy.steps.forEach(function(s, i) {
      if (!s.rest) fn(s, i);
    });
    return copy;
  }
  var GROUPS = [ {
    id: "rhythm",
    name: "Rhythm",
    blurb: "Where the notes fall, how long they last, and how hard they hit."
  }, {
    id: "pitch",
    name: "Pitch",
    blurb: "Choosing which note comes next, and why some choices sound composed."
  }, {
    id: "structure",
    name: "Structure",
    blurb: "How phrases relate to each other over more than one bar."
  }, {
    id: "styles",
    name: "Styles",
    blurb: "Same seed, same key, different rule set. The difference you hear is the definition."
  }, {
    id: "poly",
    name: "Polyrhythm",
    blurb: "Two pulses at once, and what separates it from parts merely drifting."
  } ];
  var ENTRIES = [ {
    id: "accent",
    group: "rhythm",
    title: "Metric accent",
    blurb: "Sixteen identical notes are a test tone. The only thing separating that from music is which ones you lean on. Strike the first of every four harder and a pulse appears out of nothing — no change of pitch, no change of rhythm, just weight. Every groove in every style below is built on this one effect.",
    listenFor: "The bar appearing. In A you cannot tell where it starts; in B you can count it.",
    heardOn: [ {
      work: "Any drum machine ever built",
      note: "the accent switch on a TR-808 exists for exactly this reason"
    } ],
    a: {
      label: "Flat velocity",
      build: function() {
        return map(gen({
          style: "trance",
          density: 1
        }), function(s) {
          s.vel = 90;
          s.accent = false;
        });
      }
    },
    b: {
      label: "Metric accent",
      build: function() {
        return map(gen({
          style: "trance",
          density: 1
        }), function(s, i) {
          s.vel = i % 4 === 0 ? 120 : i % 2 === 0 ? 92 : 74;
          s.accent = s.vel > 100;
        });
      }
    }
  }, {
    id: "gate",
    group: "rhythm",
    title: "Gate length",
    blurb: "Gate is how long a note holds before it lets go, as a proportion of its step. Identical notes at a short gate sound urgent and detached; at a long gate they run into each other and the line becomes legato. On the KeyStep Pro this is the Gate encoder, and it changes the character of a sequence more than almost anything else you can do to it.",
    listenFor: "Same pitches, same timing. Only the space between them moves.",
    heardOn: [ {
      artist: "Tangerine Dream",
      work: "Phaedra",
      note: "short gates give the sixteenths their nervous, ticking quality"
    }, {
      artist: "Vangelis",
      work: "Blade Runner",
      note: "the opposite extreme — gates so long the notes overlap into chords"
    } ],
    a: {
      label: "Short — 0.2",
      build: function() {
        return map(gen({
          style: "berlin"
        }), function(s) {
          s.gate = .2;
        });
      }
    },
    b: {
      label: "Long — 1.1",
      build: function() {
        return map(gen({
          style: "berlin"
        }), function(s) {
          s.gate = 1.1;
        });
      }
    }
  }, {
    id: "ratchet",
    group: "rhythm",
    title: "Ratcheting",
    blurb: "A ratchet is one step firing more than once — the note retriggers two, three or four times inside its own slot. It is the single most recognisable gesture in modular sequencing, and it works because it briefly doubles or triples the tempo without changing the tempo. Used on one step in eight it is a detail; used on half of them it is a stutter edit.",
    listenFor: "Steps 4 and 12 fire three times in B. The pulse never changes underneath.",
    heardOn: [ {
      artist: "Squarepusher",
      work: "Go Plastic",
      note: "ratcheting taken to its logical end"
    }, {
      work: "Make Noise René, Turing Machine",
      note: "the modular sequencers that made it a vocabulary"
    }, {
      artist: "Kraftwerk",
      work: "Numbers",
      note: "restrained use — one retrigger as punctuation"
    } ],
    a: {
      label: "No ratchets",
      build: function() {
        return map(gen({
          style: "motorik",
          density: .8
        }), function(s) {
          s.ratchet = 1;
        });
      }
    },
    b: {
      label: "Ratchets on 4 and 12",
      build: function() {
        return map(gen({
          style: "motorik",
          density: .8
        }), function(s, i) {
          s.ratchet = i === 3 || i === 11 ? 3 : 1;
        });
      }
    }
  }, {
    id: "swing",
    group: "rhythm",
    title: "Swing",
    blurb: "Swing pushes every second sixteenth later, so pairs of notes stop being equal and start being long-short. A little is groove. A lot is a shuffle. Nothing about the notes changes — only when the off-beats arrive. The KeyStep Pro has this as a global Swing knob, which is why it sits next to Tempo rather than buried in a menu.",
    listenFor: "The off-beats dragging behind. B lopes; A marches.",
    heardOn: [ {
      artist: "Basic Channel",
      work: "Phylyps Trak",
      note: "heavy swing is most of what makes dub techno feel underwater"
    }, {
      artist: "J Dilla",
      work: "Donuts",
      note: "swing pushed past the grid until it sounds like a person"
    } ],
    a: {
      label: "Straight",
      build: function() {
        return map(gen({
          style: "motorik",
          density: .9
        }), function(s) {
          s.shift = 0;
        });
      }
    },
    b: {
      label: "Swung",
      build: function() {
        return map(gen({
          style: "motorik",
          density: .9
        }), function(s, i) {
          s.shift = i % 2 === 1 ? .22 : 0;
        });
      }
    }
  }, {
    id: "micro",
    group: "rhythm",
    title: "Micro-timing",
    blurb: "Swing is systematic; micro-timing is not. Each note is nudged a few percent early or late at random, so nothing lands exactly on the grid. In small amounts it reads as a human playing. In larger amounts it reads as broken, which is the point in IDM. On the hardware this is the Time Shift encoder, per step.",
    listenFor: "B never quite settles. Nothing is wrong with any single note.",
    heardOn: [ {
      artist: "Autechre",
      work: "Tri Repetae",
      note: "grid-adjacent rather than on it"
    }, {
      artist: "Aphex Twin",
      work: "Drukqs",
      note: "timing used as a texture rather than a feel"
    } ],
    a: {
      label: "Quantised",
      build: function() {
        return map(gen({
          style: "idm",
          density: .7
        }), function(s) {
          s.shift = 0;
          s.ratchet = 1;
        });
      }
    },
    b: {
      label: "Shifted",
      build: function() {
        var rng = G.makeRng(4242);
        return map(gen({
          style: "idm",
          density: .7
        }), function(s) {
          s.ratchet = 1;
          s.shift = rng.range(-.22, .22);
        });
      }
    }
  }, {
    id: "sync",
    group: "rhythm",
    title: "Syncopation",
    blurb: "Syncopation puts notes where the beat is not. The metric weighting that made the accent demo work gets inverted: strong positions are avoided and weak ones favoured. The pulse survives in your head even though nothing is playing on it, which is why syncopated lines feel like they are pulling against something.",
    listenFor: "In B the downbeat is often silent, and you still know where it is.",
    heardOn: [ {
      artist: "Model 500",
      work: "No UFOs",
      note: "Detroit basslines built almost entirely off the beat"
    }, {
      artist: "Herbie Hancock",
      work: "Chameleon",
      note: "the textbook syncopated synth bass"
    } ],
    a: {
      label: "On the beat",
      build: function() {
        return gen({
          style: "motorik",
          density: .7
        });
      }
    },
    b: {
      label: "Syncopated",
      build: function() {
        return gen({
          style: "detroit",
          density: .7
        });
      }
    }
  }, {
    id: "density",
    group: "rhythm",
    title: "Density and rest",
    blurb: "The notes you leave out do as much work as the ones you keep. A dense line fills the bar and asks the rest of the arrangement to work around it; a sparse one leaves room and gains weight from the silence. Most beginner sequences are too busy, and the fix is almost never better notes.",
    listenFor: "Which one you would rather put a vocal or a lead over.",
    heardOn: [ {
      artist: "Rhythm & Sound",
      work: "Showcase",
      note: "entire tracks built from what is missing"
    }, {
      artist: "Steve Reich",
      work: "Music for 18 Musicians",
      note: "density as the thing that changes over time"
    } ],
    a: {
      label: "Dense",
      build: function() {
        return gen({
          style: "berlin",
          density: .95
        });
      }
    },
    b: {
      label: "Sparse",
      build: function() {
        return gen({
          style: "berlin",
          density: .3
        });
      }
    }
  }, {
    id: "euclid",
    group: "rhythm",
    title: "Euclidean rhythm",
    blurb: "Given three notes to fit into eight steps, there is a mathematically most-even way to do it. Round each to its nearest step and you get one answer; distribute them as evenly as an uneven number allows and you get another — the tresillo, the backbone of habanera, reggaeton and most Latin music. Godfried Toussaint showed that a startling number of traditional rhythms are exactly these Euclidean patterns. Worth knowing: for some counts the two methods agree exactly. Five over eight is identical either way.",
    listenFor: "One note moves. A puts the third hit on step 6, B on step 7, and that single step is the difference between mechanical and danceable.",
    heardOn: [ {
      work: "E(3,8) — the tresillo",
      note: "the backbone of habanera, reggaeton and half of Latin music"
    }, {
      work: "E(5,8) — the cinquillo",
      note: "Cuban son. Notably, this one is the same under both methods"
    }, {
      work: "E(7,16)",
      note: "Brazilian necklace patterns"
    } ],
    a: {
      label: "Rounded even",
      build: function() {
        return P.build({
          cycle: 8,
          method: "ratio",
          root: 2,
          octave: 3,
          voices: [ {
            pulses: 3,
            pitchMode: "single"
          } ]
        }).voices[0].pattern;
      }
    },
    b: {
      label: "Euclidean E(3,8) — tresillo",
      build: function() {
        return P.build({
          cycle: 8,
          method: "euclid",
          root: 2,
          octave: 3,
          voices: [ {
            pulses: 3,
            pitchMode: "single"
          } ]
        }).voices[0].pattern;
      }
    }
  }, {
    id: "stepwise",
    group: "pitch",
    title: "Stepwise motion against leaps",
    blurb: "Melodies mostly move by step. Leaps are events, and a line made entirely of them stops sounding like a line at all — it sounds like a list of notes in the right key. The generator weights small intervals heavily by default and treats a leap as something to be answered by a step back the other way.",
    listenFor: "A is singable. B is a scale exercise played out of order.",
    heardOn: [ {
      work: "Any hymn tune",
      note: "four-part writing is stepwise almost by law"
    }, {
      artist: "Giorgio Moroder",
      work: "I Feel Love",
      note: "a whole record from a line that barely leaves its neighbours"
    } ],
    a: {
      label: "Stepwise",
      build: function() {
        return gen({
          style: "motorik",
          density: .85
        });
      }
    },
    b: {
      label: "Leaping",
      build: function() {
        return gen({
          style: "arpeggio",
          density: .85,
          range: 3
        });
      }
    }
  }, {
    id: "chordtones",
    group: "pitch",
    title: "Chord tones on strong beats",
    blurb: "Every note here is in the same scale, so nothing is wrong in either version. The difference is placement: in B the notes landing on beats one, two, three and four are chord tones, and the rest are passing material. That single rule is most of what separates writing from wandering.",
    listenFor: "B sounds like it knows what key it is in. A sounds like it is guessing.",
    heardOn: [ {
      work: "Bach chorales",
      note: "the origin of the rule and still the clearest demonstration"
    }, {
      artist: "Juan Atkins",
      work: "Model 500 — Night Drive",
      note: "chord tones on the beat, colour in between"
    } ],
    a: {
      label: "Any scale note",
      build: function() {
        var p = gen({
          style: "berlin",
          density: .85
        });
        var rng = G.makeRng(77), m = p.meta;
        return map(p, function(s) {
          s.degree = rng.int(-2, 7);
          s.notes = [ G.degreeToMidi(s.degree, m.scalePcs, m.rootMidi) ];
        });
      }
    },
    b: {
      label: "Chord tones on the beat",
      build: function() {
        return gen({
          style: "berlin",
          density: .85
        });
      }
    }
  }, {
    id: "intervals",
    group: "pitch",
    title: "Interval pools",
    blurb: "Some styles are not built from stepwise motion at all but from a specific interval repeated. Fifths and ninths give the open, unresolved sound of ambient music; octaves and sevenths give the springing quality of an electro bassline. Choosing the interval before choosing the notes is a compositional decision, not a technical one.",
    listenFor: "B keeps reaching the same distance. It is the interval doing the work, not the melody.",
    heardOn: [ {
      artist: "Brian Eno",
      work: "Music for Airports",
      note: "fifths and fourths, almost nothing else"
    }, {
      artist: "Kraftwerk",
      work: "Trans-Europe Express",
      note: "octave leaps as the identity of the bassline"
    } ],
    a: {
      label: "Stepwise",
      build: function() {
        return gen({
          style: "motorik"
        });
      }
    },
    b: {
      label: "Fifths and ninths",
      build: function() {
        return gen({
          style: "neoambient",
          density: .6,
          octave: 3
        });
      }
    }
  }, {
    id: "passing",
    group: "pitch",
    title: "Chromatic passing tones",
    blurb: "A passing tone is a note outside the key, used on a weak beat to slide between two notes inside it. It is wrong for an instant and right immediately afterwards, and that momentary friction is what makes a bassline sound like it was played rather than assembled. Put one on a strong beat and it stops being a passing tone and starts being a mistake.",
    listenFor: "The half-step approaches leading into the accented notes.",
    heardOn: [ {
      work: "Walking bass, any jazz standard",
      note: "the technique in its purest form"
    }, {
      artist: "Hardfloor",
      work: "Acperience",
      note: "chromatic slides as an acid vocabulary"
    } ],
    a: {
      label: "Diatonic only",
      build: function() {
        return gen({
          style: "detroit",
          role: "bass",
          density: .75
        });
      }
    },
    b: {
      label: "With passing tones",
      build: function() {
        return gen({
          style: "electro",
          role: "bass",
          density: .75
        });
      }
    }
  }, {
    id: "register",
    group: "pitch",
    title: "Register and range",
    blurb: "A line confined to one octave has a shape you can hold in your head. Spread the same material over three and it becomes a texture instead of a melody. Neither is better, but they do different jobs, and a bassline that wanders three octaves will fight whatever is playing above it.",
    listenFor: "A has a shape. B has a range.",
    heardOn: [ {
      artist: "Neu!",
      work: "Hallogallo",
      note: "almost nothing moves, and that is the point"
    }, {
      artist: "Klaus Schulze",
      work: "Timewind",
      note: "wide-register sequences used as landscape"
    } ],
    a: {
      label: "One octave",
      build: function() {
        return gen({
          style: "berlin",
          range: 1
        });
      }
    },
    b: {
      label: "Three octaves",
      build: function() {
        return gen({
          style: "berlin",
          range: 3
        });
      }
    }
  }, {
    id: "mode",
    group: "pitch",
    title: "Mode",
    blurb: "Same root, same rhythm, one note different. Aeolian is the default minor of most electronic music. Phrygian lowers the second degree by a semitone, and that one change is the entire flamenco and Middle Eastern colour. Dorian raises the sixth and sounds hopeful where Aeolian sounds resigned.",
    listenFor: "The second note of the scale. Everything else is identical.",
    heardOn: [ {
      artist: "Vangelis",
      work: "Blade Runner — Tears in Rain",
      note: "modal colour doing the emotional work"
    }, {
      work: "Flamenco cadences",
      note: "Phrygian as an entire tradition"
    } ],
    a: {
      label: "Aeolian (natural minor)",
      build: function() {
        return gen({
          style: "berlin",
          scale: "minor"
        });
      }
    },
    b: {
      label: "Phrygian",
      build: function() {
        return gen({
          style: "berlin",
          scale: "phrygian"
        });
      }
    }
  }, {
    id: "drone",
    group: "pitch",
    title: "Orbiting a root",
    blurb: "Most melodies travel. A drone-based line does not — it circles one note, leaving and returning, so the root is always in earshot even when it is not sounding. This is the mechanism behind most ambient and psychedelic sequencing, and it is why those pieces can run for ten minutes without becoming tiring.",
    listenFor: "B keeps coming home. A goes somewhere.",
    heardOn: [ {
      artist: "Shpongle",
      work: "Are You Shpongled?",
      note: "drone-anchored movement over long spans"
    }, {
      artist: "Terry Riley",
      work: "A Rainbow in Curved Air",
      note: "the ancestor of the whole approach"
    } ],
    a: {
      label: "Travelling",
      build: function() {
        return gen({
          style: "berlin",
          density: .5
        });
      }
    },
    b: {
      label: "Orbiting",
      build: function() {
        return gen({
          style: "psybient",
          density: .5
        });
      }
    }
  }, {
    id: "callresp",
    group: "structure",
    title: "Call and response",
    blurb: "A through-composed line keeps going and never refers back to itself. A call and response states an idea, stops, and answers it. The answer here is the call inverted — mirrored around its opening note — and it resolves to the root so the pair closes. Two bars instead of one, and suddenly there is a conversation instead of a stream.",
    listenFor: "The gap. The silence before the answer is what makes the two halves separate.",
    heardOn: [ {
      work: "Call-and-response is older than recorded music",
      note: "work songs, blues, gospel, the whole lineage"
    }, {
      artist: "Kraftwerk",
      work: "Computer Love",
      note: "phrase and answer at sequencer scale"
    } ],
    a: {
      label: "Through-composed",
      build: function() {
        return gen({
          style: "cinematic",
          phrasing: "through",
          density: .6
        });
      }
    },
    b: {
      label: "Call and response",
      build: function() {
        return gen({
          style: "cinematic",
          phrasing: "callResponse",
          density: .6
        });
      }
    }
  }, {
    id: "answers",
    group: "structure",
    title: "Two kinds of answer",
    blurb: "The relationship between call and answer is a choice, and the choices sound different. An inversion mirrors the call, so the answer feels like a reply from another voice. An echo repeats it an octave down and quieter, so it feels like the same voice trailing off. One is a conversation, the other is a reverb made of notes.",
    listenFor: "Both second bars derive from the same first bar. Only the relationship changes.",
    heardOn: [ {
      artist: "Steve Reich",
      work: "Piano Phase",
      note: "material answering itself is the entire piece"
    }, {
      artist: "Tangerine Dream",
      work: "Rubycon",
      note: "echoed answers used to extend a sequence without new material"
    } ],
    a: {
      label: "Inverted answer",
      build: function() {
        return gen({
          style: "motorik",
          phrasing: "callResponse",
          density: .7
        });
      }
    },
    b: {
      label: "Echoed answer",
      build: function() {
        return gen({
          style: "motorik",
          phrasing: "echo",
          density: .7
        });
      }
    }
  }, {
    id: "resolve",
    group: "structure",
    title: "Resolution",
    blurb: "A phrase ending on the root sounds finished. A phrase ending anywhere else sounds like it wants to continue. That is the whole mechanism of question and answer, and it is entirely about the last note. Loop an unresolved phrase and it drives forward; loop a resolved one and it sits still.",
    listenFor: "The final note of each loop, and whether you want it to keep going.",
    heardOn: [ {
      work: "The perfect cadence",
      note: "four hundred years of music theory in one note"
    }, {
      artist: "Giorgio Moroder",
      work: "The Chase",
      note: "deliberately unresolved loops to keep momentum"
    } ],
    a: {
      label: "Unresolved",
      build: function() {
        return gen({
          style: "motorik",
          phrasing: "twoPart",
          density: .7
        });
      }
    },
    b: {
      label: "Resolved to the root",
      build: function() {
        return gen({
          style: "motorik",
          phrasing: "questionAnswer",
          density: .7
        });
      }
    }
  }, {
    id: "grid",
    group: "structure",
    title: "Phrase length and the bar",
    blurb: "A short answer is short in material, not usually in bar count. Sixteen steps answered by eight steps of notes and eight of silence still loops as a tidy two bars. Sixteen answered by a genuinely eight-step phrase gives a 24-step loop, which at sixteenths is a bar and a half — so every repeat lands somewhere new against anything in four. Both are legitimate. Only one of them is an accident.",
    listenFor: "B slides against itself on every repeat. That is the loop length, not the notes.",
    heardOn: [ {
      artist: "Steve Reich",
      work: "Clapping Music",
      note: "odd loop lengths used entirely on purpose"
    }, {
      artist: "Can",
      work: "Halleluwah",
      note: "phrases that refuse to line up with the bar"
    } ],
    a: {
      label: "Padded to the bar (32)",
      build: function() {
        return gen({
          style: "motorik",
          phrasing: "answer",
          lengthStrategy: "short",
          phraseGrid: 16
        });
      }
    },
    b: {
      label: "Free length (24)",
      build: function() {
        return gen({
          style: "motorik",
          phrasing: "answer",
          lengthStrategy: "short",
          phraseGrid: 0
        });
      }
    }
  }, {
    id: "develop",
    group: "structure",
    title: "Development against repetition",
    blurb: "Four bars of the same sixteen steps is a loop. Four bars where the second transposes, the third displaces its highest note an octave and the fourth returns with a turnaround is a piece of music. The material is identical — what changes is whether anything happens to it.",
    listenFor: "B is recognisably the same idea in all four bars, and none of them are identical.",
    heardOn: [ {
      artist: "Philip Glass",
      work: "Glassworks",
      note: "small transformations of a fixed cell"
    }, {
      artist: "Klaus Schulze",
      work: "Moondawn",
      note: "sequences developed over very long spans"
    } ],
    a: {
      label: "Repeated",
      build: function() {
        var seed16 = gen({
          style: "berlin",
          density: .8
        });
        var four = {
          steps: [],
          meta: Object.assign({}, seed16.meta, {
            length: 64
          })
        };
        for (var i = 0; i < 4; i++) four.steps = four.steps.concat(JSON.parse(JSON.stringify(seed16.steps)));
        return four;
      }
    },
    b: {
      label: "Developed",
      build: function() {
        return G.develop(gen({
          style: "berlin",
          density: .8
        }));
      }
    }
  }, {
    id: "berlin-vs-synth",
    group: "styles",
    title: "Berlin School against Synthwave",
    blurb: "Both are minor-key sequenced electronic music, and they sound nothing alike. Berlin School runs dense sixteenths in a narrow register with short gates and almost no rest — motion as hypnosis. Synthwave takes a two-bar motif, jumps root to fifth to octave, and accents beats one and three so it walks rather than runs.",
    listenFor: "Berlin never stops moving. Synthwave has a gait you could nod to.",
    heardOn: [ {
      artist: "Tangerine Dream",
      work: "Rubycon, Phaedra",
      note: "the Berlin sound at its source"
    }, {
      artist: "Klaus Schulze",
      work: "Timewind",
      note: "the long-form version"
    }, {
      artist: "Com Truise",
      work: "Galactic Melt",
      note: "synthwave with the motif structure very exposed"
    }, {
      artist: "John Carpenter",
      work: "Assault on Precinct 13",
      note: "the ancestor of the whole revival"
    } ],
    a: {
      label: "Berlin School",
      build: function() {
        return gen({
          style: "berlin"
        });
      }
    },
    b: {
      label: "Synthwave",
      build: function() {
        return gen({
          style: "synthwave"
        });
      }
    }
  }, {
    id: "acid-vs-electro",
    group: "styles",
    title: "Acid against Electro",
    blurb: "Two basslines from the same family tree. Acid is one chord, octave jumps, hard accents and slides — its whole identity is the filter, so the notes stay simple. Electro moves through root, octave and seventh with chromatic passing tones, so the line carries the harmony instead of leaving it to a pad.",
    listenFor: "Acid stays put and shouts. Electro walks somewhere.",
    heardOn: [ {
      artist: "Phuture",
      work: "Acid Tracks",
      note: "the record that invented the vocabulary"
    }, {
      artist: "Hardfloor",
      work: "Acperience 1",
      note: "the technique fully formed"
    }, {
      artist: "Cybotron",
      work: "Clear",
      note: "electro basslines with the passing tones audible"
    } ],
    a: {
      label: "Acid",
      build: function() {
        return gen({
          style: "acid",
          role: "bass"
        });
      }
    },
    b: {
      label: "Electro",
      build: function() {
        return gen({
          style: "electro",
          role: "bass"
        });
      }
    }
  }, {
    id: "motorik-vs-break",
    group: "styles",
    title: "Motorik against Breakbeat",
    blurb: "Motorik is a steady pulse with almost no syncopation and very few pitches — forward motion with nothing in its way. Breakbeat inverts that: accents land off the beat, notes are nudged off the grid, and the pitch material comes from the blues scale. One is a motorway, the other is a stumble that resolves.",
    listenFor: "Where the accents sit relative to the pulse.",
    heardOn: [ {
      artist: "Neu!",
      work: "Hallogallo",
      note: "the motorik pulse in its purest form"
    }, {
      artist: "Can",
      work: "Future Days",
      note: "the same pulse, looser"
    }, {
      artist: "LTJ Bukem",
      work: "Logical Progression",
      note: "breakbeat phrasing with melodic sequencing over it"
    } ],
    a: {
      label: "Motorik",
      build: function() {
        return gen({
          style: "motorik"
        });
      }
    },
    b: {
      label: "Breakbeat",
      build: function() {
        return gen({
          style: "breakbeat"
        });
      }
    }
  }, {
    id: "ambient-vs-trance",
    group: "styles",
    title: "Neo-Ambient against Trance Gate",
    blurb: "The two extremes of density. Neo-ambient is sparse, wide-intervalled and long-gated, with suspensions instead of thirds so nothing quite resolves. A trance gate is the opposite in every respect: root and fifth only, every step filled, short gates, hammered. One is weather, the other is a machine.",
    listenFor: "How much silence there is, and how much of the scale gets used.",
    heardOn: [ {
      artist: "Brian Eno",
      work: "Ambient 1: Music for Airports",
      note: "space as the primary material"
    }, {
      artist: "Solar Fields",
      work: "Movements",
      note: "the modern version with sequencing"
    }, {
      artist: "Robert Miles",
      work: "Children",
      note: "the gated root-and-fifth figure at its most famous"
    } ],
    a: {
      label: "Neo-Ambient",
      build: function() {
        return gen({
          style: "neoambient",
          octave: 3
        });
      }
    },
    b: {
      label: "Trance Gate",
      build: function() {
        return gen({
          style: "trance"
        });
      }
    }
  }, {
    id: "additive-vs-phase",
    group: "styles",
    title: "Additive against Phasing",
    blurb: "Two minimalist engines that are often confused. An additive process grows a cell one note at a time — one, then two, then three — so the rhythm changes while the pitches stay put. Phasing keeps the cell identical and lets two copies drift apart, so the pitches stay put and the alignment changes. Glass mostly did the first; Reich made his name on the second.",
    listenFor: "A grows. B repeats a short cell against a longer bar so it lands differently each time.",
    heardOn: [ {
      artist: "Philip Glass",
      work: "Einstein on the Beach",
      note: "additive process as structure"
    }, {
      artist: "Steve Reich",
      work: "Piano Phase",
      note: "two identical parts drifting — the definitive example"
    } ],
    a: {
      label: "Additive",
      build: function() {
        return gen({
          style: "additive"
        });
      }
    },
    b: {
      label: "Phasing cell",
      build: function() {
        return gen({
          style: "phase"
        });
      }
    }
  }, {
    id: "polymeter",
    group: "poly",
    title: "Polymeter against polyrhythm",
    blurb: "These get used interchangeably and they are not the same thing. Polymeter is one pulse with different bar lengths: sixteen steps against fifteen, same tick, parts sliding out of phase over many bars and taking 240 steps to come back. Polyrhythm is different pulses inside the same span: three evenly spaced notes against four, starting together, finishing together, disagreeing throughout.",
    listenFor: "A drifts slowly and never repeats the same way twice. B conflicts immediately and resets every cycle.",
    heardOn: [ {
      artist: "Steve Reich",
      work: "Clapping Music",
      note: "polymeter — one pattern displaced against itself"
    }, {
      work: "West African bell patterns",
      note: "polyrhythm — 3 against 2 as a foundation"
    }, {
      artist: "Meshuggah",
      work: "obZen",
      note: "polymeter at metal tempos, same principle"
    } ],
    dual: true,
    a: {
      label: "Polymeter 16 : 15",
      build: function() {
        var e = G.ensemble({
          preset: "subtle",
          count: 2,
          style: "motorik",
          root: 2,
          seed: 909,
          density: .5
        });
        return [ e.tracks[0].pattern, e.tracks[1].pattern ];
      }
    },
    b: {
      label: "Polyrhythm 3 : 4",
      build: function() {
        var p = P.build({
          cycle: 12,
          method: "ratio",
          root: 2,
          octave: 3,
          voices: [ {
            pulses: 3,
            pitchMode: "single"
          }, {
            pulses: 4,
            pitchMode: "rootFifth"
          } ]
        });
        return [ p.voices[0].pattern, p.voices[1].pattern ];
      }
    }
  }, {
    id: "coprime",
    group: "poly",
    title: "Coprime against shared factor",
    blurb: "Three against four is a genuine cross-rhythm because three and four share no factor — the voices only agree on the downbeat. Four against six looks like a bigger number but shares a factor of two, so it is really two against three wearing extra notes, and it agrees with itself twice as often. If a polyrhythm sounds thinner than you expected, check whether it reduces.",
    listenFor: "How often the two voices land together. B agrees far more than its numbers suggest.",
    heardOn: [ {
      work: "Hemiola",
      note: "3:2 is the oldest cross-rhythm in Western music"
    }, {
      artist: "Aphex Twin",
      work: "Ventolin",
      note: "coprime relationships used to avoid any settling point"
    } ],
    dual: true,
    a: {
      label: "3 : 4 — coprime",
      build: function() {
        var p = P.build({
          cycle: 12,
          method: "ratio",
          root: 2,
          octave: 3,
          voices: [ {
            pulses: 3,
            pitchMode: "single"
          }, {
            pulses: 4,
            pitchMode: "rootFifth"
          } ]
        });
        return [ p.voices[0].pattern, p.voices[1].pattern ];
      }
    },
    b: {
      label: "4 : 6 — reduces to 2 : 3",
      build: function() {
        var p = P.build({
          cycle: 12,
          method: "ratio",
          root: 2,
          octave: 3,
          voices: [ {
            pulses: 4,
            pitchMode: "single"
          }, {
            pulses: 6,
            pitchMode: "rootFifth"
          } ]
        });
        return [ p.voices[0].pattern, p.voices[1].pattern ];
      }
    }
  }, {
    id: "division",
    group: "poly",
    title: "Cross-rhythm from the hardware clock",
    blurb: "The KeyStep Pro gives every track its own Time Division with a Triplet toggle, which means a true polyrhythm needs no clever note placement at all. Set one track to 1/8 and another to 1/8 triplet and you have eight against twelve — a 2:3 cross-rhythm straight off the clock, with both tracks playing every step.",
    listenFor: "Two steady pulses, neither of them wrong, refusing to agree.",
    heardOn: [ {
      work: "Any Afro-Cuban ensemble",
      note: "two players, two subdivisions, no arithmetic required"
    }, {
      artist: "Tony Allen",
      work: "with Fela Kuti",
      note: "subdivisions layered rather than placed"
    } ],
    dual: true,
    a: {
      label: "Both at 1/8",
      build: function() {
        var p = P.build({
          method: "division",
          root: 2,
          octave: 3,
          bars: 1,
          voices: [ {
            division: "e",
            pitchMode: "single"
          }, {
            division: "e",
            pitchMode: "rootFifth"
          } ]
        });
        return [ p.voices[0].pattern, p.voices[1].pattern ];
      }
    },
    b: {
      label: "1/8 against 1/8 triplet",
      build: function() {
        var p = P.build({
          method: "division",
          root: 2,
          octave: 3,
          bars: 1,
          voices: [ {
            division: "e",
            pitchMode: "single"
          }, {
            division: "et",
            pitchMode: "rootFifth"
          } ]
        });
        return [ p.voices[0].pattern, p.voices[1].pattern ];
      }
    }
  } ];
  window.KSPGuide = {
    GROUPS: GROUPS,
    ENTRIES: ENTRIES
  };
})();