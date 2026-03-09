import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GlobalFonts } from '@napi-rs/canvas';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fontsDir = resolve(__dirname, '../fonts');

let loaded = false;

function register(filename: string, family: string): void {
  GlobalFonts.registerFromPath(resolve(fontsDir, filename), family);
}

/**
 * Register the bundled font families (Inter, JetBrains Mono, Space Grotesk)
 * with the global `@napi-rs/canvas` font registry.
 *
 * **Must be called before {@link renderDesign}.** Without registered fonts the
 * canvas will fall back to system defaults, producing inconsistent output across
 * environments. {@link renderDesign} calls this internally, but consumers using
 * lower-level APIs (e.g. `renderDrawCommands`) should call it explicitly.
 *
 * This function is idempotent — subsequent calls after the first are no-ops.
 */
export function loadFonts(): void {
  if (loaded) {
    return;
  }

  register('Inter-Regular.woff2', 'Inter');
  register('Inter-Medium.woff2', 'Inter');
  register('Inter-SemiBold.woff2', 'Inter');
  register('Inter-Bold.woff2', 'Inter');

  register('JetBrainsMono-Regular.woff2', 'JetBrains Mono');
  register('JetBrainsMono-Medium.woff2', 'JetBrains Mono');
  register('JetBrainsMono-Bold.woff2', 'JetBrains Mono');

  register('SpaceGrotesk-Medium.woff2', 'Space Grotesk');
  register('SpaceGrotesk-Bold.woff2', 'Space Grotesk');

  loaded = true;
}
