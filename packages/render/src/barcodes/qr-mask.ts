/**
 * Which of a QR code's eight masks to use. Any of them scans, but each
 * scatters the dark modules differently, so the symbol only matches the
 * printer's when the mask does. Scored as reference renders score them:
 * the usual four penalty rules, where a finder-like pattern counts once
 * when either side has four light modules, and the edge counts as light.
 */

type QrSymbol = { modules: ArrayLike<number>; columns: number };

/** Runs of five or more modules of one color, in rows and columns */
const runs = (dark: (x: number, y: number) => boolean, size: number) => {
  let penalty = 0;
  for (const across of [true, false]) {
    for (let line = 0; line < size; line++) {
      let run = 0;
      let last: boolean | undefined;
      for (let i = 0; i < size; i++) {
        const value = across ? dark(i, line) : dark(line, i);
        if (value === last) {
          run++;
        } else {
          if (run >= 5) penalty += run - 2;
          run = 1;
          last = value;
        }
      }
      if (run >= 5) penalty += run - 2;
    }
  }
  return penalty;
};

/** 2 × 2 blocks of one color */
const blocks = (dark: (x: number, y: number) => boolean, size: number) => {
  let penalty = 0;
  for (let y = 0; y + 1 < size; y++) {
    for (let x = 0; x + 1 < size; x++) {
      const value = dark(x, y);
      if (
        dark(x + 1, y) === value &&
        dark(x, y + 1) === value &&
        dark(x + 1, y + 1) === value
      ) {
        penalty += 3;
      }
    }
  }
  return penalty;
};

const FINDER = [true, false, true, true, true, false, true];

/** Dark, light, dark × 3, light, dark, with four light modules on a side */
const finders = (dark: (x: number, y: number) => boolean, size: number) => {
  let penalty = 0;
  for (const across of [true, false]) {
    for (let line = 0; line < size; line++) {
      const at = (i: number) =>
        i >= 0 && i < size && (across ? dark(i, line) : dark(line, i));
      const light = (from: number) =>
        [0, 1, 2, 3].every((offset) => !at(from + offset));
      for (let i = 0; i + 7 <= size; i++) {
        if (
          FINDER.every((value, offset) => at(i + offset) === value) &&
          (light(i - 4) || light(i + 7))
        ) {
          penalty += 40;
        }
      }
    }
  }
  return penalty;
};

/** How far dark modules are from half, in steps of 5% */
const balance = (dark: (x: number, y: number) => boolean, size: number) => {
  let count = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) if (dark(x, y)) count++;
  }
  const total = size * size;
  return Math.floor((Math.abs(count * 2 - total) * 10) / total) * 10;
};

/** How much a masked symbol is penalized; lower is better */
const qrPenalty = ({ modules, columns }: QrSymbol) => {
  const dark = (x: number, y: number) => modules[y * columns + x] === 1;
  return (
    runs(dark, columns) +
    blocks(dark, columns) +
    finders(dark, columns) +
    balance(dark, columns)
  );
};

/** The symbol with the lowest penalty, the first of any that tie */
const bestMasked = <T extends QrSymbol>(symbols: T[]): T => {
  const penalties = symbols.map(qrPenalty);
  return symbols[penalties.indexOf(Math.min(...penalties))];
};

/** Whether a mask flips the module at a row and column */
const MASKS: ((row: number, column: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** Rows and columns of a version's alignment patterns */
const alignment = (version: number) => {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
  const positions = [6];
  for (let at = version * 4 + 10; positions.length < count; at -= step) {
    positions.splice(1, 0, at);
  }
  return positions;
};

/** Modules that aren't data: finders, timing, alignment, format, version */
const functionModules = (size: number) => {
  const version = (size - 17) / 4;
  const marked = new Array<boolean>(size * size).fill(false);
  const mark = (row: number, column: number, rows: number, columns: number) => {
    for (let r = row; r < row + rows; r++) {
      for (let c = column; c < column + columns; c++) {
        marked[r * size + c] = true;
      }
    }
  };
  // Finders with their separators and format bits
  mark(0, 0, 9, 9);
  mark(0, size - 8, 9, 8);
  mark(size - 8, 0, 8, 9);
  mark(6, 0, 1, size);
  mark(0, 6, size, 1);
  const centers = alignment(version);
  for (const row of centers) {
    for (const column of centers) {
      const corner =
        (row === 6 && column === 6) ||
        (row === 6 && column === size - 7) ||
        (row === size - 7 && column === 6);
      if (!corner) mark(row - 2, column - 2, 5, 5);
    }
  }
  if (version >= 7) {
    mark(0, size - 11, 6, 3);
    mark(size - 11, 0, 3, 6);
  }
  return marked;
};

/** Where each of the 15 format bits goes, from the lowest, in both copies */
const formatCells = (size: number): [number, number][][] =>
  Array.from({ length: 15 }, (_, i) => [
    i < 6 ? [i, 8] : i < 8 ? [i + 1, 8] : i === 8 ? [8, 7] : [8, 14 - i],
    i < 8 ? [8, size - 1 - i] : [size - 15 + i, 8],
  ]);

/**
 * The same symbol with another mask, 0 to 7: its data modules flipped by
 * both masks, and the format bits rewritten for the new one
 */
const remask = <T extends QrSymbol>(symbol: T, mask: number): T => {
  const size = symbol.columns;
  const modules = Array.from(symbol.modules);
  const cells = formatCells(size);
  const read = cells.reduce(
    (bits, [[row, column]], i) => bits | (modules[row * size + column] << i),
    0
  );
  const format = read ^ 0b101010000010010;
  const level = format >> 13;
  const current = (format >> 10) & 0b111;

  const isFunction = functionModules(size);
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const i = row * size + column;
      if (
        !isFunction[i] &&
        MASKS[current](row, column) !== MASKS[mask](row, column)
      ) {
        modules[i] ^= 1;
      }
    }
  }

  // The level and mask, then a BCH error correction code
  const data = (level << 3) | mask;
  let remainder = data;
  for (let i = 0; i < 10; i++) {
    remainder = (remainder << 1) ^ ((remainder >> 9) * 0b10100110111);
  }
  const bits = ((data << 10) | remainder) ^ 0b101010000010010;
  cells.forEach((copies, i) => {
    for (const [row, column] of copies) {
      modules[row * size + column] = (bits >> i) & 1;
    }
  });
  return { ...symbol, modules };
};

/** The symbol with each of the eight masks, from mask 0 */
const allMasks = <T extends QrSymbol>(symbol: T): T[] =>
  MASKS.map((_, mask) => remask(symbol, mask));

export { qrPenalty, bestMasked, remask, allMasks };
