import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it, vi } from 'vitest';
import { renderDesign } from '../renderer.js';
import { parseDesignSpec } from '../spec.schema.js';

type TextEvent =
  | { type: 'measure'; text: string; width: number }
  | { type: 'fill'; text: string; x: number; y: number; color: string };

async function captureTextEvents(run: () => Promise<void>): Promise<TextEvent[]> {
  const probeContext = createCanvas(8, 8).getContext('2d');
  const contextProto = Object.getPrototypeOf(probeContext) as {
    measureText: (text: string) => { width: number };
    fillText: (text: string, x: number, y: number, maxWidth?: number) => void;
  };

  const originalMeasureText = contextProto.measureText;
  const originalFillText = contextProto.fillText;
  const events: TextEvent[] = [];

  const measureSpy = vi
    .spyOn(contextProto, 'measureText')
    .mockImplementation(function mockMeasureText(this: unknown, text: string) {
      const metrics = originalMeasureText.call(this as unknown as object, text);
      events.push({ type: 'measure', text, width: metrics.width });
      return metrics;
    });

  const fillSpy = vi.spyOn(contextProto, 'fillText').mockImplementation(function mockFillText(
    this: { fillStyle: string },
    text: string,
    x: number,
    y: number,
    maxWidth?: number,
  ) {
    events.push({ type: 'fill', text, x, y, color: String(this.fillStyle) });
    return originalFillText.call(this as unknown as object, text, x, y, maxWidth);
  });

  try {
    await run();
    return events;
  } finally {
    fillSpy.mockRestore();
    measureSpy.mockRestore();
  }
}

function firstMeasuredWidth(events: TextEvent[], text: string): number {
  const event = events.find((entry) => entry.type === 'measure' && entry.text === text);
  if (!event || event.type !== 'measure') {
    throw new Error(`Missing measureText event for segment: ${text}`);
  }
  return event.width;
}

describe('header mixed-color segmented title rendering', () => {
  it('renders two centered segments contiguously and measures them before drawing', async () => {
    const leftSegment = { text: 'spectra', color: '#3B82F6' };
    const rightSegment = { text: ' pipeline', color: '#FFFFFF' };

    const events = await captureTextEvents(async () => {
      const spec = parseDesignSpec({
        theme: 'dark',
        elements: [],
        header: {
          title: [leftSegment, rightSegment],
          align: 'center',
        },
      });

      await renderDesign(spec, { generatorVersion: 'test-header-segments-center' });
    });

    const fillEvents = events.filter((entry): entry is Extract<TextEvent, { type: 'fill' }> => {
      return entry.type === 'fill';
    });

    const segmentFills = fillEvents.filter(
      (entry) => entry.text === leftSegment.text || entry.text === rightSegment.text,
    );

    expect(segmentFills).toHaveLength(2);
    expect(segmentFills[0].color).toBe(leftSegment.color);
    expect(segmentFills[1].color).toBe(rightSegment.color);

    const leftWidth = firstMeasuredWidth(events, leftSegment.text);
    const rightWidth = firstMeasuredWidth(events, rightSegment.text);
    const totalWidth = leftWidth + rightWidth;
    const expectedCenterX = 600; // default 1200px canvas, centered safe frame anchor

    expect(Math.abs(segmentFills[0].x - (expectedCenterX - totalWidth / 2))).toBeLessThan(1);
    expect(Math.abs(segmentFills[1].x - (segmentFills[0].x + leftWidth))).toBeLessThan(1);

    const firstSegmentFillIndex = events.findIndex(
      (entry) => entry.type === 'fill' && entry.text === leftSegment.text,
    );
    const measuredSegmentIndices = events
      .map((entry, index) => ({ entry, index }))
      .filter(
        ({ entry }) =>
          entry.type === 'measure' &&
          (entry.text === leftSegment.text || entry.text === rightSegment.text),
      )
      .map(({ index }) => index);

    expect(firstSegmentFillIndex).toBeGreaterThan(Math.max(...measuredSegmentIndices));
  });

  it('renders three left-aligned segments contiguously from the left header anchor', async () => {
    const segments = [
      { text: 'Build', color: '#22C55E' },
      { text: ' once,', color: '#A78BFA' },
      { text: ' ship forever', color: '#FFFFFF' },
    ] as const;

    const events = await captureTextEvents(async () => {
      const spec = parseDesignSpec({
        theme: 'dark',
        elements: [],
        header: {
          title: [...segments],
          align: 'left',
        },
      });

      await renderDesign(spec, { generatorVersion: 'test-header-segments-left' });
    });

    const fillEvents = events.filter((entry): entry is Extract<TextEvent, { type: 'fill' }> => {
      return entry.type === 'fill';
    });

    const segmentFills = fillEvents.filter((entry) =>
      segments.some((segment) => segment.text === entry.text),
    );

    expect(segmentFills).toHaveLength(3);
    expect(Math.abs(segmentFills[0].x - 48)).toBeLessThan(1); // default safe-frame left
    expect(segmentFills.map((entry) => entry.color)).toEqual(
      segments.map((segment) => segment.color),
    );

    const widths = segments.map((segment) => firstMeasuredWidth(events, segment.text));
    expect(Math.abs(segmentFills[1].x - (segmentFills[0].x + widths[0]))).toBeLessThan(1);
    expect(Math.abs(segmentFills[2].x - (segmentFills[1].x + widths[1]))).toBeLessThan(1);
  });

  it('keeps single-string header titles working unchanged', async () => {
    const plainTitle = 'Single string title';

    const events = await captureTextEvents(async () => {
      const spec = parseDesignSpec({
        theme: 'dark',
        elements: [],
        header: {
          title: plainTitle,
          align: 'center',
        },
      });

      await renderDesign(spec, { generatorVersion: 'test-header-segments-string' });
    });

    const plainTitleFill = events.find(
      (entry) => entry.type === 'fill' && entry.text === plainTitle,
    );

    expect(plainTitleFill).toBeTruthy();
  });
});
