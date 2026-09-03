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

Object.defineProperty(globalThis, "navigator", {
  value: {},
  configurable: true,
  writable: true
});

globalThis.document = {
  readyState: "complete",
  documentElement: {
    getAttribute: () => "oscilloscope"
  },
  querySelectorAll: () => [],
  getElementById: () => null,
  querySelector: () => null,
  addEventListener: () => {},
  createElement: () => ({
    style: {},
    classList: {
      add() {},
      remove() {}
    },
    appendChild() {},
    addEventListener() {},
    remove() {},
    set innerHTML(v) {},
    set textContent(v) {}
  })
};

globalThis.window = globalThis;

const fs = await (import("node:fs"));

const src = fs.readFileSync(new URL("../shared/session.js", import.meta.url), "utf8");

new Function(src)();

const S = globalThis.TSSession;

let fails = 0;

const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};

check("nothing saved initially", S.getInputDevice(), null);

S.setInputDevice("abc123", "MiniFuse 4");

check("device round-trips", S.getInputDevice(), {
  deviceId: "abc123",
  label: "MiniFuse 4"
});

check("stored under a site-wide key", Object.keys(store), [ "thermalsock.session" ]);

const mkSelect = values => ({
  options: values.map(v => ({
    value: v,
    textContent: v
  })),
  value: null
});

let sel = mkSelect([ "other", "abc123" ]);

check("applies to a matching select", S.applyToDeviceSelect(sel), "MiniFuse 4");

check("select value was set", sel.value, "abc123");

sel = mkSelect([ "someone-else", "another" ]);

check("no match returns null", S.applyToDeviceSelect(sel), null);

check("select left untouched", sel.value, null);

S.clearInputDevice();

check("cleared", S.getInputDevice(), null);

check("clearing leaves the key present but empty", typeof store["thermalsock.session"], "string");

store["thermalsock.session"] = "{not json";

check("survives corrupt storage", S.getInputDevice(), null);

const granted = await S.micPermissionGranted();

check("missing Permissions API resolves false", granted, false);

console.log(fails === 0 ? "\n✓ all session tests passed" : `\n✗ ${fails} failure(s)`);

process.exit(fails === 0 ? 0 : 1);