import sharp from 'sharp';

const DEFAULT_GRID = 3;
const DEFAULT_THRESHOLD = 0.8;
const DEFAULT_CLOSE_MARGIN = 0.1;

export type CompareVerdict = 'match' | 'close' | 'mismatch';

export type CompareImagesOptions = {
  grid?: number;
  threshold?: number;
  closeMargin?: number;
};

export type CompareRegionScore = {
  label: string;
  row: number;
  column: number;
  similarity: number;
};

export type CompareImagesReport = {
  targetPath: string;
  renderedPath: string;
  targetDimensions: {
    width: number;
    height: number;
  };
  renderedDimensions: {
    width: number;
    height: number;
  };
  normalizedDimensions: {
    width: number;
    height: number;
  };
  dimensionMismatch: boolean;
  grid: number;
  threshold: number;
  closeThreshold: number;
  similarity: number;
  verdict: CompareVerdict;
  regions: CompareRegionScore[];
};

type RawImage = {
  data: Buffer;
  width: number;
  height: number;
};

function clampUnit(value: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function toRegionLabel(row: number, column: number): string {
  const letter = String.fromCharCode(65 + row);
  return `${letter}${column + 1}`;
}

function validateGrid(grid: number): number {
  if (!Number.isInteger(grid) || grid <= 0) {
    throw new Error(`Invalid grid value "${grid}". Expected a positive integer.`);
  }

  if (grid > 26) {
    throw new Error(`Invalid grid value "${grid}". Maximum supported grid is 26.`);
  }

  return grid;
}

function validateThreshold(threshold: number): number {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new Error(`Invalid threshold value "${threshold}". Expected a number between 0 and 1.`);
  }

  return threshold;
}

async function readDimensions(path: string): Promise<{ width: number; height: number }> {
  const metadata = await sharp(path).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to read image dimensions for "${path}".`);
  }

  return {
    width: metadata.width,
    height: metadata.height,
  };
}

async function normalizeToRaw(path: string, width: number, height: number): Promise<RawImage> {
  const normalized = await sharp(path)
    .rotate()
    .resize(width, height, {
      fit: 'contain',
      position: 'centre',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data: normalized.data,
    width: normalized.info.width,
    height: normalized.info.height,
  };
}

function scorePixelDifference(a: RawImage, b: RawImage, offset: number): number {
  const redDiff = Math.abs(a.data[offset] - b.data[offset]);
  const greenDiff = Math.abs(a.data[offset + 1] - b.data[offset + 1]);
  const blueDiff = Math.abs(a.data[offset + 2] - b.data[offset + 2]);
  const alphaDiff = Math.abs(a.data[offset + 3] - b.data[offset + 3]);

  const rgbDelta = (redDiff + greenDiff + blueDiff) / (3 * 255);
  const alphaDelta = alphaDiff / 255;

  return rgbDelta * 0.75 + alphaDelta * 0.25;
}

export async function compareImages(
  target: string,
  rendered: string,
  options: CompareImagesOptions = {},
): Promise<CompareImagesReport> {
  const grid = validateGrid(options.grid ?? DEFAULT_GRID);
  const threshold = validateThreshold(options.threshold ?? DEFAULT_THRESHOLD);
  const closeThreshold = clampUnit(threshold - (options.closeMargin ?? DEFAULT_CLOSE_MARGIN));

  const targetDimensions = await readDimensions(target);
  const renderedDimensions = await readDimensions(rendered);

  const normalizedWidth = Math.max(targetDimensions.width, renderedDimensions.width);
  const normalizedHeight = Math.max(targetDimensions.height, renderedDimensions.height);

  const [targetImage, renderedImage] = await Promise.all([
    normalizeToRaw(target, normalizedWidth, normalizedHeight),
    normalizeToRaw(rendered, normalizedWidth, normalizedHeight),
  ]);

  const regionDiffSums = new Array<number>(grid * grid).fill(0);
  const regionCounts = new Array<number>(grid * grid).fill(0);

  let totalDiff = 0;

  for (let y = 0; y < normalizedHeight; y += 1) {
    const row = Math.min(Math.floor((y * grid) / normalizedHeight), grid - 1);

    for (let x = 0; x < normalizedWidth; x += 1) {
      const column = Math.min(Math.floor((x * grid) / normalizedWidth), grid - 1);
      const regionIndex = row * grid + column;
      const offset = (y * normalizedWidth + x) * 4;

      const diff = scorePixelDifference(targetImage, renderedImage, offset);
      totalDiff += diff;
      regionDiffSums[regionIndex] += diff;
      regionCounts[regionIndex] += 1;
    }
  }

  const pixelCount = normalizedWidth * normalizedHeight;
  const similarity = clampUnit(1 - totalDiff / pixelCount);

  const regions: CompareRegionScore[] = [];
  for (let row = 0; row < grid; row += 1) {
    for (let column = 0; column < grid; column += 1) {
      const regionIndex = row * grid + column;
      const regionCount = regionCounts[regionIndex];
      const regionSimilarity =
        regionCount > 0 ? clampUnit(1 - regionDiffSums[regionIndex] / regionCount) : 1;

      regions.push({
        label: toRegionLabel(row, column),
        row,
        column,
        similarity: regionSimilarity,
      });
    }
  }

  const verdict: CompareVerdict =
    similarity >= threshold ? 'match' : similarity >= closeThreshold ? 'close' : 'mismatch';

  return {
    targetPath: target,
    renderedPath: rendered,
    targetDimensions,
    renderedDimensions,
    normalizedDimensions: {
      width: normalizedWidth,
      height: normalizedHeight,
    },
    dimensionMismatch:
      targetDimensions.width !== renderedDimensions.width ||
      targetDimensions.height !== renderedDimensions.height,
    grid,
    threshold,
    closeThreshold,
    similarity,
    verdict,
    regions,
  };
}
