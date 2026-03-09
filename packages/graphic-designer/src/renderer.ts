import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import { resolveRenderScale } from './code-style.js';
import { loadFonts } from './fonts.js';
import { drawGradientRect, drawRainbowRule, drawVignette } from './primitives/gradients.js';
import { resolveFont, applyFont, wrapText } from './primitives/text.js';
import { computeLayout, type EdgeRoute } from './layout/index.js';
import { renderCard } from './renderers/card.js';
import { renderCodeBlock } from './renderers/code.js';
import { renderConnection } from './renderers/connection.js';
import { renderFlowNode } from './renderers/flow-node.js';
import { renderImageElement } from './renderers/image.js';
import { renderShapeElement } from './renderers/shape.js';
import { renderTerminal } from './renderers/terminal.js';
import { renderTextElement } from './renderers/text.js';
import { renderDrawCommands } from './renderers/draw.js';
import { type DesignSafeFrame, type DesignSpec, deriveSafeFrame, parseDesignSpec } from './spec.schema.js';
import { resolveTheme } from './themes/index.js';
import { canonicalJson, sha256Hex, shortHash } from './utils/hash.js';

export const DEFAULT_GENERATOR_VERSION = '0.2.0';

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RenderedElement = {
  id: string;
  kind:
    | 'header'
    | 'card'
    | 'footer'
    | 'text'
    | 'badge'
    | 'flow-node'
    | 'connection'
    | 'terminal'
    | 'code-block'
    | 'shape'
    | 'image'
    | 'draw'
    | 'rainbow-rule'
    | 'gradient-overlay'
    | 'vignette';
  bounds: Rect;
  foregroundColor?: string;
  backgroundColor?: string;
  allowOverlap?: boolean;
  truncated?: boolean;
};

export type LayoutSnapshot = {
  safeFrame: DesignSafeFrame;
  elements: RenderedElement[];
};

export type RenderMetadata = {
  schemaVersion: 2;
  generatorVersion: string;
  renderedAt: string;
  specHash: string;
  artifactHash: string;
  artifactBaseName: string;
  canvas: { width: number; height: number; scale: number };
  layout: LayoutSnapshot;
};

export type RenderResult = {
  png: Buffer;
  metadata: RenderMetadata;
};

export type WrittenArtifacts = {
  imagePath: string;
  metadataPath: string;
  metadata: RenderMetadata;
};

function buildArtifactBaseName(specHash: string, generatorVersion: string): string {
  const safeVersion = generatorVersion.replace(/[^0-9A-Za-z_.-]/gu, '_');
  return `design-v2-g${safeVersion}-s${shortHash(specHash)}`;
}

export function computeSpecHash(spec: DesignSpec): string {
  return sha256Hex(canonicalJson(spec));
}

function resolveAlignedX(rect: Rect, align: 'left' | 'center' | 'right'): number {
  if (align === 'center') {
    return rect.x + rect.width / 2;
  }
  if (align === 'right') {
    return rect.x + rect.width;
  }
  return rect.x;
}

function measureTextWithLetterSpacing(
  ctx: SKRSContext2D,
  text: string,
  letterSpacing: number,
): number {
  if (letterSpacing <= 0) {
    return ctx.measureText(text).width;
  }

  const glyphs = Array.from(text);
  if (glyphs.length === 0) {
    return 0;
  }

  const base = glyphs.reduce((sum, glyph) => sum + ctx.measureText(glyph).width, 0);
  return base + letterSpacing * (glyphs.length - 1);
}

function wrapTextWithLetterSpacing(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  letterSpacing: number,
): { lines: string[]; truncated: boolean } {
  if (letterSpacing <= 0) {
    return wrapText(ctx, text, maxWidth, maxLines);
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return { lines: [], truncated: false };
  }

  const words = trimmed.split(/\s+/u);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const trial = current.length > 0 ? `${current} ${word}` : word;
    if (measureTextWithLetterSpacing(ctx, trial, letterSpacing) <= maxWidth) {
      current = trial;
      continue;
    }

    if (current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word);
      current = '';
    }

    if (lines.length >= maxLines) {
      break;
    }
  }

  if (lines.length < maxLines && current.length > 0) {
    lines.push(current);
  }

  const wasTruncated = lines.length >= maxLines && words.join(' ') !== lines.join(' ');
  if (!wasTruncated) {
    return { lines, truncated: false };
  }

  const lastIndex = lines.length - 1;
  let truncatedLine = `${lines[lastIndex]}…`;
  while (
    truncatedLine.length > 1 &&
    measureTextWithLetterSpacing(ctx, truncatedLine, letterSpacing) > maxWidth
  ) {
    truncatedLine = `${truncatedLine.slice(0, -2)}…`;
  }
  lines[lastIndex] = truncatedLine;

  return { lines, truncated: true };
}

