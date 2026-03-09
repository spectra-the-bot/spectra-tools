import { describe, expect, it } from 'vitest';
import { parseDesignSpec } from '../spec.schema.js';
import { buildGtmPipelineSpec } from '../templates/gtm-pipeline.js';
import { buildGtmStatsSpec } from '../templates/gtm-stats.js';
import { buildScoutDispatchSpec } from '../templates/scout-dispatch.js';

describe('design spec schema', () => {
  it('parses a strict design spec', () => {
    const spec = parseDesignSpec({
      version: 1,
      template: 'custom',
      canvas: { width: 1200, height: 675, padding: 72 },
      theme: {
        background: '#0B1020',
        surface: '#111936',
        surfaceMuted: '#1A2547',
        primary: '#7AA2FF',
        accent: '#65E4A3',
        text: '#E8EEFF',
        textMuted: '#AAB9E8',
        footerText: '#8B9CCB',
        fontFamily: 'Inter',
        monoFontFamily: 'JetBrains Mono',
      },
      header: {
        eyebrow: 'TEST',
        title: 'Title',
        subtitle: 'Subtitle',
      },
      cards: [
        {
          id: 'a',
          title: 'Card',
          body: 'Body',
          badge: 'badge',
          tone: 'accent',
        },
      ],
      footer: {
        text: 'footer',
      },
      layout: {
        columns: 1,
        cardGap: 18,
        sectionGap: 24,
        cornerRadius: 14,
      },
      constraints: {
        minContrastRatio: 4.5,
        minFooterSpacingPx: 16,
        checkOverlaps: true,
      },
      generation: {
        templateVersion: '1.0.0',
      },
    });

    expect(spec.template).toBe('custom');
    expect(spec.cards).toHaveLength(1);
  });

  it('rejects invalid colors', () => {
    expect(() =>
      parseDesignSpec({
        version: 1,
        template: 'custom',
        canvas: { width: 1200, height: 675, padding: 72 },
        theme: {
          background: 'red',
          surface: '#111936',
          surfaceMuted: '#1A2547',
          primary: '#7AA2FF',
          accent: '#65E4A3',
          text: '#E8EEFF',
          textMuted: '#AAB9E8',
          footerText: '#8B9CCB',
          fontFamily: 'Inter',
          monoFontFamily: 'JetBrains Mono',
        },
        header: { eyebrow: 'A', title: 'B' },
        cards: [{ id: 'x', title: 'y', body: 'z', tone: 'neutral' }],
        footer: { text: 'f' },
        layout: {
          columns: 1,
          cardGap: 18,
          sectionGap: 24,
          cornerRadius: 14,
        },
        constraints: {
          minContrastRatio: 4.5,
          minFooterSpacingPx: 16,
          checkOverlaps: true,
        },
        generation: {
          templateVersion: '1.0.0',
        },
      }),
    ).toThrow();
  });

  it('template builders emit schema-valid specs', () => {
    const pipeline = buildGtmPipelineSpec({
      title: 'Pipeline',
      stages: [
        { name: 'Discover', description: 'Find targets' },
        { name: 'Validate', description: 'Verify intent' },
        { name: 'Launch', description: 'Ship assets' },
      ],
    });

    const stats = buildGtmStatsSpec({
      title: 'Stats',
      stats: [
        { label: 'Coverage', value: '91%', insight: 'Up week-over-week' },
        { label: 'CTR', value: '4.2%', insight: 'Stable conversion path' },
        { label: 'CPA', value: '$12', insight: 'Efficiency improved' },
      ],
    });

    const dispatch = buildScoutDispatchSpec({
      title: 'Dispatch',
      dispatches: [
        { lane: 'Creative', status: 'in-progress', nextAction: 'Finalize mockups' },
        { lane: 'Distribution', status: 'queued', nextAction: 'Book launch slots' },
        { lane: 'Analytics', status: 'complete', nextAction: 'Publish recap' },
      ],
    });

    expect(pipeline.template).toBe('gtm-pipeline');
    expect(stats.template).toBe('gtm-stats');
    expect(dispatch.template).toBe('scout-dispatch');
  });
});
