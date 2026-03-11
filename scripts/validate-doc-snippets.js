#!/usr/bin/env node
/**
 * validate-doc-snippets.js
 *
 * Smoke-tests CLI examples extracted from docs and README files.
 * For each snippet that invokes a known CLI binary, it verifies:
 *   1. The subcommand path exists (via --help).
 *   2. Any flags used are accepted by that command.
 *
 * Exit 0 if all pass, exit 1 with details on failures.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Map of CLI binary names to their built entry points (relative to repo root)
const CLI_BINS = {
  'xapi-cli': 'packages/xapi/dist/cli.js',
  xapi: 'packages/xapi/dist/cli.js',
  'assembly-cli': 'packages/assembly/dist/cli.js',
  assembly: 'packages/assembly/dist/cli.js',
  design: 'packages/graphic-designer/dist/cli.js',
};

// npx package → binary name
const NPX_BINS = {
  '@spectratools/xapi-cli': 'xapi-cli',
  '@spectratools/assembly-cli': 'assembly-cli',
  '@spectratools/graphic-designer-cli': 'design',
};

// Doc files to scan
const DOC_FILES = [
  'README.md',
  'docs/index.md',
  'docs/getting-started.md',
  'docs/xapi/index.md',
  'docs/assembly/index.md',
  'docs/graphic-designer/index.md',
  'packages/xapi/README.md',
  'packages/assembly/README.md',
  'packages/graphic-designer/README.md',
];

/**
 * Extract CLI invocations from fenced code blocks in a markdown file.
 * Returns [{file, line, raw, bin, args}]
 */
function extractSnippets(filePath) {
  const abs = resolve(root, filePath);
  if (!existsSync(abs)) return [];
  const content = readFileSync(abs, 'utf8');
  const lines = content.split('\n');
  const snippets = [];
  let inBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line.trim())) {
      inBlock = !inBlock;
      continue;
    }
    if (!inBlock) continue;

    // Strip leading $ and comments
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const cleaned = trimmed.replace(/^\$\s*/, '');

    // Resolve the CLI binary
    let bin = null;
    let args = [];

    // Handle npx invocations
    const npxMatch = cleaned.match(/^npx\s+(\S+)\s*(.*)/);
    if (npxMatch) {
      const pkg = npxMatch[1];
      const rest = npxMatch[2];
      const mapped = NPX_BINS[pkg];
      if (mapped) {
        bin = mapped;
        args = rest ? rest.split(/\s+/).filter(Boolean) : [];
      }
    }

    // Handle direct CLI invocations
    if (!bin) {
      const parts = cleaned.split(/\s+/);
      const cmd = parts[0];
      if (CLI_BINS[cmd]) {
        bin = cmd;
        args = parts.slice(1);
      }
    }

    if (bin) {
      snippets.push({ file: filePath, line: i + 1, raw: cleaned, bin, args });
    }
  }
  return snippets;
}

/**
 * Parse a snippet's args to extract the subcommand path and flags.
 */
function parseCommand(args) {
  const subcommands = [];
  const flags = [];

  for (const arg of args) {
    if (arg.startsWith('-')) {
      // Extract the flag name (strip value if =)
      const flag = arg.split('=')[0];
      flags.push(flag);
    } else if (
      subcommands.length < 3 &&
      !arg.startsWith('"') &&
      !arg.startsWith("'") &&
      !arg.includes('/') &&
      !arg.includes('.')
    ) {
      // Looks like a subcommand token
      subcommands.push(arg);
    }
  }

  return { subcommands, flags };
}

/**
 * Get --help output for a CLI + subcommand path.
 */
function getHelpOutput(bin, subcommands) {
  const entry = resolve(root, CLI_BINS[bin]);
  if (!existsSync(entry)) return null;
  try {
    const result = execFileSync('node', [entry, ...subcommands, '--help'], {
      encoding: 'utf8',
      timeout: 10_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result;
  } catch {
    return null;
  }
}

/**
 * Validate a single snippet.
 */
function validateSnippet(snippet) {
  const { bin, args, file, line, raw } = snippet;
  const { subcommands, flags } = parseCommand(args);
  const errors = [];

  // Try to get help for the deepest valid subcommand path
  let validPath = [];
  for (let depth = subcommands.length; depth >= 0; depth--) {
    const path = subcommands.slice(0, depth);
    const help = getHelpOutput(bin, path);
    if (help !== null) {
      validPath = path;

      // If we had to reduce depth, the full subcommand path is invalid
      if (depth < subcommands.length) {
        const invalid = subcommands.slice(depth);
        errors.push(
          `Unknown subcommand: "${invalid.join(' ')}" (valid commands at "${[bin, ...path].join(' ')}")`,
        );
      }

      // Check flags against help output
      for (const flag of flags) {
        // Skip generic flags that all commands support
        if (['--format', '--json', '--verbose', '--help'].includes(flag)) continue;
        // Check if the flag appears in help text
        if (!help.includes(flag)) {
          errors.push(
            `Unknown flag: "${flag}" not found in "${[bin, ...validPath].join(' ')} --help"`,
          );
        }
      }
      break;
    }
  }

  if (validPath.length === 0 && subcommands.length > 0) {
    const help = getHelpOutput(bin, []);
    if (help === null) {
      errors.push(`Cannot run "${bin} --help" — is the package built?`);
    }
  }

  return errors;
}

// Main
const allSnippets = DOC_FILES.flatMap(extractSnippets);
let failures = 0;
let passed = 0;

console.log(
  `Validating ${allSnippets.length} CLI snippets from ${DOC_FILES.length} doc files...\n`,
);

for (const snippet of allSnippets) {
  const errors = validateSnippet(snippet);
  if (errors.length > 0) {
    failures++;
    console.log(`❌ ${snippet.file}:${snippet.line}`);
    console.log(`   ${snippet.raw}`);
    for (const err of errors) {
      console.log(`   → ${err}`);
    }
    console.log();
  } else {
    passed++;
  }
}

console.log(`\n${passed} passed, ${failures} failed`);

if (failures > 0) {
  process.exit(1);
}
