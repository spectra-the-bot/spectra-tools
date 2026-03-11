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

type CliSurfaceSpecEntry = {
  commands: string[];
  subcommands?: Record<string, string[]>;
};

type CliSurfaceSpec = Record<string, CliSurfaceSpecEntry>;

type InvocationSmokeCase = {
  description: string;
  args: string[];
  timeoutMs?: number;
};

type InvocationSmokeCases = {
  positional: InvocationSmokeCase;
  flag: InvocationSmokeCase;
  invalid: InvocationSmokeCase;
};

type GraphicDesignerFixtures = {
  target: string;
  rendered: string;
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
    workspaceName: '@spectratools/figma-cli',
    packageDir: 'packages/figma',
    binName: 'figma',
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
  '@spectratools/figma-cli',
  '@spectratools/graphic-designer-cli',
  '@spectratools/xapi-cli',
];

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npmToken = process.env.NPM_TOKEN ?? 'test-token';
const CLI_SURFACE_SPEC = JSON.parse(
  readFileSync(resolve(repoRoot, 'tests/cli-surface.spec.json'), 'utf8'),
) as CliSurfaceSpec;

const PARSER_UNKNOWN_COMMAND_PATTERN =
  /\bunknown\s+(?:command|subcommand)\b|\b(?:command|subcommand)\s+not\s+found\b|\bno\s+such\s+(?:command|subcommand)\b|\bis\s+not\s+a\s+command\b|\bCOMMAND_NOT_FOUND\b/i;
const PARSER_UNKNOWN_OPTION_PATTERN =
  /\bunknown\s+(?:option|argument)\b|\bunrecognized\s+option\b|\boption\b.*\bnot\s+recognized\b/i;

function runRaw(
  command: string,
  args: string[],
  cwd = repoRoot,
  options: { timeoutMs?: number } = {},
) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: options.timeoutMs ?? 30_000,
    env: {
      ...process.env,
      NPM_TOKEN: npmToken,
    },
  });
}

