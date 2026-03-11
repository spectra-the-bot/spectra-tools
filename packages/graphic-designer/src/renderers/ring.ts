import type { SKRSContext2D } from '@napi-rs/canvas';
import { applyFont, resolveFont } from '../primitives/text.js';
import type { Rect, RenderedElement } from '../renderer.js';
import type { RingElement, Theme } from '../spec.schema.js';

/**
 * Render a ring element with colored arc segments, optional glow, cycle arrows,
 * and centered label.
 *
 * Rendering order (back to front):
 * 1. Outer glow — circle with glowRadius, low opacity
 * 2. Inner fill — circle at fillOpacity
 * 3. Main ring stroke
 * 4. Colored segments — N arc strokes
 * 5. Cycle arrows (if showCycleArrows: true)
 * 6. Centered label (multi-line)
 */
export function renderRingElement(
  ctx: SKRSContext2D,
  ring: RingElement,
  bounds: Rect,
  theme: Theme,
): RenderedElement[] {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const { radius, strokeWidth, segments } = ring;

  // 1. Outer glow
  if (ring.glowRadius > 0) {
    const glowColor = ring.glowColor ?? segments[0].color;
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + ring.glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = glowColor;
    ctx.fill();
    ctx.restore();
  }

  // 2. Inner fill
  if (ring.fill || ring.fillOpacity > 0) {
    const fillColor = ring.fill ?? segments[0].color;
    ctx.save();
    ctx.globalAlpha = ring.fillOpacity;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.restore();
  }

  // 3. Main ring stroke (base, drawn underneath segments for visual consistency)
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = strokeWidth;
  ctx.stroke();
  ctx.restore();

  // 4. Colored segments — equal arcs
  const segmentAngle = (2 * Math.PI) / segments.length;
  for (let i = 0; i < segments.length; i++) {
    const startAngle = i * segmentAngle - Math.PI / 2; // start from top
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + segmentAngle);
    ctx.strokeStyle = segments[i].color;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }

  // 5. Cycle arrows
  if (ring.showCycleArrows) {
    const arrowArcRadius = radius + strokeWidth + 4;
    const arrowColor = segments[0].color;
    const numArrows = Math.min(segments.length, 4);
    const arrowSpacing = (2 * Math.PI) / numArrows;

    for (let i = 0; i < numArrows; i++) {
      const baseAngle = i * arrowSpacing - Math.PI / 2;
      const arcStart = baseAngle + 0.15;
      const arcEnd = baseAngle + arrowSpacing - 0.15;

      // Arrow arc
      ctx.beginPath();
      ctx.arc(cx, cy, arrowArcRadius, arcStart, arcEnd);
      ctx.strokeStyle = arrowColor;
      ctx.lineWidth = Math.max(1, strokeWidth * 0.6);
      ctx.stroke();

      // Arrowhead at the end of the arc
      const headAngle = arcEnd;
      const headX = cx + arrowArcRadius * Math.cos(headAngle);
      const headY = cy + arrowArcRadius * Math.sin(headAngle);

      // Tangent direction at the arrowhead point (perpendicular to radius)
      const tangentAngle = headAngle + Math.PI / 2;
      const headSize = Math.max(4, strokeWidth * 2);

      ctx.beginPath();
      ctx.moveTo(headX, headY);
      ctx.lineTo(
        headX - headSize * Math.cos(tangentAngle - 0.4),
        headY - headSize * Math.sin(tangentAngle - 0.4),
      );
      ctx.lineTo(
        headX - headSize * Math.cos(tangentAngle + 0.4),
        headY - headSize * Math.sin(tangentAngle + 0.4),
      );
      ctx.closePath();
      ctx.fillStyle = arrowColor;
      ctx.fill();
    }
  }

  // 6. Centered label (supports \n for multiline)
  if (ring.label) {
    const labelColor = ring.labelColor ?? theme.text;
    const labelSize = ring.labelSize;
    const bodyFont = resolveFont(theme.fonts.body, 'body');
    applyFont(ctx, { size: labelSize, weight: 500, family: bodyFont });
    ctx.fillStyle = labelColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = ring.label.split('\\n');
    const lineHeight = labelSize * 1.3;
    const totalHeight = lines.length * lineHeight;
    const startY = cy - totalHeight / 2 + lineHeight / 2;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], cx, startY + i * lineHeight);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  return [
    {
      id: `ring-${ring.id}`,
      kind: 'shape',
      bounds,
      foregroundColor: segments[0].color,
    },
  ];
}
