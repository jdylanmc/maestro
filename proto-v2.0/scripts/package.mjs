/**
 * Package the route as an unsigned, fuse-enabled macOS `.app`.
 *
 * Signing is deliberately out of scope for the MVP. That is not a shortcut with
 * no consequence: manipulating Electron fuses **invalidates the code signature**,
 * and a macOS build with an invalid signature is killed on launch rather than
 * failing gracefully. An earlier prototype spent a cycle attributing exactly that
 * to the wrong cause, so the app is ad-hoc re-signed after fuses are flipped.
 *
 * `enableNodeCliInspectArguments` is left ENABLED. Discovery scoped fuse
 * hardening out of the MVP, and Playwright drives this exact build - so the fuse
 * question only becomes live for a configuration this route has deferred.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { packager } from '@electron/packager';
import { flipFuses, FuseV1Options, FuseVersion } from '@electron/fuses';

const run = promisify(execFile);
const root = process.cwd();
const outDir = join(root, 'dist');

await rm(outDir, { recursive: true, force: true });

const [appPath] = await packager({
  dir: root,
  out: outDir,
  platform: 'darwin',
  arch: process.arch === 'arm64' ? 'arm64' : 'x64',
  name: 'Maestro',
  appBundleId: 'dev.maestro.v2',
  overwrite: true,
  asar: false,
  prune: false,
  // Ship only what the app needs at runtime; everything else is build-time.
  ignore: [/^\/src($|\/)/, /^\/dist($|\/)/, /^\/\.git($|\/)/],
});

const app = join(appPath, 'Maestro.app');
const executable = join(app, 'Contents', 'MacOS', 'Maestro');

await flipFuses(executable, {
  version: FuseVersion.V1,
  resetAdHocDarwinSignature: true,
  // MUST stay enabled for this route, and the reason is measured rather than
  // assumed. The Copilot SDK starts its runtime by re-spawning the host binary in
  // Node mode. With this fuse disabled that spawn does not fail cleanly - it
  // launches **another copy of the application**, which then tries to start its own
  // runtime, and so on. During development that produced 952 live processes in a
  // single process group before a watchdog stopped it, and it presented as the
  // far more innocent-looking "CLI server exited unexpectedly with code 0".
  //
  // The cost is recorded honestly in the executive report: this route cannot adopt
  // the RunAsNode hardening fuse while it consumes the SDK this way.
  [FuseV1Options.RunAsNode]: true,
  [FuseV1Options.EnableCookieEncryption]: true,
  // Also required: the SDK passes Node options to the runtime it spawns.
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: true,
  // Left enabled on purpose - see the header.
  [FuseV1Options.EnableNodeCliInspectArguments]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: false,
});

// Fuse manipulation invalidates the signature. Ad-hoc re-sign, or macOS kills it.
await run('codesign', ['--force', '--deep', '--sign', '-', app]);
const { stdout } = await run('codesign', ['--verify', '--verbose=2', app]).catch((e) => ({
  stdout: String(e),
}));

console.log(`packaged: ${app}`);
console.log(`executable: ${executable}`);
console.log(`signature: ${stdout.trim() || 'ad-hoc, verified'}`);
