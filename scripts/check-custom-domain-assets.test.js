const assert = require('node:assert/strict');
const { rmSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { checkHtmlForForbiddenPrefix } = require('./check-custom-domain-assets.js');

test('checkHtmlForForbiddenPrefix returns true when forbidden prefix is present', () => {
  const tmpPath = path.resolve(__dirname, '__tmp-forbidden.html');
  writeFileSync(tmpPath, '<script src="/spectra-tools/assets/app.js"></script>');

  try {
    assert.equal(checkHtmlForForbiddenPrefix(tmpPath), true);
  } finally {
    rmSync(tmpPath, { force: true });
  }
});

test('checkHtmlForForbiddenPrefix returns false for root-level assets', () => {
  const tmpPath = path.resolve(__dirname, '__tmp-ok.html');
  writeFileSync(tmpPath, '<script src="/assets/app.js"></script>');

  try {
    assert.equal(checkHtmlForForbiddenPrefix(tmpPath), false);
  } finally {
    rmSync(tmpPath, { force: true });
  }
});
