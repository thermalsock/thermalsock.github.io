#!/usr/bin/env node
// Verification harness for the Thermalsock Labs site.
// Checks, for every HTML file: CSS brace balance inside <style>, div/section/svg/g
// tag balance, duplicate element IDs, and JS syntax of every inline <script>.
// Checks every standalone .js file with node --check equivalent (new Function/vm).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.argv[2] || '/home/claude/build';
let problems = 0;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function stripStrings(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/"(?:[^"\\]|\\.)*"/g, '""')
            .replace(/'(?:[^'\\]|\\.)*'/g, "''");
}

function countTags(html, tag) {
  const open = (html.match(new RegExp('<' + tag + '(?=[\\s>/])', 'g')) || []).length;
  const selfClose = (html.match(new RegExp('<' + tag + '\\b[^>]*\\/>', 'g')) || []).length;
  const close = (html.match(new RegExp('<\\/' + tag + '>', 'g')) || []).length;
  return { open: open - selfClose, close };
}

function checkJs(code, label) {
  try { new vm.Script(code, { filename: label }); return null; }
  catch (e) { return e.message; }
}

const files = walk(ROOT);

for (const f of files) {
  const rel = f.replace(ROOT + '/', '');
  if (f.endsWith('.html')) {
    const html = fs.readFileSync(f, 'utf8');

    // CSS brace balance in every <style> block
    const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];
    styles.forEach((m, i) => {
      const css = stripStrings(m[1]);
      const o = (css.match(/{/g) || []).length, c = (css.match(/}/g) || []).length;
      if (o !== c) { console.log(`BRACE  ${rel} <style>#${i}: { ${o} vs } ${c}`); problems++; }
    });

    // Tag balance
    for (const tag of ['div', 'section', 'nav', 'header', 'footer', 'aside', 'svg', 'g', 'main']) {
      const { open, close } = countTags(html, tag);
      if (open !== close) { console.log(`TAG    ${rel} <${tag}>: ${open} open vs ${close} close`); problems++; }
    }

    // Duplicate IDs
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    const seen = new Set(), dupes = new Set();
    ids.forEach(id => seen.has(id) ? dupes.add(id) : seen.add(id));
    if (dupes.size) { console.log(`DUPID  ${rel}: ${[...dupes].join(', ')}`); problems++; }

    // A <script src="..."> with inline content: browsers run the external
    // file and SILENTLY IGNORE the inline body. Nothing throws, nothing
    // logs — the code just never executes. Caught this the hard way after
    // appending code before the file's last </script>, which belonged to a
    // src'd tag, and silently disabling three apps' worth of features.
    const srcWithBody = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
      .filter(m => /\ssrc=/.test(m[1]) && m[2].trim());
    srcWithBody.forEach(m => {
      const line = html.slice(0, m.index).split('\n').length;
      console.log(`DEADJS ${rel}:${line}: <script src=...> also contains ${m[2].trim().length} chars of inline code, which the browser ignores`);
      problems++;
    });

    // Inline script syntax
    const scripts = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)];
    scripts.forEach((m, i) => {
      if (!m[1].trim()) return;
      const err = checkJs(m[1], `${rel}<script#${i}>`);
      if (err) { console.log(`JS     ${rel} <script>#${i}: ${err}`); problems++; }
    });
  }

  if (f.endsWith('.css')) {
    const css = stripStrings(fs.readFileSync(f, 'utf8'));
    const o = (css.match(/{/g) || []).length, c = (css.match(/}/g) || []).length;
    if (o !== c) { console.log(`BRACE  ${rel}: { ${o} vs } ${c}`); problems++; }
  }

  if (f.endsWith('.js')) {
    const code = fs.readFileSync(f, 'utf8');
    // ES modules can't go through vm.Script (import/export), so wrap detection
    const isModule = /^\s*(import|export)\b/m.test(code);
    let err;
    if (isModule) {
      // crude: strip import/export lines then syntax-check the rest
      const stripped = code
        .replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
        .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')
        .replace(/^\s*export\s+default\s+/gm, 'void ')
        .replace(/^\s*export\s+/gm, '');
      err = checkJs(stripped, rel);
    } else {
      err = checkJs(code, rel);
    }
    if (err) { console.log(`JS     ${rel}: ${err}`); problems++; }
  }
}

console.log(problems === 0 ? '\n✓ all checks passed' : `\n✗ ${problems} problem(s)`);
process.exit(problems === 0 ? 0 : 1);