function drawAlignedTextLine(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  align: 'left' | 'center' | 'right',
  letterSpacing: number,
): void {
  if (letterSpacing <= 0) {
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
    return;
  }

  const glyphs = Array.from(text);
  const lineWidth = measureTextWithLetterSpacing(ctx, text, letterSpacing);
  let cursorX = x;

  if (align === 'center') {
    cursorX = x - lineWidth / 2;
  } else if (align === 'right') {
    cursorX = x - lineWidth;
  }

  ctx.textAlign = 'left';
  for (const glyph of glyphs) {
    ctx.fillText(glyph, cursorX, y);
    cursorX += ctx.measureText(glyph).width + letterSpacing;
  }
}

function drawAlignedTextBlock(
  ctx: SKRSContext2D,
  options: {
    text: string;
    x: number;
    y: number;
    maxWidth: number;
    maxLines: number;
    lineHeight: number;
    color: string;
    fontSize: number;
    fontWeight: number;
    fontFamily: string;
    align: 'left' | 'center' | 'right';
    letterSpacing?: number;
  },
): { height: number; truncated: boolean } {
  applyFont(ctx, { size: options.fontSize, weight: options.fontWeight, family: options.fontFamily });
  const letterSpacing = options.letterSpacing ?? 0;
  const wrapped = wrapTextWithLetterSpacing(
    ctx,
    options.text,
    options.maxWidth,
    options.maxLines,
    letterSpacing,
  );

  ctx.fillStyle = options.color;
  for (const [index, line] of wrapped.lines.entries()) {
    drawAlignedTextLine(
      ctx,
      line,
      options.x,
      options.y + index * options.lineHeight,
      options.align,
      letterSpacing,
    );
  }

  return {
    height: wrapped.lines.length * options.lineHeight,
    truncated: wrapped.truncated,
  };
}

