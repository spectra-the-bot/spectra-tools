import { CARBON_SURROUND_COLOR, type WindowControls } from '../code-style.js';
import { type DesignSpec, parseDesignSpec } from '../spec.schema.js';

/**
 * Build a validated {@link DesignSpec} for a Carbon-style code screenshot.
 *
 * Wraps a code snippet in a single `code-block` element with macOS-style window
 * chrome, drop shadow, and syntax highlighting. The resulting spec uses a
 * vertical stack layout.
 *
 * @param options - Code screenshot configuration.
 * @param options.code - The source code string to display.
 * @param options.language - Programming language for syntax highlighting (e.g.
 *   `"typescript"`).
 * @param options.title - Optional title shown in the window title bar.
 * @param options.theme - Built-in theme name. Defaults to `"dark"`.
 * @param options.showLineNumbers - Whether to render line numbers. Defaults to
 *   `false`.
 * @param options.highlightLines - Array of 1-based line numbers to highlight.
 * @param options.startLine - Starting line number for display. Defaults to `1`.
 * @param options.width - Canvas width in pixels. Defaults to `800`.
 * @param options.height - Canvas height in pixels. Defaults to `500`.
 * @param options.surroundColor - Background colour behind the code window.
 * @param options.windowControls - Window control style (`"macos"`, `"bw"`, or
 *   `"none"`). Defaults to `"macos"`.
 * @param options.scale - Render scale multiplier. Defaults to `2`.
 * @returns A fully validated and parsed {@link DesignSpec}.
 */
export function buildCodeSpec(options: {
  code: string;
  language: string;
  title?: string;
  theme?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  startLine?: number;
  width?: number;
  height?: number;
  surroundColor?: string;
  windowControls?: WindowControls;
  scale?: number;
}): DesignSpec {
  const codeBlock = {
    type: 'code-block',
    id: 'code-1',
    code: options.code,
    language: options.language,
    showLineNumbers: options.showLineNumbers ?? false,
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
    ...(options.highlightLines && options.highlightLines.length > 0
      ? { highlightLines: options.highlightLines }
      : {}),
    ...(options.startLine ? { startLine: options.startLine } : {}),
    ...(options.title ? { title: options.title } : {}),
  };

  return parseDesignSpec({
    version: 2,
    canvas: {
      width: options.width ?? 800,
      height: options.height ?? 500,
    },
    theme: options.theme ?? 'dark',
    layout: {
      mode: 'stack',
      direction: 'vertical',
      alignment: 'stretch',
    },
    elements: [codeBlock],
  });
}
