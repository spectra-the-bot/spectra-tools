import { type SKRSContext2D, loadImage } from '@napi-rs/canvas';
import { applyFont, resolveFont } from '../primitives/text.js';
import type { Rect, RenderedElement } from '../renderer.js';
import type { ImageElement, Theme } from '../spec.schema.js';

function roundedRectPath(ctx: SKRSContext2D, bounds: Rect, radius: number): void {
  const r = Math.max(0, Math.min(radius, Math.min(bounds.width, bounds.height) / 2));
  ctx.beginPath();
  ctx.moveTo(bounds.x + r, bounds.y);
  ctx.lineTo(bounds.x + bounds.width - r, bounds.y);
  ctx.quadraticCurveTo(bounds.x + bounds.width, bounds.y, bounds.x + bounds.width, bounds.y + r);
  ctx.lineTo(bounds.x + bounds.width, bounds.y + bounds.height - r);
  ctx.quadraticCurveTo(
    bounds.x + bounds.width,
    bounds.y + bounds.height,
    bounds.x + bounds.width - r,
    bounds.y + bounds.height,
  );
  ctx.lineTo(bounds.x + r, bounds.y + bounds.height);
  ctx.quadraticCurveTo(bounds.x, bounds.y + bounds.height, bounds.x, bounds.y + bounds.height - r);
  ctx.lineTo(bounds.x, bounds.y + r);
  ctx.quadraticCurveTo(bounds.x, bounds.y, bounds.x + r, bounds.y);
  ctx.closePath();
}

function drawImagePlaceholder(
  ctx: SKRSContext2D,
  image: ImageElement,
  bounds: Rect,
  theme: Theme,
): RenderedElement[] {
  ctx.fillStyle = theme.surfaceMuted;
  roundedRectPath(ctx, bounds, image.borderRadius);
  ctx.fill();

  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 2;
  roundedRectPath(ctx, bounds, image.borderRadius);
  ctx.stroke();

  const label = image.alt ?? 'load image';
  const fontFamily = resolveFont(theme.fonts.body, 'body');
  applyFont(ctx, { size: 16, weight: 600, family: fontFamily });
  ctx.fillStyle = theme.textMuted;
  ctx.textAlign = 'center';
  ctx.fillText(label, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  ctx.textAlign = 'left';

  return [
    {
      id: `image-${image.id}`,
      kind: 'image',
      bounds,
      foregroundColor: theme.textMuted,
      backgroundColor: theme.surfaceMuted,
    },
  ];
}

export async function renderImageElement(
  ctx: SKRSContext2D,
  image: ImageElement,
  bounds: Rect,
  theme: Theme,
): Promise<RenderedElement[]> {
  try {
    const loadedImage = await loadImage(image.src);

    let drawWidth = loadedImage.width;
    let drawHeight = loadedImage.height;

    if (image.fit !== 'fill') {
      const widthRatio = bounds.width / loadedImage.width;
      const heightRatio = bounds.height / loadedImage.height;

      let scale = 1;
      if (image.fit === 'contain') {
        scale = Math.min(widthRatio, heightRatio);
      } else if (image.fit === 'cover') {
        scale = Math.max(widthRatio, heightRatio);
      }

      drawWidth = loadedImage.width * scale;
      drawHeight = loadedImage.height * scale;
    } else {
      drawWidth = bounds.width;
      drawHeight = bounds.height;
    }

    const drawX = bounds.x + (bounds.width - drawWidth) / 2;
    const drawY = bounds.y + (bounds.height - drawHeight) / 2;

    ctx.save();
    roundedRectPath(ctx, bounds, image.borderRadius);
    ctx.clip();
    ctx.drawImage(loadedImage, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();

    return [
      {
        id: `image-${image.id}`,
        kind: 'image',
        bounds,
      },
    ];
  } catch {
    // TODO: Consider surfacing an explicit image-load warning in metadata.
    return drawImagePlaceholder(ctx, image, bounds, theme);
  }
}