export async function renderDesign(
  input: DesignSpec,
  options: { generatorVersion?: string; renderedAt?: string } = {},
): Promise<RenderResult> {
  loadFonts();

  const spec = parseDesignSpec(input);
  const safeFrame = deriveSafeFrame(spec);
  const theme = resolveTheme(spec.theme);
  const specHash = computeSpecHash(spec);
  const generatorVersion = options.generatorVersion ?? DEFAULT_GENERATOR_VERSION;
  const renderedAt = options.renderedAt ?? new Date().toISOString();

  const renderScale = resolveRenderScale(spec);
  const canvas = createCanvas(spec.canvas.width * renderScale, spec.canvas.height * renderScale);
  const ctx = canvas.getContext('2d');
  if (renderScale !== 1) {
    ctx.scale(renderScale, renderScale);
  }

  const headingFont = resolveFont(theme.fonts.heading, 'heading');
  const monoFont = resolveFont(theme.fonts.mono, 'mono');
  const bodyFont = resolveFont(theme.fonts.body, 'body');

  const background = spec.background ?? theme.background;
  const canvasRect: Rect = { x: 0, y: 0, width: spec.canvas.width, height: spec.canvas.height };

  if (typeof background === 'string') {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, spec.canvas.width, spec.canvas.height);
  } else {
    drawGradientRect(ctx, canvasRect, background);
  }

  const metadataBackground = typeof background === 'string' ? background : theme.background;

  const elements: RenderedElement[] = [];

  const hasHeader = Boolean(spec.header);
  const hasFooter = Boolean(spec.footer);

  const headerRect: Rect | undefined = hasHeader
    ? {
        x: safeFrame.x,
        y: safeFrame.y,
        width: safeFrame.width,
        height: Math.round(safeFrame.height * 0.24),
      }
    : undefined;

  const footerRect: Rect | undefined = hasFooter
    ? {
        x: safeFrame.x,
        y: safeFrame.y + safeFrame.height - Math.round(safeFrame.height * 0.1),
        width: safeFrame.width,
        height: Math.round(safeFrame.height * 0.1),
      }
    : undefined;

  const sectionGap = spec.layout.mode === 'grid' || spec.layout.mode === 'stack' ? spec.layout.gap : 24;
  const contentTop = headerRect ? headerRect.y + headerRect.height + sectionGap : safeFrame.y;
  const contentBottom = footerRect ? footerRect.y - sectionGap : safeFrame.y + safeFrame.height;

  if (headerRect && spec.header) {
    const headerAlign = spec.header.align;
    const headerX = resolveAlignedX(headerRect, headerAlign);

    if (spec.header.eyebrow) {
      applyFont(ctx, { size: 16, weight: 700, family: monoFont });
      ctx.fillStyle = theme.primary;
      ctx.textAlign = headerAlign;
      ctx.fillText(spec.header.eyebrow.toUpperCase(), headerX, headerRect.y + 18);
    }

    const titleFontSize = spec.header.titleFontSize ?? 42;
    const titleLineHeight = Math.round(titleFontSize * 1.14);
    const titleY = spec.header.eyebrow ? headerRect.y + 58 : headerRect.y + 32;
    const titleBlock = drawAlignedTextBlock(ctx, {
      x: headerX,
      y: titleY,
      maxWidth: headerRect.width,
      lineHeight: titleLineHeight,
      color: theme.text,
      text: spec.header.title,
      maxLines: 2,
      fontSize: titleFontSize,
      fontWeight: 700,
      fontFamily: headingFont,
      align: headerAlign,
      letterSpacing: spec.header.titleLetterSpacing,
    });

    let subtitleTruncated = false;
    if (spec.header.subtitle) {
      const subtitleBlock = drawAlignedTextBlock(ctx, {
        x: headerX,
        y: titleY + titleBlock.height + 12,
        maxWidth: headerRect.width,
        lineHeight: 28,
        color: theme.textMuted,
        text: spec.header.subtitle,
        maxLines: 2,
        fontSize: 22,
        fontWeight: 500,
        fontFamily: bodyFont,
        align: headerAlign,
      });
      subtitleTruncated = subtitleBlock.truncated;
    }

    ctx.textAlign = 'left';

    elements.push({
      id: 'header',
      kind: 'header',
      bounds: headerRect,
      foregroundColor: theme.text,
      backgroundColor: metadataBackground,
    });
    elements.push({
      id: 'header-title',
      kind: 'text',
      bounds: {
        x: headerRect.x,
        y: headerRect.y + 20,
        width: headerRect.width,
        height: headerRect.height - 20,
      },
      foregroundColor: theme.text,
      backgroundColor: metadataBackground,
      truncated: titleBlock.truncated || subtitleTruncated,
    });
  }

  const deferredVignettes: Array<{ index: number; intensity: number; color: string }> = [];

  for (const [index, decorator] of spec.decorators.entries()) {
    if (decorator.type === 'vignette') {
      deferredVignettes.push({ index, intensity: decorator.intensity, color: decorator.color });
      continue;
    }

    if (decorator.type === 'gradient-overlay') {
      ctx.save();
      ctx.globalAlpha = decorator.opacity;
      drawGradientRect(ctx, canvasRect, decorator.gradient);
      ctx.restore();

      elements.push({
        id: `decorator-gradient-overlay-${index}`,
        kind: 'gradient-overlay',
        bounds: { ...canvasRect },
        allowOverlap: true,
      });
      continue;
    }

    const defaultAfterHeaderY = headerRect
      ? headerRect.y + headerRect.height + Math.max(4, sectionGap / 2)
      : safeFrame.y + 24;
    const defaultBeforeFooterY = footerRect
      ? footerRect.y - Math.max(4, sectionGap / 2)
      : safeFrame.y + safeFrame.height - 24;

    const y =
      decorator.y === 'before-footer'
        ? defaultBeforeFooterY
        : decorator.y === 'custom'
          ? decorator.customY ?? defaultAfterHeaderY
          : defaultAfterHeaderY;

    const x = safeFrame.x + decorator.margin;
    const width = Math.max(0, safeFrame.width - decorator.margin * 2);

    drawRainbowRule(ctx, x, y, width, decorator.thickness, decorator.colors);

    elements.push({
      id: `decorator-rainbow-rule-${index}`,
      kind: 'rainbow-rule',
      bounds: {
        x,
        y: y - decorator.thickness / 2,
        width,
        height: decorator.thickness,
      },
      allowOverlap: true,
    });
  }

  const contentFrame: Rect = {
    x: safeFrame.x,
    y: contentTop,
    width: safeFrame.width,
    height: Math.max(0, contentBottom - contentTop),
  };

  const layoutResult = await computeLayout(spec.elements, spec.layout, contentFrame);
  const elementRects = layoutResult.positions;
  const edgeRoutes = (layoutResult as { edgeRoutes?: Map<string, EdgeRoute> }).edgeRoutes;

  for (const element of spec.elements) {
    if (element.type === 'connection') {
      continue;
    }

    const rect = elementRects.get(element.id);
    if (!rect) {
      throw new Error(`Missing layout bounds for element: ${element.id}`);
    }

    switch (element.type) {
      case 'card':
        elements.push(...renderCard(ctx, element, rect, theme));
        break;
      case 'flow-node':
        elements.push(...renderFlowNode(ctx, element, rect, theme));
        break;
      case 'terminal':
        elements.push(...renderTerminal(ctx, element, rect, theme));
        break;
      case 'code-block':
        elements.push(...(await renderCodeBlock(ctx, element, rect, theme)));
        break;
      case 'text':
        elements.push(...renderTextElement(ctx, element, rect, theme));
        break;
      case 'shape':
        elements.push(...renderShapeElement(ctx, element, rect, theme));
        break;
      case 'image':
        elements.push(...(await renderImageElement(ctx, element, rect, theme)));
        break;
    }
  }

  for (const element of spec.elements) {
    if (element.type !== 'connection') {
      continue;
    }

    const fromRect = elementRects.get(element.from);
    const toRect = elementRects.get(element.to);

    if (!fromRect || !toRect) {
      throw new Error(
        `Connection endpoints must reference positioned elements: from=${element.from} to=${element.to}`,
      );
    }

    const edgeRoute = edgeRoutes?.get(`${element.from}-${element.to}`);
    elements.push(...renderConnection(ctx, element, fromRect, toRect, theme, edgeRoute));
  }

  if (footerRect && spec.footer) {
    const footerText = spec.footer.tagline ? `${spec.footer.text} • ${spec.footer.tagline}` : spec.footer.text;
    applyFont(ctx, { size: 16, weight: 600, family: monoFont });
    ctx.fillStyle = theme.textMuted;
    ctx.fillText(footerText, footerRect.x, footerRect.y + footerRect.height - 10);

    elements.push({
      id: 'footer',
      kind: 'footer',
      bounds: footerRect,
      foregroundColor: theme.textMuted,
      backgroundColor: metadataBackground,
    });
  }

  elements.push(...renderDrawCommands(ctx, spec.draw, theme));

  for (const vignette of deferredVignettes) {
    drawVignette(ctx, spec.canvas.width, spec.canvas.height, vignette.intensity, vignette.color);
    elements.push({
      id: `decorator-vignette-${vignette.index}`,
      kind: 'vignette',
      bounds: { ...canvasRect },
      allowOverlap: true,
    });
  }

  const pngBuffer = Buffer.from(await canvas.encode('png'));
  const artifactHash = sha256Hex(pngBuffer);
  const artifactBaseName = buildArtifactBaseName(specHash, generatorVersion);

  const metadata: RenderMetadata = {
    schemaVersion: 2,
    generatorVersion,
    renderedAt,
    specHash,
    artifactHash,
    artifactBaseName,
    canvas: {
      width: spec.canvas.width,
      height: spec.canvas.height,
      scale: renderScale,
    },
    layout: {
      safeFrame,
      elements,
    },
  };

  return {
    png: pngBuffer,
    metadata,
  };
}

