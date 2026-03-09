export type SvgPathOperation =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'C'; cp1x: number; cp1y: number; cp2x: number; cp2y: number; x: number; y: number }
  | { type: 'Q'; cpx: number; cpy: number; x: number; y: number }
  | { type: 'Z' };

const TOKEN_RE = /[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/gu;

function isCommandToken(token: string): boolean {
  return /^[A-Za-z]$/u.test(token);
}

function isNumberToken(token: string): boolean {
  return !isCommandToken(token);
}

function readNumber(tokens: string[], cursor: { index: number }): number {
  const token = tokens[cursor.index];
  if (token === undefined || isCommandToken(token)) {
    throw new Error(`Expected number at token index ${cursor.index}`);
  }

  cursor.index += 1;
  const value = Number(token);
  if (Number.isNaN(value)) {
    throw new Error(`Invalid number token: ${token}`);
  }

  return value;
}

export function parseSvgPath(pathData: string): SvgPathOperation[] {
  const tokens = pathData.match(TOKEN_RE) ?? [];
  if (tokens.length === 0) {
    return [];
  }

  const operations: SvgPathOperation[] = [];
  const cursor = { index: 0 };

  let command = '';
  let currentX = 0;
  let currentY = 0;
  let subpathStartX = 0;
  let subpathStartY = 0;

  while (cursor.index < tokens.length) {
    const token = tokens[cursor.index];
    if (token === undefined) {
      break;
    }

    if (isCommandToken(token)) {
      command = token;
      cursor.index += 1;
    } else if (!command) {
      throw new Error(`Path data must start with a command. Found: ${token}`);
    }

    switch (command) {
      case 'M':
      case 'm': {
        let pairIndex = 0;
        while (cursor.index < tokens.length && isNumberToken(tokens[cursor.index] ?? '')) {
          const x = readNumber(tokens, cursor);
          const y = readNumber(tokens, cursor);
          const nextX = command === 'm' ? currentX + x : x;
          const nextY = command === 'm' ? currentY + y : y;

          if (pairIndex === 0) {
            operations.push({ type: 'M', x: nextX, y: nextY });
            subpathStartX = nextX;
            subpathStartY = nextY;
          } else {
            operations.push({ type: 'L', x: nextX, y: nextY });
          }

          currentX = nextX;
          currentY = nextY;
          pairIndex += 1;
        }
        break;
      }
      case 'L':
      case 'l': {
        while (cursor.index < tokens.length && isNumberToken(tokens[cursor.index] ?? '')) {
          const x = readNumber(tokens, cursor);
          const y = readNumber(tokens, cursor);
          const nextX = command === 'l' ? currentX + x : x;
          const nextY = command === 'l' ? currentY + y : y;
          operations.push({ type: 'L', x: nextX, y: nextY });
          currentX = nextX;
          currentY = nextY;
        }
        break;
      }
      case 'H':
      case 'h': {
        while (cursor.index < tokens.length && isNumberToken(tokens[cursor.index] ?? '')) {
          const x = readNumber(tokens, cursor);
          const nextX = command === 'h' ? currentX + x : x;
          operations.push({ type: 'L', x: nextX, y: currentY });
          currentX = nextX;
        }
        break;
      }
      case 'V':
      case 'v': {
        while (cursor.index < tokens.length && isNumberToken(tokens[cursor.index] ?? '')) {
          const y = readNumber(tokens, cursor);
          const nextY = command === 'v' ? currentY + y : y;
          operations.push({ type: 'L', x: currentX, y: nextY });
          currentY = nextY;
        }
        break;
      }
      case 'C':
      case 'c': {
        while (cursor.index < tokens.length && isNumberToken(tokens[cursor.index] ?? '')) {
          const cp1x = readNumber(tokens, cursor);
          const cp1y = readNumber(tokens, cursor);
          const cp2x = readNumber(tokens, cursor);
          const cp2y = readNumber(tokens, cursor);
          const x = readNumber(tokens, cursor);
          const y = readNumber(tokens, cursor);

          const next: SvgPathOperation =
            command === 'c'
              ? {
                  type: 'C',
                  cp1x: currentX + cp1x,
                  cp1y: currentY + cp1y,
                  cp2x: currentX + cp2x,
                  cp2y: currentY + cp2y,
                  x: currentX + x,
                  y: currentY + y,
                }
              : { type: 'C', cp1x, cp1y, cp2x, cp2y, x, y };

          operations.push(next);
          currentX = next.x;
          currentY = next.y;
        }
        break;
      }
      case 'Q':
      case 'q': {
        while (cursor.index < tokens.length && isNumberToken(tokens[cursor.index] ?? '')) {
          const cpx = readNumber(tokens, cursor);
          const cpy = readNumber(tokens, cursor);
          const x = readNumber(tokens, cursor);
          const y = readNumber(tokens, cursor);

          const next: SvgPathOperation =
            command === 'q'
              ? {
                  type: 'Q',
                  cpx: currentX + cpx,
                  cpy: currentY + cpy,
                  x: currentX + x,
                  y: currentY + y,
                }
              : { type: 'Q', cpx, cpy, x, y };

          operations.push(next);
          currentX = next.x;
          currentY = next.y;
        }
        break;
      }
      case 'Z':
      case 'z': {
        operations.push({ type: 'Z' });
        currentX = subpathStartX;
        currentY = subpathStartY;
        break;
      }
      default:
        throw new Error(`Unsupported SVG path command: ${command}`);
    }
  }

  return operations;
}
