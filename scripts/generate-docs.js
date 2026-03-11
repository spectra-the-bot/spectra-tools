#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

const packages = [
  {
    name: 'assembly',
    cliPath: 'packages/assembly/dist/cli.js',
    outPath: 'docs/assembly/commands.md',
  },
  {
    name: 'etherscan',
    cliPath: 'packages/etherscan/dist/cli.js',
    outPath: 'docs/etherscan/commands.md',
  },
  {
    name: 'xapi',
    cliPath: 'packages/xapi/dist/cli.js',
    outPath: 'docs/xapi/commands.md',
  },
  {
    name: 'erc8004',
    cliPath: 'packages/erc8004/dist/cli.js',
    outPath: 'docs/erc8004/commands.md',
  },
  {
    name: 'aborean',
    cliPath: 'packages/aborean/dist/cli.js',
    outPath: 'docs/aborean/commands.md',
  },
  {
    name: 'defillama',
    cliPath: 'packages/defillama/dist/cli.js',
    outPath: 'docs/defillama/commands.md',
  },
  {
    name: 'figma',
    cliPath: 'packages/figma/dist/cli.js',
    outPath: 'docs/figma/commands.md',
  },
  {
    name: 'graphic-designer',
    cliPath: 'packages/graphic-designer/dist/cli.js',
    outPath: 'docs/graphic-designer/commands.md',
    llmsFlag: '--llms',
  },
];

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
}

function escapePlaceholderAngleBrackets(line) {
  return line.replace(/<([A-Za-z][A-Za-z0-9_-]*)>/g, (_match, token) => {
    return `&lt;${token}&gt;`;
  });
}

function normalizeMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let inCodeFence = false;

  const sanitized = lines.map((line) => {
    if (line.trimStart().startsWith('```')) {
      inCodeFence = !inCodeFence;
      return line;
    }

    if (inCodeFence) {
      return line;
    }

    return escapePlaceholderAngleBrackets(line);
  });

  return `${sanitized.join('\n').trimEnd()}\n`;
}

function main() {
  console.log('Building CLI packages...');
  run('pnpm', ['build'], { stdio: 'inherit' });

  for (const pkg of packages) {
    console.log(`Generating docs for ${pkg.name}...`);

    const flag = pkg.llmsFlag ?? '--llms-full';
    const markdown = run('node', [pkg.cliPath, flag]);
    const normalized = normalizeMarkdown(markdown);
    const outputPath = path.resolve(rootDir, pkg.outPath);

    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, normalized, 'utf8');
  }

  console.log('Docs generated successfully.');
}

if (require.main === module) {
  main();
}

module.exports = {
  escapePlaceholderAngleBrackets,
  normalizeMarkdown,
};
