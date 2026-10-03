import type { TreemapItem, TreemapNode } from '../../types';

type Sized = { item: TreemapItem; area: number };

type Rect = { x: number; y: number; width: number; height: number };

/** Aspect ratio of the worst tile if `row` is laid along a side of length `side`. */
const worstRatio = (row: Sized[], side: number) => {
  let sum = 0;
  let max = -Infinity;
  let min = Infinity;
  for (const entry of row) {
    sum += entry.area;
    if (entry.area > max) max = entry.area;
    if (entry.area < min) min = entry.area;
  }
  const sideSq = side * side;
  const sumSq = sum * sum;
  return Math.max((sideSq * max) / sumSq, sumSq / (sideSq * min));
};

const layoutRow = (row: Sized[], rect: Rect, output: TreemapNode[], isLast: boolean) => {
  const sum = row.reduce((total, entry) => total + entry.area, 0);

  if (rect.width >= rect.height) {
    // Lay the row as a column down the left edge.
    const columnWidth = isLast ? rect.width : sum / rect.height;
    let offset = rect.y;
    row.forEach((entry, index) => {
      const height =
        index === row.length - 1 ? rect.y + rect.height - offset : entry.area / columnWidth;
      output.push({ ...entry.item, x: rect.x, y: offset, width: columnWidth, height });
      offset += height;
    });
    rect.x += columnWidth;
    rect.width -= columnWidth;
  } else {
    // Lay the row along the top edge.
    const rowHeight = isLast ? rect.height : sum / rect.width;
    let offset = rect.x;
    row.forEach((entry, index) => {
      const width =
        index === row.length - 1 ? rect.x + rect.width - offset : entry.area / rowHeight;
      output.push({ ...entry.item, x: offset, y: rect.y, width, height: rowHeight });
      offset += width;
    });
    rect.y += rowHeight;
    rect.height -= rowHeight;
  }
};

/**
 * Squarified treemap (Bruls, Huizing & van Wijk). Every positive item is placed,
 * tile areas are exactly proportional to value, and tiles stay close to square.
 */
export const generateTreemap = (items: TreemapItem[], width: number, height: number): TreemapNode[] => {
  if (width <= 0 || height <= 0) return [];
  const positive = items.filter((item) => Number.isFinite(item.value) && item.value > 0);
  const total = positive.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return [];

  const scale = (width * height) / total;
  const queue: Sized[] = positive
    .map((item) => ({ item, area: item.value * scale }))
    .sort((a, b) => b.area - a.area);

  const output: TreemapNode[] = [];
  const rect: Rect = { x: 0, y: 0, width, height };
  let row: Sized[] = [];

  for (let index = 0; index < queue.length; index += 1) {
    const entry = queue[index];
    const side = Math.min(rect.width, rect.height);
    if (row.length === 0 || worstRatio([...row, entry], side) <= worstRatio(row, side)) {
      row.push(entry);
    } else {
      layoutRow(row, rect, output, false);
      row = [entry];
    }
  }

  if (row.length) layoutRow(row, rect, output, true);
  return output;
};