function run(
  command: string,
  args: string[],
  cwd = repoRoot,
  options: { timeoutMs?: number } = {},
) {
  const result = runRaw(command, args, cwd, options);

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(' ')}`,
        `cwd: ${cwd}`,
        `exit code: ${result.status ?? 'null'}`,
        `signal: ${result.signal ?? 'none'}`,
        `error: ${result.error ? String(result.error) : 'none'}`,
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

function createGraphicDesignerFixtures(localProjectDir: string): GraphicDesignerFixtures {
  const fixtureDir = join(localProjectDir, '.graphic-designer-e2e-fixtures');
  mkdirSync(fixtureDir, { recursive: true });

  // 1x1 transparent PNG
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8Zf1gAAAAASUVORK5CYII=',
    'base64',
  );

  const target = join(fixtureDir, 'target.png');
  const rendered = join(fixtureDir, 'rendered.png');

  writeFileSync(target, png);
  writeFileSync(rendered, png);

  return { target, rendered };
}

function getInvocationSmokeCases(
  pkg: CliPackage,
  graphicDesignerFixtures: GraphicDesignerFixtures,
): InvocationSmokeCases {
  switch (pkg.workspaceName) {
    case '@spectratools/aborean-cli':
      return {
        positional: {
          description: 'accepts real positional path (pools pool <address>)',
          args: ['pools', 'pool', '0x0000000000000000000000000000000000000000'],
        },
        flag: {
          description: 'accepts command flags (pools list --limit)',
          args: ['pools', 'list', '--limit', '1', '--format', 'json'],
        },
        invalid: {
          description: 'fails on invalid subcommand',
          args: ['pools', 'definitely-not-a-command'],
        },
      };
    case '@spectratools/assembly-cli':
      return {
        positional: {
          description: 'accepts real positional path (health <address>)',
          args: ['health', '0x0000000000000000000000000000000000000000'],
        },
        flag: {
          description: 'accepts command flags (members list --format)',
          args: ['members', 'list', '--format', 'json'],
        },
        invalid: {
          description: 'fails on invalid subcommand',
          args: ['members', 'definitely-not-a-command'],
        },
      };
    case '@spectratools/defillama-cli':
      return {
        positional: {
          description: 'accepts real positional path (tvl protocol <slug>)',
          args: ['tvl', 'protocol', 'uniswap'],
        },
        flag: {
          description: 'accepts command flags (tvl protocols --limit)',
          args: ['tvl', 'protocols', '--limit', '1', '--format', 'json'],
        },
        invalid: {
          description: 'fails on invalid subcommand',
          args: ['tvl', 'definitely-not-a-command'],
        },
      };
    case '@spectratools/erc8004-cli':
      return {
        positional: {
          description: 'accepts real positional path (identity get <agentId>)',
          args: ['identity', 'get', '1'],
        },
        flag: {
          description: 'accepts command flags (discovery search --name --limit)',
          args: ['discovery', 'search', '--name', 'spectra', '--limit', '1', '--format', 'json'],
        },
        invalid: {
          description: 'fails on invalid subcommand',
          args: ['identity', 'definitely-not-a-command'],
        },
      };
    case '@spectratools/etherscan-cli':
      return {
        positional: {
          description: 'accepts real positional path (tx info <hash>)',
          args: [
            'tx',
            'info',
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          ],
        },
        flag: {
          description: 'accepts command flags (gas oracle --format)',
          args: ['gas', 'oracle', '--format', 'json'],
        },
        invalid: {
          description: 'fails on invalid subcommand',
          args: ['tx', 'definitely-not-a-command'],
        },
      };
    case '@spectratools/graphic-designer-cli':
      return {
        positional: {
          description: 'runs a non-help command path against packaged artifact',
          args: [
            'compare',
            '--target',
            graphicDesignerFixtures.target,
            '--rendered',
            graphicDesignerFixtures.rendered,
          ],
          timeoutMs: 45_000,
        },
        flag: {
          description: 'accepts command flags (compare --grid)',
          args: [
            'compare',
            '--target',
            graphicDesignerFixtures.target,
            '--rendered',
            graphicDesignerFixtures.rendered,
            '--grid',
            '2',
            '--format',
            'json',
          ],
          timeoutMs: 45_000,
        },
        invalid: {
          description: 'fails on invalid subcommand',
          args: ['template', 'definitely-not-a-command'],
        },
      };
    case '@spectratools/figma-cli':
      return {
        positional: {
          description: 'accepts real positional path (files get <fileKey>)',
          args: ['files', 'get', 'abc123xyz'],
        },
        flag: {
          description: 'accepts command flags (files list --project-id)',
          args: ['files', 'list', '--project-id', '12345', '--format', 'json'],
        },
        invalid: {
          description: 'fails on invalid subcommand',
          args: ['files', 'definitely-not-a-command'],
        },
      };
    case '@spectratools/xapi-cli':
      return {
        positional: {
          description: 'accepts real positional path (posts get <id>)',
          args: ['posts', 'get', '20'],
        },
        flag: {
          description: 'accepts command flags (timeline mentions --format)',
          args: ['timeline', 'mentions', '--format', 'json'],
        },
        invalid: {
          description: 'fails on invalid subcommand',
          args: ['posts', 'definitely-not-a-command'],
        },
      };
    default:
      throw new Error(`Missing invocation smoke cases for ${pkg.workspaceName}`);
  }
}

function getOutput(result: ReturnType<typeof runRaw>): string {
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

function expectInvocationParses(result: ReturnType<typeof runRaw>, invocation: string) {
  const output = getOutput(result);

  expect(
    output,
    `Expected parser to accept invocation "${invocation}" but it reported an unknown command path.\nOutput:\n${output}`,
  ).not.toMatch(PARSER_UNKNOWN_COMMAND_PATTERN);

  expect(
    output,
    `Expected parser to accept invocation "${invocation}" but it reported an unknown option/argument.\nOutput:\n${output}`,
  ).not.toMatch(PARSER_UNKNOWN_OPTION_PATTERN);

  expect(
    result.error,
    `Invocation "${invocation}" failed to execute. stderr:\n${result.stderr}`,
  ).toBeUndefined();
  expect(result.status, `Invocation "${invocation}" terminated unexpectedly.`).not.toBeNull();
}

function expectInvalidInvocation(result: ReturnType<typeof runRaw>, invocation: string) {
  const output = getOutput(result);
  expect(result.status, `Expected non-zero exit for invalid invocation "${invocation}".`).not.toBe(
    0,
  );
  expect(
    output,
    `Expected parser error for invalid invocation "${invocation}".\nOutput:\n${output}`,
  ).toMatch(PARSER_UNKNOWN_COMMAND_PATTERN);
}

function extractCommandsFromHelp(stdout: string, stderr: string): string[] {
  const lines = `${stdout}${stderr}`.split(/\r?\n/u);
  const commands = new Set<string>();

  let inCommandsSection = false;
  for (const line of lines) {
    if (!inCommandsSection && /^\s*Commands:\s*$/iu.test(line)) {
      inCommandsSection = true;
      continue;
    }

    if (!inCommandsSection) {
      continue;
    }

    if (line.trim() === '') {
      if (commands.size > 0) {
        break;
      }
      continue;
    }

    const match = /^\s{2,}([a-z0-9][a-z0-9-]*)\b/iu.exec(line);
    if (match && !match[1].startsWith('-')) {
      commands.add(match[1]);
      continue;
    }

    if (/^\S/u.test(line)) {
      break;
    }
  }

  return [...commands];
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

      const graphicDesignerFixtures = createGraphicDesignerFixtures(localProjectDir);

      for (const pkg of CLI_PACKAGES) {
        const npxResult = run('npx', ['--no-install', pkg.binName, '--help'], localProjectDir);
        expect(npxResult.status).toBe(0);
        expectHelpOutput(npxResult.stdout, npxResult.stderr);

        const smokeCases = getInvocationSmokeCases(pkg, graphicDesignerFixtures);

        const positionalInvocation = `${pkg.binName} ${smokeCases.positional.args.join(' ')}`;
        const positionalResult = runRaw(
          'npx',
          ['--no-install', pkg.binName, ...smokeCases.positional.args],
          localProjectDir,
          { timeoutMs: smokeCases.positional.timeoutMs },
        );
        expectInvocationParses(positionalResult, positionalInvocation);

        const flagInvocation = `${pkg.binName} ${smokeCases.flag.args.join(' ')}`;
        const flagResult = runRaw(
          'npx',
          ['--no-install', pkg.binName, ...smokeCases.flag.args],
          localProjectDir,
          { timeoutMs: smokeCases.flag.timeoutMs },
        );
        expectInvocationParses(flagResult, flagInvocation);

        const invalidInvocation = `${pkg.binName} ${smokeCases.invalid.args.join(' ')}`;
        const invalidResult = runRaw(
          'npx',
          ['--no-install', pkg.binName, ...smokeCases.invalid.args],
          localProjectDir,
          { timeoutMs: smokeCases.invalid.timeoutMs },
        );
        expectInvalidInvocation(invalidResult, invalidInvocation);
      }

      // Validate package-root imports resolve and export expected symbols.
      // Runs against the packed tarball install, not the workspace source tree.
      for (const packageName of PACKAGES_WITH_ROOT_EXPORTS) {
        const importScript = [
          `const mod = await import(${JSON.stringify(packageName)});`,
          "if (typeof mod.cli === 'undefined') {",
          `  throw new Error('Missing expected "cli" export from ${packageName}');`,
          '}',
        ].join('\n');

        const importResult = run(
          process.execPath,
          ['--input-type=module', '--eval', importScript],
          localProjectDir,
        );
        expect(importResult.status).toBe(0);
        expect(
          importResult.stdout.trim(),
          `${packageName} import should not write to stdout during module initialization`,
        ).toBe('');
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

  it('matches CLI surface snapshot against packed --help output', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'spectratools-cli-surface-'));

    try {
      const tarballDir = join(tempDir, 'tarballs');
      const localProjectDir = join(tempDir, 'consumer-local');

      mkdirSync(tarballDir, { recursive: true });
      mkdirSync(localProjectDir, { recursive: true });

      const workspacePackages = loadWorkspacePackages();
      const packagesToPack = resolveWorkspacePackageOrder(
        CLI_PACKAGES.map((pkg) => pkg.workspaceName),
        workspacePackages,
      );
      const tarballs = packWorkspaceTarballs(packagesToPack, tarballDir);

      writeFileSync(
        join(localProjectDir, 'package.json'),
        JSON.stringify({
          name: 'spectratools-cli-surface-consumer',
          private: true,
          version: '0.0.0',
        }),
      );

      run('npm', ['install', '--no-audit', '--no-fund', ...tarballs], localProjectDir);

      for (const pkg of CLI_PACKAGES) {
        const spec = CLI_SURFACE_SPEC[pkg.workspaceName];
        expect(spec, `Missing CLI surface spec entry for ${pkg.workspaceName}`).toBeDefined();

        const rootHelp = run('npx', ['--no-install', pkg.binName, '--help'], localProjectDir);
        const rootCommands = new Set(extractCommandsFromHelp(rootHelp.stdout, rootHelp.stderr));

        for (const command of spec.commands) {
          expect(
            rootCommands,
            `Expected command '${command}' in '${pkg.binName} --help' but it was not found`,
          ).toContain(command);
        }

        for (const [command, expectedSubcommands] of Object.entries(spec.subcommands ?? {})) {
          const subcommandHelp = run(
            'npx',
            ['--no-install', pkg.binName, command, '--help'],
            localProjectDir,
          );
          const parsedSubcommands = new Set(
            extractCommandsFromHelp(subcommandHelp.stdout, subcommandHelp.stderr),
          );

          for (const expectedSubcommand of expectedSubcommands) {
            expect(
              parsedSubcommands,
              `Expected command '${expectedSubcommand}' in '${pkg.binName} ${command} --help' but it was not found`,
            ).toContain(expectedSubcommand);
          }
        }
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 240_000);
});