function resolveOutputPaths(
  out: string,
  artifactBaseName: string,
): { imagePath: string; metadataPath: string } {
  const resolved = resolve(out);
  const hasPngExtension = extname(resolved).toLowerCase() === '.png';

  if (hasPngExtension) {
    const metadataPath = resolved.replace(/\.png$/iu, '.meta.json');
    return { imagePath: resolved, metadataPath };
  }

  const imagePath = join(resolved, `${artifactBaseName}.png`);
  const metadataPath = join(resolved, `${artifactBaseName}.meta.json`);
  return { imagePath, metadataPath };
}

export async function writeRenderArtifacts(
  result: RenderResult,
  out: string,
): Promise<WrittenArtifacts> {
  const { imagePath, metadataPath } = resolveOutputPaths(out, result.metadata.artifactBaseName);
  await mkdir(dirname(imagePath), { recursive: true });
  await mkdir(dirname(metadataPath), { recursive: true });

  await writeFile(imagePath, result.png);
  await writeFile(metadataPath, JSON.stringify(result.metadata, null, 2));

  return {
    imagePath,
    metadataPath,
    metadata: result.metadata,
  };
}

export function inferSidecarPath(imagePath: string): string {
  const resolved = resolve(imagePath);
  if (extname(resolved).toLowerCase() !== '.png') {
    return join(dirname(resolved), `${basename(resolved)}.meta.json`);
  }
  return resolved.replace(/\.png$/iu, '.meta.json');
}
