import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
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

type PackageManifest = {
  name: string;
  bin?: Record<string, string>;
  exports?: Record<string, unknown>;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type WorkspacePackage = {
  workspaceName: string;
  packageDir: string;
  manifest: PackageManifest;
  internalDependencies: string[];
};

const CLI_PACKAGES: CliPackage[] = [
  {
    workspaceName: '@spectratools/aborean-cli',
    packageDir: 'packages/aborean',
    binName: 'aborean-cli',
  },
  {
    workspaceName: '@spectratools/assembly-cli',
    packageDir: 'packages/assembly',
    binName: 'assembly-cli',
  },
  {
    workspaceName: '@spectratools/defillama-cli',
    packageDir: 'packages/defillama',
    binName: 'defillama-cli',
  },
  {
    workspaceName: '@spectratools/erc8004-cli',
    packageDir: 'packages/erc8004',
    binName: 'erc8004-cli',
  },
  {
    workspaceName: '@spectratools/etherscan-cli',
    packageDir: 'packages/etherscan',
    binName: 'etherscan-cli',
  },
  {
    workspaceName: '@spectratools/graphic-designer-cli',
    packageDir: 'packages/graphic-designer',
    binName: 'design',
  },
  {
    workspaceName: '@spectratools/xapi-cli',
    packageDir: 'packages/xapi',
    binName: 'xapi-cli',
  },
];

/**
 * Packages that publish a package-root export (via `exports` map in package.json).
 * Each must export a named `cli` symbol from its root entry point.
 * Only includes CLI packages from CLI_PACKAGES that define `exports["."]`.
 *
 * The completeness guard test below verifies that every workspace package with
 * both a `bin` entry and `exports["."]` appears in this list.
 */
const PACKAGES_WITH_ROOT_EXPORTS: string[] = [
  '@spectratools/aborean-cli',
  '@spectratools/assembly-cli',
  '@spectratools/defillama-cli',
  '@spectratools/erc8004-cli',
  '@spectratools/etherscan-cli',
  '@spectratools/graphic-designer-cli',
  '@spectratools/xapi-cli',
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

function readManifest(packageDir: string): PackageManifest {
  const packageJsonPath = resolve(repoRoot, packageDir, 'package.json');
  const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as Partial<PackageManifest>;

  if (!manifest.name) {
    throw new Error(`Missing package name in ${packageJsonPath}`);
  }

  return manifest as PackageManifest;
}

function getInternalWorkspaceDependencies(
  manifest: PackageManifest,
  workspaceNames: Set<string>,
): string[] {
  const internalDependencies = new Set<string>();
  const dependencyFields = [
    manifest.dependencies,
    manifest.optionalDependencies,
    manifest.peerDependencies,
  ];

  for (const dependencyField of dependencyFields) {
    for (const dependencyName of Object.keys(dependencyField ?? {})) {
      if (workspaceNames.has(dependencyName)) {
        internalDependencies.add(dependencyName);
      }
    }
  }

  return [...internalDependencies].sort((a, b) => a.localeCompare(b));
}

function loadWorkspacePackages(): Map<string, WorkspacePackage> {
  const packagesRoot = resolve(repoRoot, 'packages');
  const packageDirs = readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join('packages', entry.name))
    .filter((packageDir) => existsSync(resolve(repoRoot, packageDir, 'package.json')))
    .sort((a, b) => a.localeCompare(b));

  const manifests = packageDirs.map((packageDir) => {
    const manifest = readManifest(packageDir);
    return {
      workspaceName: manifest.name,
      packageDir,
      manifest,
    };
  });

  const workspaceNames = new Set(manifests.map((pkg) => pkg.workspaceName));
  const workspacePackages = new Map<string, WorkspacePackage>();

  for (const pkg of manifests) {
    workspacePackages.set(pkg.workspaceName, {
      ...pkg,
      internalDependencies: getInternalWorkspaceDependencies(pkg.manifest, workspaceNames),
    });
  }

  return workspacePackages;
}

function resolveWorkspacePackageOrder(
  rootPackageNames: string[],
  workspacePackages: Map<string, WorkspacePackage>,
): WorkspacePackage[] {
  const visiting = new Set<string>();
  const resolved = new Set<string>();
  const orderedPackageNames: string[] = [];

  const visit = (workspaceName: string) => {
    const workspacePackage = workspacePackages.get(workspaceName);
    if (!workspacePackage) {
      throw new Error(`Workspace package ${workspaceName} not found`);
    }

    if (resolved.has(workspaceName)) {
      return;
    }

    if (visiting.has(workspaceName)) {
      throw new Error(`Cycle detected while resolving workspace dependencies at ${workspaceName}`);
    }

    visiting.add(workspaceName);
    for (const internalDependency of workspacePackage.internalDependencies) {
      visit(internalDependency);
    }
    visiting.delete(workspaceName);

    resolved.add(workspaceName);
    orderedPackageNames.push(workspaceName);
  };

  for (const rootPackageName of [...new Set(rootPackageNames)].sort((a, b) => a.localeCompare(b))) {
    visit(rootPackageName);
  }

  return orderedPackageNames.map((workspaceName) => {
    const workspacePackage = workspacePackages.get(workspaceName);
    if (!workspacePackage) {
      throw new Error(`Resolved package ${workspaceName} disappeared`);
    }
    return workspacePackage;
  });
}

function packWorkspaceTarballs(packagesToPack: WorkspacePackage[], tarballDir: string): string[] {
  const tarballs: string[] = [];

  for (const { workspaceName, packageDir } of packagesToPack) {
    const before = new Set(readdirSync(tarballDir));
    run('pnpm', ['pack', '--pack-destination', tarballDir], resolve(repoRoot, packageDir));
    const packed = readdirSync(tarballDir)
      .filter((file) => !before.has(file))
      .sort((a, b) => a.localeCompare(b));

    if (packed.length !== 1) {
      throw new Error(
        `Expected exactly one tarball for ${workspaceName}, found ${packed.length} (${packed.join(', ')})`,
      );
    }

    tarballs.push(join(tarballDir, packed[0]));
  }

  return tarballs;
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

  it('derives a deterministic transitive workspace pack plan for CLI tarballs', () => {
    const workspacePackages = loadWorkspacePackages();
    const forwardPlan = resolveWorkspacePackageOrder(
      CLI_PACKAGES.map((pkg) => pkg.workspaceName),
      workspacePackages,
    );
    const reversePlan = resolveWorkspacePackageOrder(
      [...CLI_PACKAGES].reverse().map((pkg) => pkg.workspaceName),
      workspacePackages,
    );

    expect(forwardPlan.map((pkg) => pkg.workspaceName)).toEqual(
      reversePlan.map((pkg) => pkg.workspaceName),
    );

    const planNames = forwardPlan.map((pkg) => pkg.workspaceName);
    const planNameSet = new Set(planNames);

    for (const workspacePackage of forwardPlan) {
      for (const internalDependency of workspacePackage.internalDependencies) {
        expect(
          planNameSet,
          `${workspacePackage.workspaceName} depends on ${internalDependency}; dependency must be packed`,
        ).toContain(internalDependency);
        expect(planNames.indexOf(internalDependency)).toBeLessThan(
          planNames.indexOf(workspacePackage.workspaceName),
        );
      }
    }
  });

  it('ensures every CLI package with exports["."] is covered by PACKAGES_WITH_ROOT_EXPORTS', () => {
    const workspacePackages = loadWorkspacePackages();
    const rootExportSet = new Set(PACKAGES_WITH_ROOT_EXPORTS);
    const cliPackageNames = new Set(CLI_PACKAGES.map((pkg) => pkg.workspaceName));
    const missing: string[] = [];

    for (const [name, pkg] of workspacePackages) {
      const hasRootExport = pkg.manifest.exports?.['.' as keyof typeof pkg.manifest.exports];
      const hasBin = pkg.manifest.bin && Object.keys(pkg.manifest.bin).length > 0;
      if (hasRootExport && hasBin) {
        if (!rootExportSet.has(name)) {
          missing.push(name);
        }
        // Also ensure the package is in CLI_PACKAGES for binary testing
        if (!cliPackageNames.has(name)) {
          missing.push(`${name} (missing from CLI_PACKAGES)`);
        }
      }
    }

    expect(
      missing,
      `These workspace packages define both bin and exports["."] but are not in the test manifest. Add them to CLI_PACKAGES and/or PACKAGES_WITH_ROOT_EXPORTS:\n${missing.join('\n')}`,
    ).toEqual([]);
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

      const workspacePackages = loadWorkspacePackages();
      const packagesToPack = resolveWorkspacePackageOrder(
        CLI_PACKAGES.map((pkg) => pkg.workspaceName),
        workspacePackages,
      );
      const tarballs = packWorkspaceTarballs(packagesToPack, tarballDir);

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

      // Validate package-root imports resolve and export expected symbols.
      // Runs against the packed tarball install, not the workspace source tree.
      for (const packageName of PACKAGES_WITH_ROOT_EXPORTS) {
        const importScript = [
          `const mod = await import(${JSON.stringify(packageName)});`,
          "if (typeof mod.cli === 'undefined') {",
          `  process.stderr.write('Missing expected "cli" export from ${packageName}\\n');`,
          '  process.exit(1);',
          '}',
          `process.stdout.write('ok: ${packageName} exports cli (' + typeof mod.cli + ')\\n');`,
        ].join('\n');

        const importResult = run(
          process.execPath,
          ['--input-type=module', '--eval', importScript],
          localProjectDir,
        );
        expect(importResult.status).toBe(0);
        expect(importResult.stdout).toContain(`ok: ${packageName} exports cli`);
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
