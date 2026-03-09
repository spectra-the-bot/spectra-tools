import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { type SKRSContext2D, createCanvas } from '@napi-rs/canvas';
import {
  type DesignCardSpec,
  type DesignSafeFrame,
  type DesignSpec,
  deriveSafeFrame,
  parseDesignSpec,
} from './spec.schema.js';
import { canonicalJson, sha256Hex, shortHash } from './utils/hash.js';

export const DEFAULT_GENERATOR_VERSION = '0.1.0';

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RenderedElement = {
  id: string;
  kind: 'header' | 'card' | 'footer' | 'text' | 'badge';
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
  schemaVersion: 1;
  generatorVersion: string;
  renderedAt: string;
  template: DesignSpec['template'];
  specHash: string;
  artifactHash: string;
  artifactBaseName: string;
  canvas: { width: number; height: number };
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

type WrappedLines = {
  lines: string[];
  truncated: boolean;
};

const TONE_BADGE_COLORS: Record<DesignCardSpec['tone'], string> = {
  neutral: '#334B83',
  accent: '#1E7A58',
  success: '#166A45',
  warning: '#7A5418',
};

function applyFont(
  ctx: SKRSContext2D,
  options: { size: number; weight: number; family: string },
): void {
  ctx.font = `${options.weight} ${options.size}px ${options.family}`;
}

function roundRectPath(ctx: SKRSContext2D, rect: Rect, radius: number): void {
  const r = Math.max(0, Math.min(radius, rect.width / 2, rect.height / 2));
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  ctx.beginPath();
  ctx.moveTo(rect.x + r, rect.y);
  ctx.lineTo(right - r, rect.y);
  ctx.quadraticCurveTo(right, rect.y, right, rect.y + r);
  ctx.lineTo(right, bottom - r);
  ctx.quadraticCurveTo(right, bottom, right - r, bottom);
  ctx.lineTo(rect.x + r, bottom);
  ctx.quadraticCurveTo(rect.x, bottom, rect.x, bottom - r);
  ctx.lineTo(rect.x, rect.y + r);
  ctx.quadraticCurveTo(rect.x, rect.y, rect.x + r, rect.y);
  ctx.closePath();
}

function fillRoundRect(
  ctx: SKRSContext2D,
  rect: Rect,
  radius: number,
  fill: string,
  stroke?: string,
): void {
  roundRectPath(ctx, rect, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function wrapText(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): WrappedLines {
  const words = text.trim().split(/\s+/u);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const trial = current.length > 0 ? `${current} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth) {
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
  while (truncatedLine.length > 1 && ctx.measureText(truncatedLine).width > maxWidth) {
    truncatedLine = `${truncatedLine.slice(0, -2)}…`;
  }
  lines[lastIndex] = truncatedLine;

  return { lines, truncated: true };
}

function drawTextBlock(
  ctx: SKRSContext2D,
  options: {
    x: number;
    y: number;
    maxWidth: number;
    lineHeight: number;
    color: string;
    text: string;
    maxLines: number;
    fontSize: number;
    fontWeight: number;
    family: string;
  },
): { height: number; truncated: boolean; lines: string[] } {
  applyFont(ctx, { size: options.fontSize, weight: options.fontWeight, family: options.family });
  const wrapped = wrapText(ctx, options.text, options.maxWidth, options.maxLines);

  ctx.fillStyle = options.color;
  for (const [index, line] of wrapped.lines.entries()) {
    ctx.fillText(line, options.x, options.y + index * options.lineHeight);
  }

  return {
    height: wrapped.lines.length * options.lineHeight,
    truncated: wrapped.truncated,
    lines: wrapped.lines,
  };
}

function buildArtifactBaseName(
  spec: DesignSpec,
  specHash: string,
  generatorVersion: string,
): string {
  const safeVersion = generatorVersion.replace(/[^0-9A-Za-z_.-]/gu, '_');
  return `${spec.template}-g${safeVersion}-s${shortHash(specHash)}`;
}

function cardRect(
  index: number,
  totalCards: number,
  safe: DesignSafeFrame,
  cardsTop: number,
  cardsBottom: number,
  columns: number,
  gap: number,
): Rect {
  const effectiveColumns = Math.max(1, Math.min(columns, totalCards));
  const rows = Math.ceil(totalCards / effectiveColumns);

  const availableWidth = safe.width - gap * (effectiveColumns - 1);
  const availableHeight = cardsBottom - cardsTop - gap * (rows - 1);

  const width = Math.floor(availableWidth / effectiveColumns);
  const height = Math.floor(availableHeight / rows);

  const row = Math.floor(index / effectiveColumns);
  const col = index % effectiveColumns;

  return {
    x: safe.x + col * (width + gap),
    y: cardsTop + row * (height + gap),
    width,
    height,
  };
}

export function computeSpecHash(spec: DesignSpec): string {
  return sha256Hex(canonicalJson(spec));
}

export async function renderDesign(
  input: DesignSpec,
  options: { generatorVersion?: string; renderedAt?: string } = {},
): Promise<RenderResult> {
  const spec = parseDesignSpec(input);
  const safeFrame = deriveSafeFrame(spec);
  const specHash = computeSpecHash(spec);
  const generatorVersion = options.generatorVersion ?? DEFAULT_GENERATOR_VERSION;
  const renderedAt = options.renderedAt ?? new Date().toISOString();

  const canvas = createCanvas(spec.canvas.width, spec.canvas.height);
  const ctx = canvas.getContext('2d');

  const backgroundGradient = ctx.createLinearGradient(0, 0, spec.canvas.width, spec.canvas.height);
  backgroundGradient.addColorStop(0, spec.theme.background);
  backgroundGradient.addColorStop(1, spec.theme.surfaceMuted);
  ctx.fillStyle = backgroundGradient;
  ctx.fillRect(0, 0, spec.canvas.width, spec.canvas.height);

  const elements: RenderedElement[] = [];

  const headerRect: Rect = {
    x: safeFrame.x,
    y: safeFrame.y,
    width: safeFrame.width,
    height: Math.round(safeFrame.height * 0.28),
  };
  const footerRect: Rect = {
    x: safeFrame.x,
    y: safeFrame.y + safeFrame.height - Math.round(safeFrame.height * 0.12),
    width: safeFrame.width,
    height: Math.round(safeFrame.height * 0.12),
  };

  const cardsTop = headerRect.y + headerRect.height + spec.layout.sectionGap;
  const cardsBottom = footerRect.y - spec.layout.sectionGap;

  applyFont(ctx, { size: 16, weight: 700, family: spec.theme.monoFontFamily });
  ctx.fillStyle = spec.theme.primary;
  ctx.fillText(spec.header.eyebrow.toUpperCase(), headerRect.x, headerRect.y + 18);

  const titleBlock = drawTextBlock(ctx, {
    x: headerRect.x,
    y: headerRect.y + 58,
    maxWidth: headerRect.width,
    lineHeight: 50,
    color: spec.theme.text,
    text: spec.header.title,
    maxLines: 2,
    fontSize: 44,
    fontWeight: 800,
    family: spec.theme.fontFamily,
  });

  let subtitleTruncated = false;
  if (spec.header.subtitle) {
    const subtitleBlock = drawTextBlock(ctx, {
      x: headerRect.x,
      y: headerRect.y + 58 + titleBlock.height + 12,
      maxWidth: headerRect.width,
      lineHeight: 28,
      color: spec.theme.textMuted,
      text: spec.header.subtitle,
      maxLines: 2,
      fontSize: 22,
      fontWeight: 500,
      family: spec.theme.fontFamily,
    });
    subtitleTruncated = subtitleBlock.truncated;
  }

  elements.push({
    id: 'header',
    kind: 'header',
    bounds: headerRect,
    foregroundColor: spec.theme.text,
    backgroundColor: spec.theme.background,
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
    foregroundColor: spec.theme.text,
    backgroundColor: spec.theme.background,
    truncated: titleBlock.truncated || subtitleTruncated,
  });

  for (const [index, card] of spec.cards.entries()) {
    const rect = cardRect(
      index,
      spec.cards.length,
      safeFrame,
      cardsTop,
      cardsBottom,
      spec.layout.columns,
      spec.layout.cardGap,
    );
    fillRoundRect(ctx, rect, spec.layout.cornerRadius, spec.theme.surface, '#32426E');

    const padding = 18;
    const innerLeft = rect.x + padding;
    const innerWidth = rect.width - padding * 2;
    let cursorY = rect.y + padding;

    if (card.badge) {
      applyFont(ctx, { size: 13, weight: 700, family: spec.theme.monoFontFamily });
      const label = card.badge.toUpperCase();
      const badgeWidth = Math.ceil(ctx.measureText(label).width + 18);
      const badgeRect: Rect = {
        x: innerLeft,
        y: cursorY,
        width: badgeWidth,
        height: 24,
      };
      const badgeBg = TONE_BADGE_COLORS[card.tone];
      fillRoundRect(ctx, badgeRect, 12, badgeBg);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(label, badgeRect.x + 9, badgeRect.y + 16);

      elements.push({
        id: `card-${card.id}-badge`,
        kind: 'badge',
        bounds: badgeRect,
        foregroundColor: '#FFFFFF',
        backgroundColor: badgeBg,
      });

      cursorY += 34;
    }

    const titleBlockCard = drawTextBlock(ctx, {
      x: innerLeft,
      y: cursorY + 22,
      maxWidth: innerWidth,
      lineHeight: 26,
      color: spec.theme.text,
      text: card.title,
      maxLines: 2,
      fontSize: 22,
      fontWeight: 700,
      family: spec.theme.fontFamily,
    });
    cursorY += titleBlockCard.height + 18;

    const bodyBlock = drawTextBlock(ctx, {
      x: innerLeft,
      y: cursorY + 20,
      maxWidth: innerWidth,
      lineHeight: 22,
      color: spec.theme.textMuted,
      text: card.body,
      maxLines: 4,
      fontSize: 18,
      fontWeight: 500,
      family: spec.theme.fontFamily,
    });

    let cardTruncated = titleBlockCard.truncated || bodyBlock.truncated;

    if (card.metric) {
      applyFont(ctx, { size: 34, weight: 800, family: spec.theme.fontFamily });
      ctx.fillStyle = spec.theme.accent;
      ctx.fillText(card.metric, innerLeft, rect.y + rect.height - 20);
      elements.push({
        id: `card-${card.id}-metric`,
        kind: 'text',
        bounds: {
          x: innerLeft,
          y: rect.y + rect.height - 54,
          width: innerWidth,
          height: 40,
        },
        foregroundColor: spec.theme.accent,
        backgroundColor: spec.theme.surface,
      });
    }

    if (cursorY + bodyBlock.height + 24 > rect.y + rect.height) {
      cardTruncated = true;
    }

    elements.push({
      id: `card-${card.id}`,
      kind: 'card',
      bounds: rect,
      foregroundColor: spec.theme.text,
      backgroundColor: spec.theme.surface,
      truncated: cardTruncated,
    });
    elements.push({
      id: `card-${card.id}-body`,
      kind: 'text',
      bounds: {
        x: innerLeft,
        y: rect.y + 10,
        width: innerWidth,
        height: rect.height - 20,
      },
      foregroundColor: spec.theme.textMuted,
      backgroundColor: spec.theme.surface,
      truncated: cardTruncated,
    });
  }

  const footerText = spec.footer.tagline
    ? `${spec.footer.text} • ${spec.footer.tagline}`
    : spec.footer.text;
  applyFont(ctx, { size: 16, weight: 600, family: spec.theme.monoFontFamily });
  ctx.fillStyle = spec.theme.footerText;
  ctx.fillText(footerText, footerRect.x, footerRect.y + footerRect.height - 10);

  elements.push({
    id: 'footer',
    kind: 'footer',
    bounds: footerRect,
    foregroundColor: spec.theme.footerText,
    backgroundColor: spec.theme.background,
  });

  const pngBuffer = Buffer.from(await canvas.encode('png'));
  const artifactHash = sha256Hex(pngBuffer);
  const artifactBaseName = buildArtifactBaseName(spec, specHash, generatorVersion);

  const metadata: RenderMetadata = {
    schemaVersion: 1,
    generatorVersion,
    renderedAt,
    template: spec.template,
    specHash,
    artifactHash,
    artifactBaseName,
    canvas: {
      width: spec.canvas.width,
      height: spec.canvas.height,
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
