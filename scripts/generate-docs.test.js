const assert = require('node:assert/strict');
const test = require('node:test');

const { normalizeMarkdown } = require('./generate-docs.js');

test('normalizeMarkdown preserves markdown blockquotes and escapes placeholder angle brackets', () => {
  const input =
    '# Example\n\nResolve (<registry>:<agentId>) to details.\n\n| Arg | Description |\n| --- | --- |\n| identifier | Format <registryAddress>:<agentId> |\n\n> Requires PRIVATE_KEY environment variable.\n\n```bash\ncommand <registry>:<agentId>\n```\n';

  const output = normalizeMarkdown(input);

  assert.match(output, /> Requires PRIVATE_KEY environment variable\./);
  assert.doesNotMatch(output, /&gt; Requires PRIVATE_KEY environment variable\./);
  assert.match(output, /\(&lt;registry&gt;:&lt;agentId&gt;\)/);
  assert.match(output, /Format &lt;registryAddress&gt;:&lt;agentId&gt;/);
  assert.match(output, /```bash\ncommand <registry>:<agentId>\n```/);
});

test('normalizeMarkdown keeps normal comparison operators in prose', () => {
  const input = '3 < 5 and 7 > 2\n';
  const output = normalizeMarkdown(input);

  assert.equal(output, '3 < 5 and 7 > 2\n');
});
