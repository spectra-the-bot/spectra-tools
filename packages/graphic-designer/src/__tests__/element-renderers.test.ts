import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { renderCard } from '../renderers/card.js';
import { renderCodeBlock } from '../renderers/code.js';
import { renderConnection } from '../renderers/connection.js';
import { renderFlowNode } from '../renderers/flow-node.js';
import { renderImageElement } from '../renderers/image.js';
import { renderShapeElement } from '../renderers/shape.js';
import { renderTerminal } from '../renderers/terminal.js';
import { renderTextElement } from '../renderers/text.js';
import { resolveTheme } from '../themes/index.js';

describe('element renderers', () => {
  it('renders each element type and returns metadata entries', async () => {
    const theme = resolveTheme('dark');
    const canvas = createCanvas(1200, 675);
    const ctx = canvas.getContext('2d');

    const cardEls = renderCard(
      ctx,
      { type: 'card', id: 'c1', title: 'Card title', body: 'Card body', tone: 'neutral' },
      { x: 20, y: 20, width: 240, height: 180 },
      theme,
    );

    const nodeA = { x: 320, y: 60, width: 180, height: 100 };
    const nodeB = { x: 580, y: 60, width: 180, height: 100 };

    const flowEls = renderFlowNode(
      ctx,
      { type: 'flow-node', id: 'n1', shape: 'rounded-box', label: 'Start' },
      nodeA,
      theme,
    );

    renderFlowNode(
      ctx,
      { type: 'flow-node', id: 'n2', shape: 'diamond', label: 'Check', sublabel: 'true/false' },
      nodeB,
      theme,
    );

    const connEls = renderConnection(
      ctx,
      {
        type: 'connection',
        from: 'n1',
        to: 'n2',
        style: 'dotted',
        arrow: 'end',
        label: 'next',
        labelPosition: 'middle',
        width: 3,
        arrowSize: 14,
        opacity: 0.85,
      },
      nodeA,
      nodeB,
      theme,
    );

    const terminalEls = renderTerminal(
      ctx,
      {
        type: 'terminal',
        id: 't1',
        content: 'echo hi',
        prompt: '$',
        title: 'Terminal',
        showPrompt: true,
        style: { windowControls: 'macos', scale: 1 },
      },
      { x: 20, y: 240, width: 360, height: 220 },
      theme,
    );

    const codeEls = await renderCodeBlock(
      ctx,
      {
        type: 'code-block',
        id: 'code1',
        code: 'const x = 1;',
        language: 'ts',
        showLineNumbers: true,
        startLine: 1,
      },
      { x: 420, y: 240, width: 360, height: 220 },
      theme,
    );

    const textEls = renderTextElement(
      ctx,
      {
        type: 'text',
        id: 'txt1',
        content: 'Hello world',
        style: 'body',
        align: 'left',
      },
      { x: 820, y: 240, width: 280, height: 120 },
      theme,
    );

    const shapeEls = renderShapeElement(
      ctx,
      {
        type: 'shape',
        id: 's1',
        shape: 'rounded-rectangle',
        strokeWidth: 2,
      },
      { x: 820, y: 390, width: 280, height: 80 },
      theme,
    );

    const imageEls = await renderImageElement(
      ctx,
      {
        type: 'image',
        id: 'img1',
        src: 'file:///definitely-missing.png',
        fit: 'contain',
        borderRadius: 8,
      },
      { x: 20, y: 500, width: 280, height: 120 },
      theme,
    );

    expect(cardEls.length).toBeGreaterThan(0);
    expect(flowEls.length).toBeGreaterThan(0);
    expect(connEls.length).toBeGreaterThan(0);
    expect(terminalEls.length).toBeGreaterThan(0);
    expect(codeEls.length).toBeGreaterThan(0);
    expect(textEls.length).toBeGreaterThan(0);
    expect(shapeEls.length).toBeGreaterThan(0);
    expect(imageEls.length).toBeGreaterThan(0);
  });
});
