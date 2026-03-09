import type { CodeBlockStyle, DesignSpec, Element } from './spec.schema.js';

export const CARBON_SURROUND_COLOR = 'rgba(171, 184, 195, 1)';

export type WindowControls = 'macos' | 'bw' | 'none';

export type ResolvedCodeBlockStyle = {
  paddingVertical: number;
  paddingHorizontal: number;
  windowControls: WindowControls;
  dropShadow: boolean;
  dropShadowOffsetY: number;
  dropShadowBlurRadius: number;
  surroundColor: string;
  fontSize: number;
  lineHeightPercent: number;
  scale: 1 | 2 | 4;
};

const DEFAULT_STYLE: ResolvedCodeBlockStyle = {
  paddingVertical: 56,
  paddingHorizontal: 56,
  windowControls: 'macos',
  dropShadow: true,
  dropShadowOffsetY: 20,
  dropShadowBlurRadius: 68,
  surroundColor: CARBON_SURROUND_COLOR,
  fontSize: 14,
  lineHeightPercent: 143,
  scale: 2,
};

function normalizeScale(scale: number | undefined): 1 | 2 | 4 {
  if (scale === 1 || scale === 2 || scale === 4) {
    return scale;
  }

  return DEFAULT_STYLE.scale;
}

export function resolveCodeBlockStyle(style?: CodeBlockStyle): ResolvedCodeBlockStyle {
  return {
    paddingVertical: style?.paddingVertical ?? DEFAULT_STYLE.paddingVertical,
    paddingHorizontal: style?.paddingHorizontal ?? DEFAULT_STYLE.paddingHorizontal,
    windowControls: style?.windowControls ?? DEFAULT_STYLE.windowControls,
    dropShadow: style?.dropShadow ?? DEFAULT_STYLE.dropShadow,
    dropShadowOffsetY: style?.dropShadowOffsetY ?? DEFAULT_STYLE.dropShadowOffsetY,
    dropShadowBlurRadius: style?.dropShadowBlurRadius ?? DEFAULT_STYLE.dropShadowBlurRadius,
    surroundColor: style?.surroundColor ?? DEFAULT_STYLE.surroundColor,
    fontSize: style?.fontSize ?? DEFAULT_STYLE.fontSize,
    lineHeightPercent: style?.lineHeightPercent ?? DEFAULT_STYLE.lineHeightPercent,
    scale: normalizeScale(style?.scale),
  };
}

function resolveElementScale(element: Element): 1 | 2 | 4 | null {
  if (element.type !== 'code-block' && element.type !== 'terminal') {
    return null;
  }

  return resolveCodeBlockStyle(element.style).scale;
}

export function resolveRenderScale(spec: DesignSpec): 1 | 2 | 4 {
  let scale: 1 | 2 | 4 = 1;

  for (const element of spec.elements) {
    const elementScale = resolveElementScale(element);
    if (elementScale === null) {
      continue;
    }

    if (elementScale > scale) {
      scale = elementScale;
    }
  }

  return scale;
}
