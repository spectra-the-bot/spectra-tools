import { type DesignSpec, parseDesignSpec } from '../spec.schema.js';

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

/**
 * Build a validated {@link DesignSpec} for a card grid layout.
 *
 * Converts an array of card data into `card` elements arranged in a grid. The
 * number of columns is inferred from the card count when not specified
 * explicitly.
 *
 * @param options - Card grid configuration.
 * @param options.cards - Array of card data objects. Each must include `title`
 *   and `body`; `badge`, `metric`, and `tone` are optional.
 * @param options.title - Optional header title displayed above the card grid.
 * @param options.subtitle - Optional header subtitle (only rendered when
 *   `title` is also set).
 * @param options.columns - Number of grid columns. When omitted, a heuristic
 *   chooses based on card count (1–4 columns).
 * @param options.theme - Built-in theme name. Defaults to `"dark"`.
 * @param options.width - Canvas width override in pixels.
 * @param options.height - Canvas height override in pixels.
 * @returns A fully validated and parsed {@link DesignSpec}.
 */
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
