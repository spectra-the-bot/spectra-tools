#!/usr/bin/env node

const { existsSync, readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const docsDir = path.resolve(rootDir, 'docs');

function findCommandDocs() {
  const entries = readdirSync(docsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.resolve(docsDir, entry.name, 'commands.md'))
    .filter((filePath) => existsSync(filePath));
}

function validateMarkdown(filePath, markdown) {
  const issues = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let inCodeFence = false;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    if (line.trimStart().startsWith('```')) {
      inCodeFence = !inCodeFence;
      return;
    }

    if (inCodeFence) {
      return;
    }

    if (/^\s*&gt;\s+/.test(line)) {
      issues.push({
        filePath,
        lineNumber,
        message: 'Escaped markdown blockquote marker found (`&gt;`).',
        line,
      });
    }

    const rawPlaceholderMatches = line.matchAll(/<([A-Za-z][A-Za-z0-9_-]*)>/g);
    for (const match of rawPlaceholderMatches) {
      issues.push({
        filePath,
        lineNumber,
        message: `Raw placeholder token \`${match[0]}\` found outside code fence. Escape as \`&lt;...&gt;\` to avoid VitePress parsing issues.`,
        line,
      });
    }
  });

  return issues;
}

function main() {
  const commandDocs = findCommandDocs();

  if (commandDocs.length === 0) {
    console.error('No generated docs files found at docs/*/commands.md.');
    process.exitCode = 1;
    return;
  }

  const issues = commandDocs.flatMap((filePath) => {
    const markdown = readFileSync(filePath, 'utf8');
    return validateMarkdown(filePath, markdown);
  });

  if (issues.length > 0) {
    console.error('Generated docs validation failed:\n');
    for (const issue of issues) {
      const relativePath = path.relative(rootDir, issue.filePath);
      console.error(`${relativePath}:${issue.lineNumber} ${issue.message}`);
      console.error(`  ${issue.line}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Generated docs validation passed for ${commandDocs.length} files.`);
}

if (require.main === module) {
  main();
}

module.exports = {
  findCommandDocs,
  validateMarkdown,
};
