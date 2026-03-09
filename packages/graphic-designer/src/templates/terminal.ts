import { CARBON_SURROUND_COLOR, type WindowControls } from '../code-style.js';
import { type DesignSpec, parseDesignSpec } from '../spec.schema.js';

function resolveTerminalContent(options: {
  command?: string;
  output?: string;
  content?: string;
  prompt?: string;
}): string {
  if (options.content && options.content.trim().length > 0) {
    return options.content;
  }

  const command = options.command?.trim();
  const output = options.output ?? '';

  if (command) {
    const prompt = options.prompt ?? '$ ';
    return output ? `${prompt}${command}\n\n${output}` : `${prompt}${command}`;
  }

  if (output.trim().length > 0) {
    return output;
  }

  throw new Error('Terminal template requires either content or command/output input.');
}

/**
 * Build a validated {@link DesignSpec} for a terminal screenshot.
 *
 * Accepts either raw terminal content or a command/output pair and wraps it in
 * a single `terminal` element with macOS-style window chrome and a drop shadow.
 * At least one of `content`, `command`, or `output` must be provided.
 *
 * @param options - Terminal screenshot configuration.
 * @param options.command - Shell command to display (prepended with the prompt).
 * @param options.output - Command output text.
 * @param options.content - Raw terminal content — takes precedence over
 *   `command`/`output` when provided.
 * @param options.title - Optional window title bar text.
 * @param options.prompt - Prompt prefix used when rendering `command`. Defaults
 *   to `"$ "`.
 * @param options.theme - Built-in theme name. Defaults to `"dark"`.
 * @param options.width - Canvas width in pixels. Defaults to `800`.
 * @param options.height - Canvas height in pixels. Defaults to `400`.
 * @param options.surroundColor - Background colour behind the terminal window.
 * @param options.windowControls - Window control style (`"macos"`, `"bw"`, or
 *   `"none"`). Defaults to `"macos"`.
 * @param options.scale - Render scale multiplier. Defaults to `2`.
 * @returns A fully validated and parsed {@link DesignSpec}.
 * @throws When none of `content`, `command`, or `output` is provided.
 */
export function buildTerminalSpec(options: {
  command?: string;
  output?: string;
  content?: string;
  title?: string;
  prompt?: string;
  theme?: string;
  width?: number;
  height?: number;
  surroundColor?: string;
  windowControls?: WindowControls;
  scale?: number;
}): DesignSpec {
  const content = resolveTerminalContent(options);

  const terminal = {
    type: 'terminal',
    id: 'terminal-1',
    content,
    showPrompt: false,
    style: {
      paddingVertical: 56,
      paddingHorizontal: 56,
      windowControls: options.windowControls ?? 'macos',
      dropShadow: true,
      dropShadowOffsetY: 20,
      dropShadowBlurRadius: 68,
      surroundColor: options.surroundColor ?? CARBON_SURROUND_COLOR,
      fontSize: 14,
      lineHeightPercent: 143,
      scale: options.scale ?? 2,
    },
    ...(options.title ? { title: options.title } : {}),
  };

  return parseDesignSpec({
    version: 2,
    canvas: {
      width: options.width ?? 800,
      height: options.height ?? 400,
    },
    theme: options.theme ?? 'dark',
    layout: {
      mode: 'stack',
      direction: 'vertical',
      alignment: 'stretch',
    },
    elements: [terminal],
  });
}
