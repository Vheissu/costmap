import { describe, expect, it } from 'vitest';
import { generateTreemap } from '../treemap';
import type { TreemapItem, TreemapNode } from '../../../types';

const EPSILON = 0.0001;

const overlaps = (a: TreemapNode, b: TreemapNode) => {
  return !(
    a.x + a.width <= b.x + EPSILON ||
    b.x + b.width <= a.x + EPSILON ||
    a.y + a.height <= b.y + EPSILON ||
    b.y + b.height <= a.y + EPSILON
  );
};

const item = (id: string, value: number): TreemapItem => ({
  id,
  label: id.toUpperCase(),
  value,
  color: '#111',
  categoryId: 'c1',
  kind: 'expense'
});

const expectValidLayout = (items: TreemapItem[], width: number, height: number) => {
  const nodes = generateTreemap(items, width, height);
  const positive = items.filter((entry) => entry.value > 0);
  const total = positive.reduce((sum, entry) => sum + entry.value, 0);

  expect(nodes).toHaveLength(positive.length);

  nodes.forEach((node) => {
    expect(node.x).toBeGreaterThanOrEqual(-EPSILON);
    expect(node.y).toBeGreaterThanOrEqual(-EPSILON);
    expect(node.width).toBeGreaterThan(0);
    expect(node.height).toBeGreaterThan(0);
    expect(node.x + node.width).toBeLessThanOrEqual(width + EPSILON);
    expect(node.y + node.height).toBeLessThanOrEqual(height + EPSILON);
    const expectedArea = (node.value / total) * width * height;
    expect(node.width * node.height).toBeCloseTo(expectedArea, 3);
  });

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      expect(overlaps(nodes[i], nodes[j])).toBe(false);
    }
  }

  const covered = nodes.reduce((sum, node) => sum + node.width * node.height, 0);
  expect(covered).toBeCloseTo(width * height, 3);
  return nodes;
};

describe('treemap layout', () => {
  it('lays out nodes within bounds without overlap', () => {
    expectValidLayout([item('a', 500), item('b', 300), item('c', 200), item('d', 100)], 800, 400);
  });

  it('places every item, even with many tiny values', () => {
    const items = [item('big', 20000), ...Array.from({ length: 60 }, (_, i) => item(`s${i}`, 1 + i))];
    expectValidLayout(items, 640, 420);
  });

  it('handles tall containers', () => {
    expectValidLayout([item('a', 3), item('b', 2), item('c', 1)], 320, 900);
  });

  it('drops zero and invalid values', () => {
    const nodes = generateTreemap([item('a', 10), item('b', 0), item('c', Number.NaN)], 100, 100);
    expect(nodes.map((node) => node.id)).toEqual(['a']);
    expect(nodes[0]).toMatchObject({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('returns nothing for an empty or zero-size area', () => {
    expect(generateTreemap([item('a', 1)], 0, 100)).toEqual([]);
    expect(generateTreemap([], 100, 100)).toEqual([]);
  });

  it('keeps tiles reasonably square', () => {
    const items = Array.from({ length: 12 }, (_, i) => item(`i${i}`, 100 - i * 5));
    const nodes = generateTreemap(items, 800, 500);
    const worst = Math.max(...nodes.map((n) => Math.max(n.width / n.height, n.height / n.width)));
    expect(worst).toBeLessThan(4);
  });
});
