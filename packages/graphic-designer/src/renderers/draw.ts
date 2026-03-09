import type { SKRSContext2D } from '@napi-rs/canvas';
import { drawGradientRect } from '../primitives/gradients.js';
import { type Point, drawArrowhead, drawBezier, drawLine } from '../primitives/lines.js';
import { roundRectPath } from '../primitives/shapes.js';
import { applyFont, resolveFont } from '../primitives/text.js';
import type { Rect, RenderedElement } from '../renderer.js';
import type { DrawCommand, DrawFontFamily, Theme } from '../spec.schema.js';
import { type SvgPathOperation, parseSvgPath } from '../utils/svg-path.js';

function withOpacity(ctx: SKRSContext2D, opacity: number, draw: () => void): void {
  ctx.save();
  ctx.globalAlpha = opacity;
  draw();
  ctx.restore();
}

function expandRect(rect: Rect, amount: number): Rect {
  if (amount <= 0) {
    return rect;
  }

  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  };
}

function fromPoints(points: Point[]): Rect {
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function resolveDrawFont(theme: Theme, family: DrawFontFamily): string {
  return resolveFont(theme.fonts[family], family);
}

function measureSpacedTextWidth(ctx: SKRSContext2D, text: string, letterSpacing: number): number {
  const chars = [...text];
  if (chars.length === 0) {
    return 0;
  }

  let width = 0;
  for (const char of chars) {
    width += ctx.measureText(char).width;
  }

  if (chars.length > 1) {
    width += letterSpacing * (chars.length - 1);
  }

  return width;
}

function drawTextWithLetterSpacing(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  align: 'left' | 'center' | 'right',
  letterSpacing: number,
): void {
  const chars = [...text];
  if (chars.length === 0) {
    return;
  }

  const totalWidth = measureSpacedTextWidth(ctx, text, letterSpacing);
  let cursor = x;
  if (align === 'center') {
    cursor = x - totalWidth / 2;
  } else if (align === 'right') {
    cursor = x - totalWidth;
  }

  const originalAlign = ctx.textAlign;
  ctx.textAlign = 'left';

  for (const [index, char] of chars.entries()) {
    ctx.fillText(char, cursor, y);
    const spacing = index < chars.length - 1 ? letterSpacing : 0;
    cursor += ctx.measureText(char).width + spacing;
  }

  ctx.textAlign = originalAlign;
}

function measureTextBounds(
  ctx: SKRSContext2D,
  options: {
    text: string;
    x: number;
    y: number;
    align: 'left' | 'center' | 'right';
    baseline: 'top' | 'middle' | 'alphabetic' | 'bottom';
    letterSpacing: number;
    maxWidth?: number;
  },
): Rect {
  const measuredWidth =
    options.letterSpacing > 0
      ? measureSpacedTextWidth(ctx, options.text, options.letterSpacing)
      : ctx.measureText(options.text).width;
  const width = options.maxWidth ? Math.min(measuredWidth, options.maxWidth) : measuredWidth;
  const metrics = ctx.measureText(options.text);
  const ascent = metrics.actualBoundingBoxAscent || 0;
  const descent = metrics.actualBoundingBoxDescent || 0;
  const height = Math.max(1, ascent + descent || Math.ceil((ascent || 0) * 1.35) || 1);

  const leftX =
    options.align === 'center'
      ? options.x - width / 2
      : options.align === 'right'
        ? options.x - width
        : options.x;

  let topY = options.y - ascent;
  if (options.baseline === 'top') {
    topY = options.y;
  } else if (options.baseline === 'middle') {
    topY = options.y - height / 2;
  } else if (options.baseline === 'bottom') {
    topY = options.y - height;
  }

  return {
    x: leftX,
    y: topY,
    width: Math.max(1, width),
    height,
  };
}

function angleBetween(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function pathBounds(operations: SvgPathOperation[]): Rect {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const include = (x: number, y: number): void => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  let currentX = 0;
  let currentY = 0;
  let subpathStartX = 0;
  let subpathStartY = 0;

  for (const operation of operations) {
    switch (operation.type) {
      case 'M':
        include(operation.x, operation.y);
        currentX = operation.x;
        currentY = operation.y;
        subpathStartX = operation.x;
        subpathStartY = operation.y;
        break;
      case 'L':
        include(operation.x, operation.y);
        include(currentX, currentY);
        currentX = operation.x;
        currentY = operation.y;
        break;
      case 'C':
        include(currentX, currentY);
        include(operation.cp1x, operation.cp1y);
        include(operation.cp2x, operation.cp2y);
        include(operation.x, operation.y);
        currentX = operation.x;
        currentY = operation.y;
        break;
      case 'Q':
        include(currentX, currentY);
        include(operation.cpx, operation.cpy);
        include(operation.x, operation.y);
        currentX = operation.x;
        currentY = operation.y;
        break;
      case 'Z':
        include(currentX, currentY);
        include(subpathStartX, subpathStartY);
        currentX = subpathStartX;
        currentY = subpathStartY;
        break;
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function applySvgOperations(ctx: SKRSContext2D, operations: SvgPathOperation[]): void {
  ctx.beginPath();
  for (const operation of operations) {
    switch (operation.type) {
      case 'M':
        ctx.moveTo(operation.x, operation.y);
        break;
      case 'L':
        ctx.lineTo(operation.x, operation.y);
        break;
      case 'C':
        ctx.bezierCurveTo(
          operation.cp1x,
          operation.cp1y,
          operation.cp2x,
          operation.cp2y,
          operation.x,
          operation.y,
        );
        break;
      case 'Q':
        ctx.quadraticCurveTo(operation.cpx, operation.cpy, operation.x, operation.y);
        break;
      case 'Z':
        ctx.closePath();
        break;
    }
  }
}

export function renderDrawCommands(
  ctx: SKRSContext2D,
  commands: DrawCommand[],
  theme: Theme,
): RenderedElement[] {
  const rendered: RenderedElement[] = [];

  for (const [index, command] of commands.entries()) {
    const id = `draw-${index}`;

    switch (command.type) {
      case 'rect': {
        const rect: Rect = {
          x: command.x,
          y: command.y,
          width: command.width,
          height: command.height,
        };

        withOpacity(ctx, command.opacity, () => {
          roundRectPath(ctx, rect, command.radius);
          if (command.fill) {
            ctx.fillStyle = command.fill;
            ctx.fill();
          }
          if (command.stroke && command.strokeWidth > 0) {
            ctx.lineWidth = command.strokeWidth;
            ctx.strokeStyle = command.stroke;
            ctx.stroke();
          }
        });

        const foregroundColor = command.stroke ?? command.fill;
        rendered.push({
          id,
          kind: 'draw',
          bounds: expandRect(rect, command.strokeWidth / 2),
          ...(foregroundColor ? { foregroundColor } : {}),
          ...(command.fill ? { backgroundColor: command.fill } : {}),
        });
        break;
      }
      case 'circle': {
        withOpacity(ctx, command.opacity, () => {
          ctx.beginPath();
          ctx.arc(command.cx, command.cy, command.radius, 0, Math.PI * 2);
          ctx.closePath();
          if (command.fill) {
            ctx.fillStyle = command.fill;
            ctx.fill();
          }
          if (command.stroke && command.strokeWidth > 0) {
            ctx.lineWidth = command.strokeWidth;
            ctx.strokeStyle = command.stroke;
            ctx.stroke();
          }
        });

        const foregroundColor = command.stroke ?? command.fill;
        rendered.push({
          id,
          kind: 'draw',
          bounds: expandRect(
            {
              x: command.cx - command.radius,
              y: command.cy - command.radius,
              width: command.radius * 2,
              height: command.radius * 2,
            },
            command.strokeWidth / 2,
          ),
          ...(foregroundColor ? { foregroundColor } : {}),
          ...(command.fill ? { backgroundColor: command.fill } : {}),
        });
        break;
      }
      case 'text': {
        const fontFamily = resolveDrawFont(theme, command.fontFamily);
        withOpacity(ctx, command.opacity, () => {
          applyFont(ctx, {
            size: command.fontSize,
            weight: command.fontWeight,
            family: fontFamily,
          });
          ctx.fillStyle = command.color;
          ctx.textAlign = command.align;
          ctx.textBaseline = command.baseline;

          if (command.letterSpacing > 0) {
            drawTextWithLetterSpacing(
              ctx,
              command.text,
              command.x,
              command.y,
              command.align,
              command.letterSpacing,
            );
          } else if (command.maxWidth) {
            ctx.fillText(command.text, command.x, command.y, command.maxWidth);
          } else {
            ctx.fillText(command.text, command.x, command.y);
          }
        });

        applyFont(ctx, {
          size: command.fontSize,
          weight: command.fontWeight,
          family: fontFamily,
        });

        rendered.push({
          id,
          kind: 'draw',
          bounds: measureTextBounds(ctx, {
            text: command.text,
            x: command.x,
            y: command.y,
            align: command.align,
            baseline: command.baseline,
            letterSpacing: command.letterSpacing,
            ...(command.maxWidth ? { maxWidth: command.maxWidth } : {}),
          }),
          foregroundColor: command.color,
          backgroundColor: theme.background,
        });
        break;
      }
      case 'line': {
        const from: Point = { x: command.x1, y: command.y1 };
        const to: Point = { x: command.x2, y: command.y2 };
        const lineAngle = angleBetween(from, to);

        withOpacity(ctx, command.opacity, () => {
          drawLine(ctx, from, to, {
            color: command.color,
            width: command.width,
            ...(command.dash ? { dash: command.dash } : {}),
          });

          if (command.arrow === 'end' || command.arrow === 'both') {
            drawArrowhead(ctx, to, lineAngle, command.arrowSize, command.color);
          }
          if (command.arrow === 'start' || command.arrow === 'both') {
            drawArrowhead(ctx, from, lineAngle + Math.PI, command.arrowSize, command.color);
          }
        });

        const arrowPadding = command.arrow === 'none' ? 0 : command.arrowSize;
        rendered.push({
          id,
          kind: 'draw',
          bounds: expandRect(fromPoints([from, to]), Math.max(command.width / 2, arrowPadding)),
          foregroundColor: command.color,
        });
        break;
      }
      case 'bezier': {
        const points = command.points;
        withOpacity(ctx, command.opacity, () => {
          drawBezier(ctx, points, {
            color: command.color,
            width: command.width,
            ...(command.dash ? { dash: command.dash } : {}),
          });

          const startAngle = points.length > 1 ? angleBetween(points[0], points[1]) : 0;
          const endAngle =
            points.length > 1
              ? angleBetween(points[points.length - 2], points[points.length - 1])
              : 0;

          if (command.arrow === 'end' || command.arrow === 'both') {
            drawArrowhead(
              ctx,
              points[points.length - 1],
              endAngle,
              command.arrowSize,
              command.color,
            );
          }
          if (command.arrow === 'start' || command.arrow === 'both') {
            drawArrowhead(ctx, points[0], startAngle + Math.PI, command.arrowSize, command.color);
          }
        });

        const arrowPadding = command.arrow === 'none' ? 0 : command.arrowSize;
        rendered.push({
          id,
          kind: 'draw',
          bounds: expandRect(fromPoints(points), Math.max(command.width / 2, arrowPadding)),
          foregroundColor: command.color,
        });
        break;
      }
      case 'path': {
        const operations = parseSvgPath(command.d);
        const baseBounds = pathBounds(operations);

        withOpacity(ctx, command.opacity, () => {
          applySvgOperations(ctx, operations);
          if (command.fill) {
            ctx.fillStyle = command.fill;
            ctx.fill();
          }
          if (command.stroke && command.strokeWidth > 0) {
            ctx.lineWidth = command.strokeWidth;
            ctx.strokeStyle = command.stroke;
            ctx.stroke();
          }
        });

        const foregroundColor = command.stroke ?? command.fill;
        rendered.push({
          id,
          kind: 'draw',
          bounds: expandRect(baseBounds, command.strokeWidth / 2),
          ...(foregroundColor ? { foregroundColor } : {}),
          ...(command.fill ? { backgroundColor: command.fill } : {}),
        });
        break;
      }
      case 'badge': {
        const fontFamily = resolveDrawFont(theme, command.fontFamily);
        applyFont(ctx, {
          size: command.fontSize,
          weight: 600,
          family: fontFamily,
        });
        const metrics = ctx.measureText(command.text);
        const textWidth = Math.ceil(metrics.width);
        const textHeight = Math.ceil(
          (metrics.actualBoundingBoxAscent || command.fontSize * 0.75) +
            (metrics.actualBoundingBoxDescent || command.fontSize * 0.25),
        );

        const rect: Rect = {
          x: command.x,
          y: command.y,
          width: textWidth + command.paddingX * 2,
          height: textHeight + command.paddingY * 2,
        };

        withOpacity(ctx, command.opacity, () => {
          roundRectPath(ctx, rect, command.borderRadius);
          ctx.fillStyle = command.background;
          ctx.fill();

          applyFont(ctx, {
            size: command.fontSize,
            weight: 600,
            family: fontFamily,
          });
          ctx.fillStyle = command.color;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(command.text, rect.x + rect.width / 2, rect.y + rect.height / 2);
        });

        rendered.push({
          id,
          kind: 'draw',
          bounds: rect,
          foregroundColor: command.color,
          backgroundColor: command.background,
        });
        break;
      }
      case 'gradient-rect': {
        const rect: Rect = {
          x: command.x,
          y: command.y,
          width: command.width,
          height: command.height,
        };

        withOpacity(ctx, command.opacity, () => {
          drawGradientRect(ctx, rect, command.gradient, command.radius);
        });

        rendered.push({
          id,
          kind: 'draw',
          bounds: rect,
          backgroundColor: command.gradient.stops[0].color,
        });
        break;
      }
    }
  }

  return rendered;
}
