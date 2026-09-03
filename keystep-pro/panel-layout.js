(function() {
  "use strict";
  var VIEW = {
    w: 2628,
    h: 961
  };
  var C = {
    bodyTop: "#F7F9FA",
    body: "#F4F6F8",
    bodyEdge: "#C9CDD0",
    greyPanel: "#CBCECD",
    greyEdge: "#B4B8B8",
    bar: "#272B2E",
    barEdge: "#1A1D20",
    btnFace: "#DCDEDF",
    btnFaceLo: "#C6C9CA",
    btnEdge: "#4A4E50",
    btnFaceOnGrey: "#BFC2C2",
    ink: "#2A2D2F",
    inkSoft: "#6E7376",
    blue: "#4E93CE",
    white: "#FDFDFD",
    ledOff: "#63666A",
    ledOffDim: "#8D9194",
    red: "#DE2D3F",
    redGlow: "#FF4A5C",
    green: "#4E8B52",
    cyan: "#57D6E0",
    knobTop: "#54585E",
    knobMid: "#3A3E44",
    knobLow: "#2B2F34",
    keyWhite: "#F4F6F7",
    keyWhiteLo: "#DCDFE1",
    keyBlack: "#303030",
    keyBlackLo: "#1A1A1A",
    strip: "#F0F5F5",
    stripEdge: "#D5DADA"
  };
  var TRACKS = [ {
    id: 1,
    name: "Track 1",
    colour: "#00AA80",
    dark: "#008A66",
    ink: "#0B3A2E"
  }, {
    id: 2,
    name: "Track 2",
    colour: "#EE4C22",
    dark: "#C93C18",
    ink: "#4A1607"
  }, {
    id: 3,
    name: "Track 3",
    colour: "#EDC52C",
    dark: "#D0A81A",
    ink: "#453705"
  }, {
    id: 4,
    name: "Track 4",
    colour: "#CE0C57",
    dark: "#A80945",
    ink: "#420418"
  } ];
  var BODY = {
    x: 9,
    y: 23,
    w: 2611,
    h: 936,
    r: 22
  };
  var REAR = {
    labelY: 60,
    ruleY: 70,
    groupY: 80,
    icons: [ {
      type: "power",
      cx: 176,
      cy: 55
    }, {
      type: "usb",
      cx: 338,
      cy: 55
    } ],
    nubs: [ {
      x: 178,
      y: 0,
      w: 48,
      h: 26,
      r: 6
    }, {
      x: 604,
      y: 0,
      w: 62,
      h: 34,
      r: 5
    } ],
    singles: [ {
      label: "Sustain",
      cx: 431
    } ],
    groups: [ {
      x0: 510,
      x1: 652,
      group: "METRONOME",
      items: [ "Output", "Level" ]
    }, {
      x0: 694,
      x1: 978,
      group: "MIDI",
      items: [ "Out 2", "Out 1", "In" ]
    }, {
      x0: 1027,
      x1: 1230,
      group: "CLOCK",
      items: [ "Reset Out", "Out", "In" ]
    }, {
      x0: 1268,
      x1: 1702,
      group: "DRUM GATES",
      items: [ "8", "7", "6", "5", "4", "3", "2", "1" ]
    }, {
      x0: 1753,
      x1: 1899,
      group: "VOICE 4",
      items: [ "Gate", "Velo / Mod", "Pitch" ]
    }, {
      x0: 1950,
      x1: 2096,
      group: "VOICE 3",
      items: [ "Gate", "Velo / Mod", "Pitch" ]
    }, {
      x0: 2147,
      x1: 2294,
      group: "VOICE 2",
      items: [ "Gate", "Velo / Mod", "Pitch" ]
    }, {
      x0: 2344,
      x1: 2491,
      group: "VOICE 1",
      items: [ "Gate", "Velo / Mod", "Pitch" ]
    } ]
  };
  var BAR = {
    x: 64,
    y: 117,
    w: 1278,
    h: 136,
    lozengeTop: 82,
    lozengeFlatTo: 340,
    lozengeStepTo: 392,
    path: "M 64 253 L 64 96 Q 64 82 78 82 L 340 82 Q 358 82 368 96 L 380 112 Q 385 117 393 117 L 1342 117 L 1342 253 Z"
  };
  var GREY = {
    x: 64,
    y: 253,
    w: 642,
    h: 183,
    divider: 490
  };
  var LOGO = {
    x: 88,
    baseline: 117,
    size: 40,
    width: 212,
    subBaseline: 136,
    subSize: 15,
    subWidth: 143
  };
  var BAR_KNOBS = [ {
    id: "tempo",
    cx: 169.5,
    cy: 186,
    r: 35,
    label: "Tempo /",
    alt: "Fine"
  }, {
    id: "swing",
    cx: 381,
    cy: 186,
    r: 35,
    label: "Swing /",
    alt: "Offset"
  } ];
  var TAP = {
    x: 243,
    y: 153,
    w: 65,
    h: 65,
    r: 7,
    lines: [ "Tap", "Tempo" ],
    lineY: [ 186, 204 ],
    alt: "Metronome"
  };
  var SELECTOR = {
    id: "selector",
    cx: 661,
    cy: 186,
    r: 35
  };
  var SEQBOX = {
    x: 502,
    y: 159,
    w: 103,
    h: 57
  };
  var DISPLAYS = {
    y: 164,
    w: 68,
    h: 46,
    baseline: 204,
    size: 48,
    items: [ {
      track: 1,
      cx: 784.5,
      value: "6"
    }, {
      track: 2,
      cx: 944.5,
      value: "13"
    }, {
      track: 3,
      cx: 1103.5,
      value: "15"
    }, {
      track: 4,
      cx: 1263.5,
      value: "9"
    } ]
  };
  var BLOCK = {
    x0: 706,
    pitch: 159.7,
    w: 157,
    tabY: 117,
    tabH: 14,
    y: 253,
    h: 181,
    btnW: 57,
    btnH: 24,
    colX: [ 15, 86 ],
    rowY: {
      arrows: 266,
      mode: 299,
      mute: 347
    },
    trackBtn: {
      dx: 14,
      w: 130,
      y: 396,
      h: 27
    },
    noteLed: {
      dx: 34,
      y: 347,
      w: 24,
      h: 12
    },
    noteLabel: {
      dx: 46,
      y: 372
    },
    modes: [ [ "Seq", "Drum" ], [ "Seq", "Arp" ], [ "Seq", "Arp" ], [ "Seq", "Arp" ] ]
  };
  var UTILITY = {
    cols: [ 532, 603 ],
    w: 60,
    h: 27,
    rows: [ {
      y: 263,
      labels: [ "Project", "Exit" ],
      alts: [ "Utility", "Undo" ],
      altY: 303
    }, {
      y: 311,
      labels: [ "Copy", "Paste" ]
    }, {
      y: 345,
      labels: [ "Save", "Erase" ]
    } ],
    control: {
      x: 531,
      y: 396,
      w: 133,
      h: 27,
      label: "Control"
    }
  };
  var TRANSPORT = {
    y: 304,
    h: 66,
    altY: 389,
    items: [ {
      id: "shift",
      x: 103,
      w: 66,
      kind: "shift",
      label: "Shift"
    }, {
      id: "rec",
      x: 196,
      w: 66,
      kind: "circle",
      alt: "Quant"
    }, {
      id: "stop",
      x: 288,
      w: 67,
      kind: "square"
    }, {
      id: "play",
      x: 381,
      w: 80,
      kind: "play",
      alt: "Restart"
    } ]
  };
  var SCP = {
    x: 1376,
    w: 67,
    h: 27,
    items: [ {
      id: "scene",
      y: 126,
      label: "Scene"
    }, {
      id: "chain",
      y: 172,
      label: "Chain"
    }, {
      id: "pattern",
      y: 219,
      label: "Pattern"
    } ]
  };
  var STEP_EDIT = {
    x: 1359,
    y: 325,
    w: 61,
    h: 27,
    label: "Step Edit"
  };
  var ENCODERS = {
    cy: 186,
    r: 35,
    ringR: 53.3,
    ledR: 4.6,
    startAngle: -260.1,
    stepAngle: 18.9,
    count: 19,
    labelY: 255,
    labelSize: 14,
    items: [ {
      id: "pitch",
      cx: 1533,
      label: "Pitch"
    }, {
      id: "gate",
      cx: 1675,
      label: "Gate"
    }, {
      id: "velocity",
      cx: 1817,
      label: "Velocity"
    }, {
      id: "timeshift",
      cx: 1959,
      label: "Time Shift"
    }, {
      id: "randomness",
      cx: 2100.5,
      label: "Randomness"
    } ]
  };
  var LASTSTEP = {
    y: 172,
    w: 61,
    h: 27,
    altY: 216,
    items: [ {
      id: "lststep",
      x: 2212,
      label: "Lst Step",
      alt: "Follow"
    }, {
      id: "len16",
      x: 2288,
      label: "16"
    }, {
      id: "len32",
      x: 2355,
      label: "32"
    }, {
      id: "len48",
      x: 2423,
      label: "48"
    }, {
      id: "len64",
      x: 2490,
      label: "64"
    } ],
    extend: {
      x0: 2288,
      x1: 2551,
      label: "Extend"
    }
  };
  var ARTURIA = {
    cx: 2419.5,
    baseline: 130,
    size: 40,
    width: 230,
    regDx: 124,
    regDy: 26,
    subCx: 2416.5,
    subBaseline: 143,
    subSize: 12,
    subWidth: 224
  };
  var STEPS = {
    x0: 1440,
    pitch: 70.93,
    w: 56,
    y: 298,
    h: 71,
    r: 8,
    numY: 357,
    numSize: 23,
    ruleY: 363,
    labelY: 390,
    labelSize: 13,
    underlined: [ 1, 5, 9, 13 ],
    labels: [ "Clr Ptn", "Clr Steps", "Nudge <", "Nudge >", "Invert", "Semi Up", "Semi Down", "Oct Up", "Oct Down", "Qnt 50%", "Qnt 100%", "Rand Order", "Rand Notes", "Rand Oct", "Global BPM", "Wait Load" ]
  };
  var OCTAVE = {
    ledY: 468,
    ledW: 18,
    ledH: 11,
    leds: [ {
      x: 124,
      label: "-2"
    }, {
      x: 161,
      label: "-1"
    }, {
      x: 198,
      label: "0"
    }, {
      x: 237,
      label: "+1"
    }, {
      x: 274,
      label: "+2"
    } ],
    active: 2,
    labelY: 461,
    captionY: 500,
    arrows: [ {
      id: "octdown",
      x: 125,
      y: 504,
      w: 68,
      h: 43,
      dir: "left"
    }, {
      id: "octup",
      x: 223,
      y: 504,
      w: 67,
      h: 43,
      dir: "right"
    } ],
    resetY: 566,
    resetTextY: 572
  };
  var STRIPS = {
    y: 574,
    h: 246,
    r: 12,
    items: [ {
      id: "pitchbend",
      x: 123,
      w: 73,
      glyph: "updown"
    }, {
      id: "mod",
      x: 220,
      w: 74,
      glyph: "up"
    } ],
    ledCols: [ {
      x: 96,
      n: 9,
      y0: 577,
      pitch: 28.9,
      w: 10,
      lit: [ 4 ]
    }, {
      x: 310,
      n: 9,
      y0: 577,
      pitch: 28.9,
      w: 10,
      lit: [ 4, 5, 6, 7, 8 ],
      green: [ 3 ]
    } ]
  };
  var SIDE_BTNS = {
    x: 359,
    w: 61,
    h: 27,
    altDy: 42,
    items: [ {
      id: "hold",
      y: 567,
      label: "Hold",
      alt: "Clear"
    }, {
      id: "trans",
      y: 643,
      label: "Trans",
      alt: "Clear"
    }, {
      id: "tierest",
      y: 719,
      label: "Tie/ Rest",
      alt: "Chord"
    }, {
      id: "overdub",
      y: 795,
      label: "Overdub"
    } ]
  };
  var GHOST = {
    tray: {
      x: 84,
      y: 845,
      w: 358,
      h: 62,
      r: 10
    },
    pads: [ {
      x: 90,
      label: "1/4"
    }, {
      x: 177.5,
      label: "1/8"
    }, {
      x: 265,
      label: "1/16"
    }, {
      x: 352.5,
      label: "1/32"
    } ],
    padW: 85,
    padY: 852,
    padH: 50
  };
  var MATRIX = {
    x0: 363,
    y0: 483,
    dx: 16,
    dy: 7.3,
    cols: 4,
    rows: 5,
    r: 2.7
  };
  var STRIP_X = [ 527.5, 580.5, 636.5, 692.5, 745.5, 804.5, 854.5, 908.5, 962.5, 1015.5, 1069.5, 1119.5, 1178.5, 1231.5, 1287.5, 1344, 1396.5, 1455.5, 1506.5, 1559.5, 1613.5, 1667, 1720.5, 1771.5, 1830.5, 1882.5, 1939.5, 1995.5, 2048.5, 2106.5, 2157.5, 2211, 2264.5, 2318.5, 2371.5, 2422.5, 2497.5 ];
  var LABEL_STRIP = {
    ledY: 487,
    ledR: 4.6,
    headerY: 476,
    headerDx: 5,
    labelY: 504,
    arrowL: {
      cx: 484,
      cy: 487
    },
    arrowR: {
      cx: 2557,
      cy: 487
    },
    x: STRIP_X,
    lit: {
      15: "cyan"
    },
    labels: [ "Fwd", "Rand", "Walk", "Mono", "Poly", "Up", "Down", "Exclu", "Inclu", "Rand", "Order", "Poly", "-1", "0", "+1", "+2", "+3", "1/4", "1/8", "1/16", "1/32", "Triplet", "Chrom", "Major", "Minor", "Dorian", "Mixo", "H.Min", "Blues", "Root", "User 1", "User 2", "1", "2", "3", "4", "" ],
    groups: [ {
      at: 0,
      tick: 505,
      title: "Seq Pattern"
    }, {
      at: 3,
      tick: 664.5,
      title: "Seq / Drum Mode"
    }, {
      at: 5,
      tick: 775,
      title: "Arp Pattern"
    }, {
      at: 12,
      tick: 1149,
      title: "Arp Octave"
    }, {
      at: 17,
      tick: 1426,
      title: "Time Division"
    }, {
      at: 22,
      tick: 1693.75,
      title: "Scale"
    }, {
      at: 32,
      tick: 2237.75,
      title: "CV Routing"
    } ],
    tickTop: 458,
    tickH: 22
  };
  var KEYS = {
    x: 490,
    y: 515,
    w: 2061,
    h: 397,
    frame: 9,
    whiteTop: 515,
    whiteBottom: 912,
    seps: [ 588, 681, 774, 867, 960, 1053, 1146, 1239, 1332, 1425, 1518, 1611, 1704, 1797, 1890, 1983, 2076, 2169, 2262, 2355, 2448 ],
    blackW: 49,
    blackTop: 515,
    blackBottom: 766,
    blackX: [ 556, 668, 830, 937, 1045, 1207, 1319, 1482, 1589, 1696, 1858, 1971, 2133, 2240, 2347 ],
    lowNote: 36
  };
  window.KSPLayout = {
    view: VIEW,
    colours: C,
    tracks: TRACKS,
    body: BODY,
    rear: REAR,
    bar: BAR,
    grey: GREY,
    logo: LOGO,
    barKnobs: BAR_KNOBS,
    tap: TAP,
    selector: SELECTOR,
    seqBox: SEQBOX,
    displays: DISPLAYS,
    block: BLOCK,
    utility: UTILITY,
    transport: TRANSPORT,
    scp: SCP,
    stepEdit: STEP_EDIT,
    encoders: ENCODERS,
    lastStep: LASTSTEP,
    arturia: ARTURIA,
    steps: STEPS,
    octave: OCTAVE,
    strips: STRIPS,
    sideBtns: SIDE_BTNS,
    ghost: GHOST,
    matrix: MATRIX,
    labelStrip: LABEL_STRIP,
    keys: KEYS
  };
})();