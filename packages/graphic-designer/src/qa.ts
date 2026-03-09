import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { resolveRenderScale } from './code-style.js';
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
    | 'MISSING_LAYOUT'
    | 'DRAW_OUT_OF_BOUNDS';
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
    scale: number;
    minContrastRatio: number;
    minFooterSpacing: number;
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

function overlapCandidates(elements: RenderedElement[]): RenderedElement[] {
  return elements.filter((element) =>
    [
      'header',
      'card',
      'footer',
      'flow-node',
      'terminal',
      'code-block',
      'shape',
      'image',
      'draw',
    ].includes(element.kind),
  );
}

function loadMetadataFromString(raw: string): RenderMetadata {
  return JSON.parse(raw) as RenderMetadata;
}

/**
 * Read and parse a sidecar `.meta.json` file produced by
 * {@link writeRenderArtifacts}.
 *
 * @param path - Absolute or relative path to the `.meta.json` sidecar file.
 * @returns The parsed {@link RenderMetadata} object.
 */
export async function readMetadata(path: string): Promise<RenderMetadata> {
  const raw = await readFile(resolve(path), 'utf8');
  return loadMetadataFromString(raw);
}

/**
 * Run quality-assurance checks on a rendered design image.
 *
 * Validates the rendered PNG against the source spec and optional metadata.
 * Checks include: dimension matching, element clipping against the safe frame,
 * element overlap detection, WCAG contrast ratio, footer spacing, text
 * truncation, and draw-command bounds.
 *
 * @param options - QA configuration.
 * @param options.imagePath - Path to the rendered PNG image to validate.
 * @param options.spec - The {@link DesignSpec} used to produce the image.
 * @param options.metadata - Optional {@link RenderMetadata} from the render
 *   pass. When provided, layout-level checks (overlap, clipping, contrast) are
 *   performed against the element positions recorded in the metadata.
 * @returns A {@link QaReport} summarising whether the image passes and listing
 *   any issues found.
 */
export async function runQa(options: {
  imagePath: string;
  spec: DesignSpec;
  metadata?: RenderMetadata;
}): Promise<QaReport> {
  const spec = parseDesignSpec(options.spec);
  const imagePath = resolve(options.imagePath);
  const expectedSafeFrame = deriveSafeFrame(spec);
  const expectedCanvas = canvasRect(spec);

  const imageMetadata = await sharp(imagePath).metadata();
  const issues: QaIssue[] = [];

  const expectedScale = options.metadata?.canvas.scale ?? resolveRenderScale(spec);
  const expectedWidth = spec.canvas.width * expectedScale;
  const expectedHeight = spec.canvas.height * expectedScale;

  if (imageMetadata.width !== expectedWidth || imageMetadata.height !== expectedHeight) {
    issues.push({
      code: 'DIMENSIONS_MISMATCH',
      severity: 'error',
      message: `Image dimensions ${imageMetadata.width ?? '?'}x${imageMetadata.height ?? '?'} do not match expected ${expectedWidth}x${expectedHeight}.`,
      details: {
        expectedWidth,
        expectedHeight,
        actualWidth: imageMetadata.width ?? -1,
        actualHeight: imageMetadata.height ?? -1,
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

      const inCanvas = rectWithin(expectedCanvas, element.bounds);
      const inSafe = rectWithin(expectedSafeFrame, element.bounds);
      const requiresSafeFrameContainment = !element.allowOverlap && element.kind !== 'draw';

      if (element.kind === 'draw' && !inCanvas) {
        issues.push({
          code: 'DRAW_OUT_OF_BOUNDS',
          severity: 'warning',
          message: `Draw command ${element.id} extends beyond canvas bounds.`,
          elementId: element.id,
          details: {
            inCanvas,
            x: element.bounds.x,
            y: element.bounds.y,
            width: element.bounds.width,
            height: element.bounds.height,
          },
        });
      } else if (!inCanvas || (requiresSafeFrameContainment && !inSafe)) {
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
      const blocks = overlapCandidates(layoutElements);
      for (let i = 0; i < blocks.length; i += 1) {
        for (let j = i + 1; j < blocks.length; j += 1) {
          const first = blocks[i];
          const second = blocks[j];
          if (first.allowOverlap || second.allowOverlap) {
            continue;
          }
          if (intersects(first.bounds, second.bounds)) {
            const relaxed = first.kind === 'draw' || second.kind === 'draw';
            issues.push({
              code: 'ELEMENT_OVERLAP',
              severity: relaxed ? 'warning' : 'error',
              message: `Elements ${first.id} and ${second.id} overlap.${
                relaxed ? ' (Draw overlap is informational.)' : ''
              }`,
              elementId: `${first.id}|${second.id}`,
            });
          }
        }
      }
    }

    if (spec.footer) {
      const footer = layoutElements.find((element) => element.id === 'footer');
      const nonFooter = topLevelElements(layoutElements).filter(
        (element) => element.id !== 'footer',
      );
      if (footer && nonFooter.length > 0) {
        const highestBottom = Math.max(
          ...nonFooter.map((element) => element.bounds.y + element.bounds.height),
        );
        const spacing = footer.bounds.y - highestBottom;
        if (spacing < spec.constraints.minFooterSpacing) {
          issues.push({
            code: 'FOOTER_SPACING',
            severity: 'error',
            message: `Footer spacing ${spacing}px is below minimum ${spec.constraints.minFooterSpacing}px.`,
            elementId: 'footer',
            details: {
              spacing,
              min: spec.constraints.minFooterSpacing,
            },
          });
        }
      }
    }

    if (spec.header) {
      const header = layoutElements.find((element) => element.id === 'header');
      if (header?.foregroundColor && header.backgroundColor) {
        const ratio = contrastRatio(header.foregroundColor, header.backgroundColor);
        if (ratio < spec.constraints.minContrastRatio) {
          issues.push({
            code: 'LOW_CONTRAST',
            severity: 'error',
            message: `Header contrast ratio ${ratio.toFixed(2)} is below threshold ${spec.constraints.minContrastRatio}.`,
            elementId: 'header',
          });
        }
      }
    }

    if (!spec.footer && layoutElements.some((element) => element.id === 'footer')) {
      issues.push({
        code: 'FOOTER_SPACING',
        severity: 'warning',
        message: 'Metadata includes a footer element but the spec has no footer.',
      });
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
      width: expectedWidth,
      height: expectedHeight,
      scale: expectedScale,
      minContrastRatio: spec.constraints.minContrastRatio,
      minFooterSpacing: spec.constraints.minFooterSpacing,
    },
    measured: {
      ...(imageMetadata.width !== undefined ? { width: imageMetadata.width } : {}),
      ...(imageMetadata.height !== undefined ? { height: imageMetadata.height } : {}),
      ...(footerSpacingPx !== undefined ? { footerSpacingPx } : {}),
    },
    issues,
  };
}
