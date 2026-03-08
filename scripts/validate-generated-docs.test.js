const assert = require('node:assert/strict');
const test = require('node:test');

const { validateMarkdown } = require('./validate-generated-docs.js');

test('validateMarkdown flags escaped markdown blockquotes outside code fences', () => {
  const markdown = '&gt; note\n';
  const issues = validateMarkdown('docs/example/commands.md', markdown);

  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /Escaped markdown blockquote marker/);
});

test('validateMarkdown flags raw placeholder tokens outside code fences', () => {
  const markdown = 'Use <registry>:<agentId> format.\n';
  const issues = validateMarkdown('docs/example/commands.md', markdown);

  assert.equal(issues.length, 2);
  assert.match(issues[0].message, /Raw placeholder token/);
  assert.match(issues[1].message, /Raw placeholder token/);
});

test('validateMarkdown ignores escaped content inside fenced code blocks', () => {
  const markdown = '```md\n&gt; literal\n<registry>:<agentId>\n```\n';
  const issues = validateMarkdown('docs/example/commands.md', markdown);

  assert.equal(issues.length, 0);
});
