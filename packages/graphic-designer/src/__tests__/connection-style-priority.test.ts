import { createCanvas } from '@napi-rs/canvas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderConnection } from '../renderers/connection.js';
import { connectionElementSchema } from '../spec.schema.js';
import { resolveTheme } from '../themes/index.js';

const theme = resolveTheme('dark');
const nodeA = { x: 100, y: 100, width: 180, height: 80 };
const nodeB = { x: 500, y: 300, width: 180, height: 80 };

function makeCtx() {
  const canvas = createCanvas(1200, 675);
  return canvas.getContext('2d');
}

describe('connection style vs strokeStyle priority', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('style: "dashed" renders a dashed connection', () => {
    const ctx = makeCtx();
    const conn = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
      style: 'dashed',
    });

    // style should resolve, strokeStyle should be undefined
    expect(conn.style).toBe('dashed');
    expect(conn.strokeStyle).toBeUndefined();

    // renderConnection should not throw and should not warn
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const elements = renderConnection(ctx, conn, nodeA, nodeB, theme);
    expect(elements.length).toBeGreaterThan(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('strokeStyle: "dashed" still works (backward compat) but triggers deprecation warning', () => {
    const ctx = makeCtx();
    const conn = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
      strokeStyle: 'dashed',
    });

    expect(conn.strokeStyle).toBe('dashed');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const elements = renderConnection(ctx, conn, nodeA, nodeB, theme);
    expect(elements.length).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalledWith('connection.strokeStyle is deprecated, use style instead');
  });

  it('when both style and strokeStyle are set, style wins', () => {
    const ctx = makeCtx();
    const conn = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
      style: 'dotted',
      strokeStyle: 'dashed',
    });

    expect(conn.style).toBe('dotted');
    expect(conn.strokeStyle).toBe('dashed');

    // Should still warn because strokeStyle is provided
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const elements = renderConnection(ctx, conn, nodeA, nodeB, theme);
    expect(elements.length).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalledWith('connection.strokeStyle is deprecated, use style instead');
  });

  it('no deprecation warning when only style is provided', () => {
    const ctx = makeCtx();
    const conn = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
      style: 'dotted',
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderConnection(ctx, conn, nodeA, nodeB, theme);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('no deprecation warning when neither style nor strokeStyle is explicitly set', () => {
    const ctx = makeCtx();
    const conn = connectionElementSchema.parse({
      type: 'connection',
      from: 'a',
      to: 'b',
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderConnection(ctx, conn, nodeA, nodeB, theme);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
