import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { drawGradientRect } from '../primitives/gradients.js';
import { parseDesignSpec } from '../spec.schema.js';

describe('radial gradient custom center and radii', () => {
  describe('schema', () => {
    it('accepts radial gradient without custom fields (backward compatible)', () => {
      const spec = parseDesignSpec({
        elements: [],
        draw: [
          {
            type: 'gradient-rect',
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            gradient: {
              type: 'radial',
              stops: [
                { offset: 0, color: '#FFFFFF' },
                { offset: 1, color: '#000000' },
              ],
            },
          },
        ],
      });

      const cmd = spec.draw[0];
      expect(cmd.type).toBe('gradient-rect');
      if (cmd.type === 'gradient-rect') {
        expect(cmd.gradient.type).toBe('radial');
        if (cmd.gradient.type === 'radial') {
          expect(cmd.gradient.cx).toBeUndefined();
          expect(cmd.gradient.cy).toBeUndefined();
          expect(cmd.gradient.innerRadius).toBeUndefined();
          expect(cmd.gradient.outerRadius).toBeUndefined();
        }
      }
    });

    it('accepts radial gradient with custom cx, cy, innerRadius, outerRadius', () => {
      const spec = parseDesignSpec({
        elements: [],
        draw: [
          {
            type: 'gradient-rect',
            x: 0,
            y: 0,
            width: 840,
            height: 840,
            gradient: {
              type: 'radial',
              cx: 420,
              cy: 420,
              innerRadius: 50,
              outerRadius: 420,
              stops: [
                { offset: 0, color: '#FFFFFF' },
                { offset: 1, color: '#000000' },
              ],
            },
          },
        ],
      });

      const cmd = spec.draw[0];
      expect(cmd.type).toBe('gradient-rect');
      if (cmd.type === 'gradient-rect') {
        expect(cmd.gradient.type).toBe('radial');
        if (cmd.gradient.type === 'radial') {
          expect(cmd.gradient.cx).toBe(420);
          expect(cmd.gradient.cy).toBe(420);
          expect(cmd.gradient.innerRadius).toBe(50);
          expect(cmd.gradient.outerRadius).toBe(420);
        }
      }
    });

    it('accepts partial custom fields (only some specified)', () => {
      const spec = parseDesignSpec({
        elements: [],
        draw: [
          {
            type: 'gradient-rect',
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            gradient: {
              type: 'radial',
              innerRadius: 30,
              stops: [
                { offset: 0, color: '#FF0000' },
                { offset: 1, color: '#0000FF' },
              ],
            },
          },
        ],
      });

      const cmd = spec.draw[0];
      if (cmd.type === 'gradient-rect' && cmd.gradient.type === 'radial') {
        expect(cmd.gradient.cx).toBeUndefined();
        expect(cmd.gradient.cy).toBeUndefined();
        expect(cmd.gradient.innerRadius).toBe(30);
        expect(cmd.gradient.outerRadius).toBeUndefined();
      }
    });

    it('rejects negative innerRadius', () => {
      expect(() =>
        parseDesignSpec({
          elements: [],
          draw: [
            {
              type: 'gradient-rect',
              x: 0,
              y: 0,
              width: 200,
              height: 200,
              gradient: {
                type: 'radial',
                innerRadius: -10,
                stops: [
                  { offset: 0, color: '#FFFFFF' },
                  { offset: 1, color: '#000000' },
                ],
              },
            },
          ],
        }),
      ).toThrow();
    });

    it('rejects negative outerRadius', () => {
      expect(() =>
        parseDesignSpec({
          elements: [],
          draw: [
            {
              type: 'gradient-rect',
              x: 0,
              y: 0,
              width: 200,
              height: 200,
              gradient: {
                type: 'radial',
                outerRadius: -5,
                stops: [
                  { offset: 0, color: '#FFFFFF' },
                  { offset: 1, color: '#000000' },
                ],
              },
            },
          ],
        }),
      ).toThrow();
    });

    it('works in background gradient context', () => {
      const spec = parseDesignSpec({
        elements: [],
        background: {
          type: 'radial',
          cx: 600,
          cy: 337,
          innerRadius: 50,
          outerRadius: 400,
          stops: [
            { offset: 0, color: '#334B83' },
            { offset: 1, color: '#0B1020' },
          ],
        },
      });

      expect(spec.background).toBeDefined();
      if (spec.background && typeof spec.background === 'object' && 'type' in spec.background) {
        expect(spec.background.type).toBe('radial');
      }
    });
  });

  describe('rendering', () => {
    it('renders with default center and radii (backward compatible)', () => {
      const canvas = createCanvas(200, 200);
      const ctx = canvas.getContext('2d');

      // Should not throw — same behavior as before
      drawGradientRect(
        ctx,
        { x: 0, y: 0, width: 200, height: 200 },
        {
          type: 'radial',
          stops: [
            { offset: 0, color: '#FFFFFF' },
            { offset: 1, color: '#000000' },
          ],
        },
      );

      // Center pixel should be lighter (closer to white)
      const center = ctx.getImageData(100, 100, 1, 1).data;
      const corner = ctx.getImageData(0, 0, 1, 1).data;
      const centerLuma = center[0] + center[1] + center[2];
      const cornerLuma = corner[0] + corner[1] + corner[2];
      expect(centerLuma).toBeGreaterThan(cornerLuma);
    });

    it('renders with custom center point', () => {
      const canvas = createCanvas(200, 200);
      const ctx = canvas.getContext('2d');

      // Place gradient center at top-left quadrant
      drawGradientRect(
        ctx,
        { x: 0, y: 0, width: 200, height: 200 },
        {
          type: 'radial',
          cx: 50,
          cy: 50,
          stops: [
            { offset: 0, color: '#FFFFFF' },
            { offset: 1, color: '#000000' },
          ],
        },
      );

      // Point near custom center (50,50) should be lighter than far corner (199,199)
      const nearCenter = ctx.getImageData(50, 50, 1, 1).data;
      const farCorner = ctx.getImageData(199, 199, 1, 1).data;
      const nearLuma = nearCenter[0] + nearCenter[1] + nearCenter[2];
      const farLuma = farCorner[0] + farCorner[1] + farCorner[2];
      expect(nearLuma).toBeGreaterThan(farLuma);
    });

    it('renders with custom inner radius (creates a flat center)', () => {
      const canvas = createCanvas(200, 200);
      const ctx = canvas.getContext('2d');

      drawGradientRect(
        ctx,
        { x: 0, y: 0, width: 200, height: 200 },
        {
          type: 'radial',
          innerRadius: 50,
          outerRadius: 100,
          stops: [
            { offset: 0, color: '#FFFFFF' },
            { offset: 1, color: '#000000' },
          ],
        },
      );

      // Two points within the inner radius should have the same color (both white)
      const p1 = ctx.getImageData(100, 100, 1, 1).data;
      const p2 = ctx.getImageData(80, 100, 1, 1).data;
      expect(p1[0]).toBe(p2[0]);
      expect(p1[1]).toBe(p2[1]);
      expect(p1[2]).toBe(p2[2]);
    });

    it('renders with all custom fields matching reference script pattern', () => {
      const W = 840;
      const H = 840;
      const canvas = createCanvas(W, H);
      const ctx = canvas.getContext('2d');

      // Reference pattern: createRadialGradient(W/2, H/2, 50, W/2, H/2, 420)
      drawGradientRect(
        ctx,
        { x: 0, y: 0, width: W, height: H },
        {
          type: 'radial',
          cx: W / 2,
          cy: H / 2,
          innerRadius: 50,
          outerRadius: 420,
          stops: [
            { offset: 0, color: '#FFFFFF' },
            { offset: 1, color: '#000000' },
          ],
        },
      );

      // Center should be white (within inner radius)
      const center = ctx.getImageData(W / 2, H / 2, 1, 1).data;
      expect(center[0]).toBe(255);
      expect(center[1]).toBe(255);
      expect(center[2]).toBe(255);
    });

    it('renders with border radius and custom gradient fields', () => {
      const canvas = createCanvas(300, 300);
      const ctx = canvas.getContext('2d');

      // Should not throw
      drawGradientRect(
        ctx,
        { x: 20, y: 20, width: 260, height: 260 },
        {
          type: 'radial',
          cx: 150,
          cy: 150,
          innerRadius: 20,
          outerRadius: 130,
          stops: [
            { offset: 0, color: '#7AA2FF' },
            { offset: 1, color: '#1A2547' },
          ],
        },
        16,
      );

      const png = canvas.toBuffer('image/png');
      expect(png.byteLength).toBeGreaterThan(512);
    });
  });
});
