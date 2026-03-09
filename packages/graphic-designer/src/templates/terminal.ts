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
