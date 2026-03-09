import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import type { Rect, RenderMetadata, RenderedElement } from './renderer.js';
import { type DesignSpec, deriveSafeFrame, parseDesignSpec } from './spec.schema.js';
import { contrastRatio } from './utils/color.js';

export type QaSeverity = 'error' | 'warning';

export type QaIssue = {
  code:
    | 'DIMENSIONS_MISMATCH'
    | 'ELEMENT_CLIPPED'
    | 'ELEMENT_OVERLAP'
    | 'LOW_CONTRAST'
    | 'FOOTER_SPACING'
    | 'TEXT_TRUNCATED'
    | 'MISSING_LAYOUT';
  severity: QaSeverity;
  message: string;
  elementId?: string;
  details?: Record<string, number | string | boolean>;
};

export type QaReport = {
  pass: boolean;
  checkedAt: string;
  imagePath: string;
  expected: {
    width: number;
    height: number;
    minContrastRatio: number;
    minFooterSpacingPx: number;
  };
  measured: {
    width?: number;
    height?: number;
    footerSpacingPx?: number;
  };
  issues: QaIssue[];
};

function rectWithin(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

function intersects(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function canvasRect(spec: DesignSpec): Rect {
  return {
    x: 0,
    y: 0,
    width: spec.canvas.width,
    height: spec.canvas.height,
  };
}

function topLevelElements(elements: RenderedElement[]): RenderedElement[] {
  return elements.filter((element) => ['header', 'card', 'footer'].includes(element.kind));
}

function loadMetadataFromString(raw: string): RenderMetadata {
  return JSON.parse(raw) as RenderMetadata;
}

export async function readMetadata(path: string): Promise<RenderMetadata> {
  const raw = await readFile(resolve(path), 'utf8');
  return loadMetadataFromString(raw);
}

export async function runQa(options: {
  imagePath: string;
  spec: DesignSpec;
  metadata?: RenderMetadata;
}): Promise<QaReport> {
  const spec = parseDesignSpec(options.spec);
  const imagePath = resolve(options.imagePath);
  const expectedSafeFrame = deriveSafeFrame(spec);
  const expectedCanvas = canvasRect(spec);

  const metadata = await sharp(imagePath).metadata();
  const issues: QaIssue[] = [];

  if (metadata.width !== spec.canvas.width || metadata.height !== spec.canvas.height) {
    issues.push({
      code: 'DIMENSIONS_MISMATCH',
      severity: 'error',
      message: `Image dimensions ${metadata.width ?? '?'}x${metadata.height ?? '?'} do not match expected ${spec.canvas.width}x${spec.canvas.height}.`,
      details: {
        expectedWidth: spec.canvas.width,
        expectedHeight: spec.canvas.height,
        actualWidth: metadata.width ?? -1,
        actualHeight: metadata.height ?? -1,
      },
    });
  }

  const layoutElements = options.metadata?.layout.elements;
  if (!layoutElements || layoutElements.length === 0) {
    issues.push({
      code: 'MISSING_LAYOUT',
      severity: 'warning',
      message: 'No layout metadata provided; overlap/clipping checks are partially skipped.',
    });
  } else {
    for (const element of layoutElements) {
      if (element.truncated) {
        issues.push({
          code: 'TEXT_TRUNCATED',
          severity: 'error',
          message: `Text for ${element.id} was truncated during render.`,
          elementId: element.id,
        });
      }

      if (
        !rectWithin(expectedCanvas, element.bounds) ||
        !rectWithin(expectedSafeFrame, element.bounds)
      ) {
        const inCanvas = rectWithin(expectedCanvas, element.bounds);
        const inSafe = rectWithin(expectedSafeFrame, element.bounds);
        issues.push({
          code: 'ELEMENT_CLIPPED',
          severity: 'error',
          message: `Element ${element.id} breaches ${!inCanvas ? 'canvas bounds' : 'safe frame'}.`,
          elementId: element.id,
          details: {
            inCanvas,
            inSafeFrame: inSafe,
            x: element.bounds.x,
            y: element.bounds.y,
            width: element.bounds.width,
            height: element.bounds.height,
          },
        });
      }

      if (element.foregroundColor && element.backgroundColor) {
        const ratio = contrastRatio(element.foregroundColor, element.backgroundColor);
        if (ratio < spec.constraints.minContrastRatio) {
          issues.push({
            code: 'LOW_CONTRAST',
            severity: 'error',
            message: `Contrast ratio ${ratio.toFixed(2)} for ${element.id} is below threshold ${spec.constraints.minContrastRatio}.`,
            elementId: element.id,
            details: {
              ratio: Number(ratio.toFixed(4)),
              threshold: spec.constraints.minContrastRatio,
            },
          });
        }
      }
    }

    if (spec.constraints.checkOverlaps) {
      const blocks = topLevelElements(layoutElements);
      for (let i = 0; i < blocks.length; i += 1) {
        for (let j = i + 1; j < blocks.length; j += 1) {
          const first = blocks[i];
          const second = blocks[j];
          if (first.allowOverlap || second.allowOverlap) {
            continue;
          }
          if (intersects(first.bounds, second.bounds)) {
            issues.push({
              code: 'ELEMENT_OVERLAP',
              severity: 'error',
              message: `Elements ${first.id} and ${second.id} overlap.`,
              elementId: `${first.id}|${second.id}`,
            });
          }
        }
      }
    }

    const footer = layoutElements.find((element) => element.id === 'footer');
    const nonFooter = topLevelElements(layoutElements).filter((element) => element.id !== 'footer');
    if (footer && nonFooter.length > 0) {
      const highestBottom = Math.max(
        ...nonFooter.map((element) => element.bounds.y + element.bounds.height),
      );
      const spacing = footer.bounds.y - highestBottom;
      if (spacing < spec.constraints.minFooterSpacingPx) {
        issues.push({
          code: 'FOOTER_SPACING',
          severity: 'error',
          message: `Footer spacing ${spacing}px is below minimum ${spec.constraints.minFooterSpacingPx}px.`,
          elementId: 'footer',
          details: {
            spacing,
            min: spec.constraints.minFooterSpacingPx,
          },
        });
      }
    }
  }

  const footerSpacingPx = options.metadata?.layout.elements
    ? (() => {
        const footer = options.metadata.layout.elements.find((element) => element.id === 'footer');
        if (!footer) {
          return undefined;
        }
        const nonFooter = topLevelElements(options.metadata.layout.elements).filter(
          (element) => element.id !== 'footer',
        );
        if (nonFooter.length === 0) {
          return undefined;
        }
        const highestBottom = Math.max(
          ...nonFooter.map((element) => element.bounds.y + element.bounds.height),
        );
        return footer.bounds.y - highestBottom;
      })()
    : undefined;

  return {
    pass: issues.every((issue) => issue.severity !== 'error'),
    checkedAt: new Date().toISOString(),
    imagePath,
    expected: {
      width: spec.canvas.width,
      height: spec.canvas.height,
      minContrastRatio: spec.constraints.minContrastRatio,
      minFooterSpacingPx: spec.constraints.minFooterSpacingPx,
    },
    measured: {
      ...(metadata.width !== undefined ? { width: metadata.width } : {}),
      ...(metadata.height !== undefined ? { height: metadata.height } : {}),
      ...(footerSpacingPx !== undefined ? { footerSpacingPx } : {}),
    },
    issues,
  };
}
