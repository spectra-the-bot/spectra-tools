import { GlobalFonts } from '@napi-rs/canvas';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fontsDir = resolve(__dirname, '../fonts');

let loaded = false;

function register(filename: string, family: string): void {
  GlobalFonts.registerFromPath(resolve(fontsDir, filename), family);
}

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
