/* Thermalsock Labs — shared app switcher.
 *
 * Previously each app hardcoded its own strip of links. That strip covered
 * 8 of the 11 apps, and three apps (Modulus Studio, Transient Lab, Signal
 * Path) had no strip at all — so landing on one of them was a dead end.
 *
 * This is the single source of truth instead. Every page includes this one
 * file; adding a tool here adds it everywhere. It mounts into an element
 * marked [data-app-switcher] and injects its own styles, so it works the
 * same on the card-based apps and on the canvas-only ones.
 *
 * Plain script (not a module) on purpose — the canvas apps load classic
 * scripts and this has to work identically on every page.
 */
(function () {
  'use strict';

  var APPS = [
    { group: 'Live Processing', items: [
      { id: 'oscilloscope',          name: 'Web Oscilloscope',    blurb: 'Dual-trace scope' },
      { id: 'granulator',            name: 'Granulator',          blurb: 'Granular processor' },
      { id: 'spectral-mutation-lab', name: 'Spectral Lab',        blurb: 'FFT bin mutation' }
    ]},
    { group: 'Composition & Theory', items: [
      { id: 'loom',            name: 'Loom',            blurb: 'Chord & drone engine' },
      { id: 'subharmonicon',   name: 'Subharmonicon',   blurb: 'Ratio tuning aid' },
      { id: 'modulus-studio',  name: 'Modulus Studio',  blurb: 'LFO & envelope modelling' },
      { id: 'sound-design',    name: 'Sound Design',    blurb: 'Take 5 patch reference' },
      { id: 'keystep-pro',     name: 'KeyStep Pro',     blurb: 'Arp & sequence machine' }
    ]},
    { group: 'Training & Games', items: [
      { id: 'illuminated-ear', name: 'The Illuminated Ear', blurb: 'Ear-training game' },
      { id: 'transient-lab',   name: 'Transient Lab',       blurb: 'Ear & hand training' }
    ]},
    { group: 'Studio', items: [
      { id: 'ambient-bloom', name: 'Ambient Bloom', blurb: 'Live visual instrument' },
      { id: 'signal-path',   name: 'Signal Path',   blurb: 'Hardware rig mapper' }
    ]}
  ];

  var CSS = [
    '.ts-switcher{position:relative;font-family:"JetBrains Mono",ui-monospace,monospace;}',
    '.ts-switcher-btn{display:inline-flex;align-items:center;gap:8px;cursor:pointer;',
    '  font-family:inherit;font-size:11.5px;letter-spacing:0.06em;text-transform:uppercase;',
    '  color:var(--ink-soft);background:rgba(43,38,32,0.04);border:1px solid rgba(43,38,32,0.22);',
    '  border-radius:999px;padding:7px 14px;line-height:1;transition:border-color .2s,color .2s,background .2s;}',
    '.ts-switcher-btn:hover{color:var(--ink);border-color:var(--rust);background:rgba(139,74,43,0.08);}',
    '.ts-switcher-btn:focus-visible{outline:2px solid var(--rust);outline-offset:2px;}',
    '.ts-switcher-caret{width:8px;height:8px;flex:none;transition:transform .2s;}',
    '.ts-switcher[data-open="true"] .ts-switcher-caret{transform:rotate(180deg);}',
    '.ts-switcher-panel{position:absolute;top:calc(100% + 10px);right:0;z-index:9999;',
    '  min-width:280px;max-width:min(340px,calc(100vw - 32px));max-height:min(70vh,520px);overflow-y:auto;',
    '  background:var(--paper);border:1px solid rgba(43,38,32,0.22);border-radius:12px;',
    '  box-shadow:0 12px 34px rgba(43,38,32,0.20);padding:10px;',
    '  opacity:0;visibility:hidden;transform:translateY(-6px);transition:opacity .18s,transform .18s,visibility .18s;}',
    '.ts-switcher[data-open="true"] .ts-switcher-panel{opacity:1;visibility:visible;transform:translateY(0);}',
    '.ts-switcher-group{font-size:9.5px;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-faint);',
    '  padding:10px 10px 6px 10px;}',
    '.ts-switcher-group:first-child{padding-top:4px;}',
    '.ts-switcher-link{display:block;text-decoration:none;color:var(--ink);padding:7px 10px;border-radius:7px;',
    '  transition:background .15s;}',
    '.ts-switcher-link:hover{background:rgba(139,74,43,0.10);}',
    '.ts-switcher-link:focus-visible{outline:2px solid var(--rust);outline-offset:-2px;}',
    '.ts-switcher-name{display:block;font-family:Space Grotesk,Georgia,serif;font-size:14px;font-weight:600;line-height:1.25;}',
    '.ts-switcher-blurb{display:block;font-size:10px;letter-spacing:0.03em;color:var(--ink-faint);margin-top:2px;}',
    '.ts-switcher-link[aria-current="page"]{background:rgba(139,74,43,0.13);}',
    '.ts-switcher-link[aria-current="page"] .ts-switcher-name{color:var(--rust);}',
    '.ts-switcher-foot{border-top:1px solid rgba(43,38,32,0.14);margin-top:8px;padding-top:8px;}',
    '.ts-switcher-home{display:block;text-decoration:none;color:var(--ink-soft);font-size:10.5px;',
    '  letter-spacing:0.06em;text-transform:uppercase;padding:7px 10px;border-radius:7px;transition:background .15s,color .15s;}',
    '.ts-switcher-home:hover{background:rgba(139,74,43,0.10);color:var(--rust);}',
    '@media (max-width:620px){.ts-switcher-panel{right:auto;left:0;}}',
    '@media (prefers-reduced-motion:reduce){.ts-switcher-panel,.ts-switcher-caret{transition:none;}}'
  ].join('\n');

  function injectStyles() {
    if (document.getElementById('ts-switcher-styles')) return;
    var st = document.createElement('style');
    st.id = 'ts-switcher-styles';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // Which app are we on? Derived from the folder name in the path, with a
  // data-app override for anything served from an unusual location.
  function currentAppId(mount) {
    var override = mount && mount.getAttribute('data-app-switcher');
    if (override) return override;
    var parts = window.location.pathname.split('/').filter(Boolean);
    // drop a trailing file name so /granulator/index.html -> granulator
    if (parts.length && /\./.test(parts[parts.length - 1])) parts.pop();
    return parts.length ? parts[parts.length - 1] : '';
  }

  function build(mount) {
    var current = currentAppId(mount);
    var base = mount.getAttribute('data-base') || '../';

    var wrap = document.createElement('div');
    wrap.className = 'ts-switcher';
    wrap.setAttribute('data-open', 'false');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ts-switcher-btn';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span>All tools</span>' +
      '<svg class="ts-switcher-caret" viewBox="0 0 10 10" fill="none" aria-hidden="true">' +
      '<path d="M1.5 3.5 5 7l3.5-3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    var panel = document.createElement('div');
    panel.className = 'ts-switcher-panel';
    panel.setAttribute('role', 'menu');
    panel.setAttribute('aria-label', 'Thermalsock Labs tools');

    var html = '';
    APPS.forEach(function (g) {
      html += '<div class="ts-switcher-group">' + g.group + '</div>';
      g.items.forEach(function (a) {
        var isCurrent = a.id === current;
        html += '<a class="ts-switcher-link" role="menuitem" href="' + base + a.id + '/index.html"' +
          (isCurrent ? ' aria-current="page"' : '') + '>' +
          '<span class="ts-switcher-name">' + a.name + (isCurrent ? ' \u00b7 you are here' : '') + '</span>' +
          '<span class="ts-switcher-blurb">' + a.blurb + '</span></a>';
      });
    });
    html += '<div class="ts-switcher-foot"><a class="ts-switcher-home" href="' + base + 'index.html">\u2190 Back to the studio</a></div>';
    panel.innerHTML = html;

    wrap.appendChild(btn);
    wrap.appendChild(panel);
    mount.appendChild(wrap);

    function setOpen(open) {
      wrap.setAttribute('data-open', open ? 'true' : 'false');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    function isOpen() { return wrap.getAttribute('data-open') === 'true'; }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!isOpen());
    });
    document.addEventListener('click', function (e) {
      if (isOpen() && !wrap.contains(e.target)) setOpen(false);
    });
    // Escape closes, and focus goes back to the button so keyboard users
    // aren't stranded inside a panel that just disappeared.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) { setOpen(false); btn.focus(); }
    });
  }

  function init() {
    var mounts = document.querySelectorAll('[data-app-switcher]');
    if (!mounts.length) return;
    injectStyles();
    Array.prototype.forEach.call(mounts, build);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
