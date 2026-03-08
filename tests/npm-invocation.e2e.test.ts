import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type CliPackage = {
  workspaceName: string;
  packageDir: string;
  binName: string;
};

const CLI_PACKAGES: CliPackage[] = [
  {
    workspaceName: '@spectratools/assembly-cli',
    packageDir: 'packages/assembly',
    binName: 'assembly-cli',
  },
  {
    workspaceName: '@spectratools/etherscan-cli',
    packageDir: 'packages/etherscan',
    binName: 'etherscan-cli',
  },
  {
    workspaceName: '@spectratools/xapi-cli',
    packageDir: 'packages/xapi',
    binName: 'xapi-cli',
  },
  {
    workspaceName: '@spectratools/erc8004-cli',
    packageDir: 'packages/erc8004',
    binName: 'erc8004-cli',
  },
];

const WORKSPACE_PACKAGES_TO_PACK = [
  '@spectratools/cli-shared',
  ...CLI_PACKAGES.map((pkg) => pkg.workspaceName),
];
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npmToken = process.env.NPM_TOKEN ?? 'test-token';

function run(command: string, args: string[], cwd = repoRoot) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      NPM_TOKEN: npmToken,
    },
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(' ')}`,
        `cwd: ${cwd}`,
        `exit code: ${result.status ?? 'null'}`,
        `stdout:\n${result.stdout}`,
        `stderr:\n${result.stderr}`,
      ].join('\n\n'),
    );
  }

  return result;
}

function expectHelpOutput(stdout: string, stderr: string) {
  const output = `${stdout}${stderr}`;
  expect(output).toContain('Usage');
}

describe('CLI npm invocation e2e', () => {
  it.each(CLI_PACKAGES)('runs via symlink for $workspaceName', (pkg) => {
    const cliPath = resolve(repoRoot, pkg.packageDir, 'dist/cli.js');
    if (!existsSync(cliPath)) {
      throw new Error(
        `Missing build artifact at ${cliPath}. Run \`pnpm build\` before running e2e tests.`,
      );
    }

    const tempDir = mkdtempSync(join(tmpdir(), 'spectratools-symlink-'));
    try {
      const symlinkPath = join(tempDir, `${pkg.binName}.js`);
      symlinkSync(cliPath, symlinkPath);

      const result = run(process.execPath, [symlinkPath, '--help']);
      expect(result.status).toBe(0);
      expectHelpOutput(result.stdout, result.stderr);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('supports npm pack + install with npx and global binary invocation', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'spectratools-pack-install-'));

    try {
      const tarballDir = join(tempDir, 'tarballs');
      const localProjectDir = join(tempDir, 'consumer-local');
      const globalPrefixDir = join(tempDir, 'global-prefix');

      mkdirSync(tarballDir, { recursive: true });
      mkdirSync(localProjectDir, { recursive: true });
      mkdirSync(globalPrefixDir, { recursive: true });

      const tarballs: string[] = [];
      for (const workspaceName of WORKSPACE_PACKAGES_TO_PACK) {
        const before = new Set(readdirSync(tarballDir));
        run('pnpm', ['--filter', workspaceName, 'pack', '--pack-destination', tarballDir]);
        const packed = readdirSync(tarballDir).find((file) => !before.has(file));
        if (!packed) {
          throw new Error(`pnpm pack did not produce a tarball for ${workspaceName}`);
        }
        tarballs.push(join(tarballDir, packed));
      }

      writeFileSync(
        join(localProjectDir, 'package.json'),
        JSON.stringify({
          name: 'spectratools-e2e-consumer',
          private: true,
          version: '0.0.0',
        }),
      );

      run('npm', ['install', '--no-audit', '--no-fund', ...tarballs], localProjectDir);

      for (const pkg of CLI_PACKAGES) {
        const npxResult = run('npx', ['--no-install', pkg.binName, '--help'], localProjectDir);
        expect(npxResult.status).toBe(0);
        expectHelpOutput(npxResult.stdout, npxResult.stderr);
      }

      run(
        'npm',
        [
          'install',
          '--global',
          '--prefix',
          globalPrefixDir,
          '--no-audit',
          '--no-fund',
          ...tarballs,
        ],
        localProjectDir,
      );

      for (const pkg of CLI_PACKAGES) {
        const binPath = resolve(globalPrefixDir, 'bin', pkg.binName);
        const globalResult = run(binPath, ['--help'], localProjectDir);
        expect(globalResult.status).toBe(0);
        expectHelpOutput(globalResult.stdout, globalResult.stderr);
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 240_000);
});
