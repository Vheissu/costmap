import type { TreemapItem, TreemapNode } from '../../types';

type AreaNode = TreemapNode & { area: number };

const sumAreas = (nodes: AreaNode[]) => nodes.reduce((sum, node) => sum + node.area, 0);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type GridRect = {
  col: number;
  row: number;
  cols: number;
  rows: number;
};

const buildGrid = (rows: number, cols: number) => {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
};

const canPlace = (grid: boolean[][], rect: GridRect) => {
  if (rect.row + rect.rows > grid.length) return false;
  if (rect.col + rect.cols > grid[0].length) return false;
  for (let r = rect.row; r < rect.row + rect.rows; r += 1) {
    for (let c = rect.col; c < rect.col + rect.cols; c += 1) {
      if (grid[r][c]) return false;
    }
  }
  return true;
};

const place = (grid: boolean[][], rect: GridRect) => {
  for (let r = rect.row; r < rect.row + rect.rows; r += 1) {
    for (let c = rect.col; c < rect.col + rect.cols; c += 1) {
      grid[r][c] = true;
    }
  }
};

const findPlacement = (grid: boolean[][], cells: number) => {
  const rows = grid.length;
  const cols = grid[0].length;
  const maxCols = Math.min(cols, Math.max(1, Math.round(Math.sqrt(cells * (cols / rows)))));

  for (let tryCols = maxCols; tryCols >= 1; tryCols -= 1) {
    const tryRows = Math.ceil(cells / tryCols);
    if (tryRows > rows) continue;
    for (let r = 0; r <= rows - tryRows; r += 1) {
      for (let c = 0; c <= cols - tryCols; c += 1) {
        const rect = { row: r, col: c, rows: tryRows, cols: tryCols };
        if (canPlace(grid, rect)) {
          return rect;
        }
      }
    }
  }

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (!grid[r][c]) {
        return { row: r, col: c, rows: 1, cols: 1 };
      }
    }
  }
  return null;
};

export const generateTreemap = (items: TreemapItem[], width: number, height: number): TreemapNode[] => {
  if (width <= 0 || height <= 0) return [];
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return [];

  const nodes: AreaNode[] = items
    .filter((item) => item.value > 0)
    .map((item) => ({
      ...item,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      area: (item.value / total) * width * height
    }));

  nodes.sort((a, b) => b.area - a.area);

  const output: TreemapNode[] = [];
  const targetCell = clamp(Math.round(width / 5.5), 150, 240);
  const columns = Math.max(4, Math.round(width / targetCell));
  const cellWidth = width / columns;
  const baseRows = Math.max(4, Math.round(height / cellWidth));
  const rows = Math.max(baseRows, Math.ceil(nodes.length / columns));
  const cellHeight = height / rows;
  const totalCells = rows * columns;

  const rawCells = nodes.map((node) => (node.area / (width * height)) * totalCells);
  const floorCells = rawCells.map((value) => Math.max(1, Math.floor(value)));
  let allocated = floorCells.reduce((sum, value) => sum + value, 0);
  const remainders = rawCells.map((value, index) => ({
    index,
    remainder: value - Math.floor(value)
  }));

  if (allocated > totalCells) {
    const over = allocated - totalCells;
    const sorted = floorCells
      .map((value, index) => ({ index, value }))
      .sort((a, b) => a.value - b.value);
    for (let i = 0; i < over; i += 1) {
      const item = sorted[i % sorted.length];
      if (floorCells[item.index] > 1) {
        floorCells[item.index] -= 1;
      }
    }
    allocated = floorCells.reduce((sum, value) => sum + value, 0);
  }

  if (allocated < totalCells) {
    const missing = totalCells - allocated;
    remainders.sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < missing; i += 1) {
      const target = remainders[i % remainders.length];
      floorCells[target.index] += 1;
    }
  }

  const grid = buildGrid(rows, columns);

  nodes.forEach((node, index) => {
    const cells = floorCells[index];
    const rect = findPlacement(grid, cells);
    if (!rect) return;
    place(grid, rect);
    node.x = rect.col * cellWidth;
    node.y = rect.row * cellHeight;
    node.width = rect.cols * cellWidth;
    node.height = rect.rows * cellHeight;
    output.push(node);
  });

  return output;
};
