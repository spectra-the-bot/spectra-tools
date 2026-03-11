import type { Element } from '../spec.schema.js';

export function estimateElementHeight(element: Element): number {
  switch (element.type) {
    case 'card':
      return 220;
    case 'flow-node':
      return element.shape === 'circle' || element.shape === 'diamond' ? 160 : 130;
    case 'code-block':
      return 260;
    case 'terminal':
      return 245;
    case 'text':
      return element.style === 'heading' ? 140 : element.style === 'subheading' ? 110 : 90;
    case 'shape':
      return 130;
    case 'image':
      return 220;
    case 'ring':
      return element.radius * 2 + element.glowRadius * 2 + 16;
    case 'connection':
      return 0;
  }
}

export function estimateElementWidth(element: Element): number {
  switch (element.type) {
    case 'card':
      return 320;
    case 'flow-node':
      return element.shape === 'circle' || element.shape === 'diamond' ? 160 : 220;
    case 'code-block':
      return 420;
    case 'terminal':
      return 420;
    case 'text':
      return 360;
    case 'shape':
      return 280;
    case 'image':
      return 320;
    case 'ring':
      return element.radius * 2 + element.glowRadius * 2 + 16;
    case 'connection':
      return 0;
  }
}
