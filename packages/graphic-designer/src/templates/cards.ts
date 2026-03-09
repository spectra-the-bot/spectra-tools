import { parseDesignSpec, type DesignSpec } from '../spec.schema.js';

function inferColumns(cardCount: number): number {
  if (cardCount <= 1) {
    return 1;
  }
  if (cardCount <= 3) {
    return cardCount;
  }
  if (cardCount <= 4) {
    return 2;
  }
  if (cardCount <= 9) {
    return 3;
  }
  return 4;
}

export function buildCardsSpec(options: {
  cards: Array<{ title: string; body: string; badge?: string; metric?: string; tone?: string }>;
  title?: string;
  subtitle?: string;
  columns?: number;
  theme?: string;
  width?: number;
  height?: number;
}): DesignSpec {
  const cards = options.cards.map((card, index) => ({
    type: 'card',
    id: `card-${index + 1}`,
    title: card.title,
    body: card.body,
    ...(card.badge ? { badge: card.badge } : {}),
    ...(card.metric ? { metric: card.metric } : {}),
    ...(card.tone ? { tone: card.tone } : {}),
  }));

  return parseDesignSpec({
    version: 2,
    ...(options.width || options.height
      ? {
          canvas: {
            ...(options.width ? { width: options.width } : {}),
            ...(options.height ? { height: options.height } : {}),
          },
        }
      : {}),
    theme: options.theme ?? 'dark',
    ...(options.title
      ? {
          header: {
            title: options.title,
            ...(options.subtitle ? { subtitle: options.subtitle } : {}),
          },
        }
      : {}),
    layout: {
      mode: 'grid',
      columns: options.columns ?? inferColumns(cards.length),
    },
    elements: cards,
  });
}
