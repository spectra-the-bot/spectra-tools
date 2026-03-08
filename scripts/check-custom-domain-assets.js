#!/usr/bin/env node

const { readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, process.argv[2] ?? 'docs/.vitepress/dist');
const deployTarget = process.env.DOCS_DEPLOY_TARGET ?? 'custom-domain';
const forbiddenAssetPrefix = '/spectra-tools/assets/';

function findHtmlFiles(directoryPath) {
  const entries = readdirSync(directoryPath, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const entryPath = path.resolve(directoryPath, entry.name);

    if (entry.isDirectory()) {
      return findHtmlFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.html') ? [entryPath] : [];
  });
}

function checkHtmlForForbiddenPrefix(filePath) {
  const html = readFileSync(filePath, 'utf8');
  return html.includes(forbiddenAssetPrefix);
}

function main() {
  if (deployTarget !== 'custom-domain') {
    console.log(
      `Skipping custom-domain asset-path sanity check (DOCS_DEPLOY_TARGET=${deployTarget}).`,
    );
    return;
  }

  const htmlFiles = findHtmlFiles(distDir);
  const invalidFiles = htmlFiles.filter((filePath) => checkHtmlForForbiddenPrefix(filePath));

  if (invalidFiles.length > 0) {
    console.error(
      `Docs build contains forbidden custom-domain asset prefix \`${forbiddenAssetPrefix}\` in:`,
    );

    for (const filePath of invalidFiles) {
      console.error(`- ${path.relative(rootDir, filePath)}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log(
    `Custom-domain asset-path sanity check passed (${htmlFiles.length} HTML files scanned).`,
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  checkHtmlForForbiddenPrefix,
  findHtmlFiles,
};
