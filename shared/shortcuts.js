/* Thermalsock Labs — shared keyboard shortcut registry.
 *
 * Five apps needed shortcuts and a help overlay. Transient Lab already had
 * six shortcuts with no way at all to discover them. Rather than build the
 * same overlay five times (and let it drift five ways), shortcuts are
 * registered here and the overlay is generated from the registry — so a
 * shortcut physically cannot exist without being documented.
 *
 * Usage:
 *   TSShortcuts.register([
 *     { keys: 'space', label: 'Play / pause', group: 'Transport', run: fn },
 *     { keys: '?',     label: 'This help' }            // handled internally
 *   ]);
 *
 * Plain script, no module, so the canvas apps can use it unchanged.
 */
(function (global) {
  'use strict';

  var registry = [];
  var overlay = null;
  var built = false;

  // Typing into a field should never fire a shortcut. This is the check that
  // stops "t" retheming the page while someone names a preset.
  function isTypingTarget(el) {
    if (!el) return false;
    var tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' ||
           el.isContentEditable === true;
  }

  function normalise(key) {
    if (key === ' ' || key === 'Spacebar') return 'space';
    if (key === 'Escape' || key === 'Esc') return 'escape';
    if (key === 'ArrowLeft') return 'left';
    if (key === 'ArrowRight') return 'right';
    if (key === 'ArrowUp') return 'up';
    if (key === 'ArrowDown') return 'down';
    return (key || '').toLowerCase();
  }

  var CSS = [
    '.ts-help-scrim{position:fixed;inset:0;z-index:10000;background:rgba(26,22,17,0.55);',
    '  display:flex;align-items:center;justify-content:center;padding:24px;',
    '  opacity:0;visibility:hidden;transition:opacity .18s,visibility .18s;}',
    '.ts-help-scrim[data-open="true"]{opacity:1;visibility:visible;}',
    '.ts-help{background:var(--paper);border:1px solid rgba(43,38,32,0.22);border-radius:14px;',
    '  box-shadow:0 20px 50px rgba(43,38,32,0.28);max-width:560px;width:100%;',
    '  max-height:min(80vh,640px);overflow-y:auto;padding:26px 28px;',
    '  font-family:"Space Grotesk",Georgia,serif;color:var(--ink);',
    '  transform:translateY(8px) scale(0.98);transition:transform .18s;}',
    '.ts-help-scrim[data-open="true"] .ts-help{transform:none;}',
    '.ts-help-head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:6px;}',
    '.ts-help h2{font-family:"Space Grotesk",Georgia,serif;font-weight:600;font-size:22px;margin:0;}',
    '.ts-help-close{background:none;border:none;cursor:pointer;font-size:20px;line-height:1;',
    '  color:var(--ink-faint);padding:4px 6px;border-radius:6px;}',
    '.ts-help-close:hover{color:var(--rust);background:rgba(139,74,43,0.10);}',
    '.ts-help-sub{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:10.5px;',
    '  letter-spacing:0.1em;text-transform:uppercase;color:var(--ink-faint);margin:0 0 18px 0;}',
    '.ts-help-group{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:9.5px;',
    '  letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-faint);',
    '  margin:18px 0 8px 0;padding-bottom:6px;border-bottom:1px solid rgba(43,38,32,0.14);}',
    '.ts-help-group:first-of-type{margin-top:0;}',
    '.ts-help-row{display:flex;align-items:baseline;gap:14px;padding:5px 0;}',
    '.ts-help-keys{flex:0 0 122px;display:flex;gap:5px;flex-wrap:wrap;}',
    '.ts-help-key{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;',
    '  background:var(--paper-deep);border:1px solid rgba(43,38,32,0.22);border-bottom-width:2px;',
    '  border-radius:5px;padding:2px 7px;color:var(--ink);white-space:nowrap;}',
    '.ts-help-label{font-size:14px;color:var(--ink-soft);}',
    '@media (max-width:520px){.ts-help-row{flex-direction:column;gap:3px;}.ts-help-keys{flex:none;}}',
    '@media (prefers-reduced-motion:reduce){.ts-help-scrim,.ts-help{transition:none;}}'
  ].join('\n');

  function injectStyles() {
    if (document.getElementById('ts-shortcut-styles')) return;
    var st = document.createElement('style');
    st.id = 'ts-shortcut-styles';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function prettyKey(k) {
    if (k === 'space') return 'Space';
    if (k === 'escape') return 'Esc';
    if (k === 'left') return '\u2190';
    if (k === 'right') return '\u2192';
    if (k === 'up') return '\u2191';
    if (k === 'down') return '\u2193';
    return k.length === 1 ? k.toUpperCase() : k;
  }

  function buildOverlay() {
    injectStyles();
    overlay = document.createElement('div');
    overlay.className = 'ts-help-scrim';
    overlay.setAttribute('data-open', 'false');
    overlay.innerHTML =
      '<div class="ts-help" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">' +
      '<div class="ts-help-head"><h2>Keyboard shortcuts</h2>' +
      '<button class="ts-help-close" type="button" aria-label="Close">\u2715</button></div>' +
      '<p class="ts-help-sub">Press ? any time to reopen this</p>' +
      '<div class="ts-help-body"></div></div>';
    document.body.appendChild(overlay);

    overlay.querySelector('.ts-help-close').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    built = true;
  }

  function renderBody() {
    var body = overlay.querySelector('.ts-help-body');
    var groups = {};
    var order = [];
    registry.forEach(function (s) {
      var g = s.group || 'General';
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(s);
    });
    var html = '';
    order.forEach(function (g) {
      html += '<div class="ts-help-group">' + g + '</div>';
      groups[g].forEach(function (s) {
        var keys = String(s.keys).split(/\s+/).map(function (k) {
          return '<span class="ts-help-key">' + prettyKey(normalise(k)) + '</span>';
        }).join('');
        html += '<div class="ts-help-row"><span class="ts-help-keys">' + keys +
                '</span><span class="ts-help-label">' + s.label + '</span></div>';
      });
    });
    body.innerHTML = html;
  }

  function open() {
    if (!built) buildOverlay();
    renderBody();
    overlay.setAttribute('data-open', 'true');
  }
  function close() { if (overlay) overlay.setAttribute('data-open', 'false'); }
  function isOpen() { return overlay && overlay.getAttribute('data-open') === 'true'; }

  function register(list) {
    list.forEach(function (s) { registry.push(s); });
  }

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (isOpen()) {
      if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); close(); }
      return;
    }
    if (isTypingTarget(e.target)) return;

    if (e.key === '?') { e.preventDefault(); open(); return; }

    var key = normalise(e.key);
    for (var i = 0; i < registry.length; i++) {
      var s = registry[i];
      if (!s.run) continue;
      var match = String(s.keys).split(/\s+/).some(function (k) { return normalise(k) === key; });
      if (match) {
        if (s.preventDefault !== false) e.preventDefault();
        s.run(e);
        return;
      }
    }
  });

  global.TSShortcuts = {
    register: register,
    open: open,
    close: close,
    isTypingTarget: isTypingTarget,
    list: function () { return registry.slice(); }
  };
})(window);
