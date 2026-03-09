import { CARBON_SURROUND_COLOR, type WindowControls } from '../code-style.js';
import { parseDesignSpec, type DesignSpec } from '../spec.schema.js';

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
