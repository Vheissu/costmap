import { describe, expect, it } from 'vitest';
import { generateTreemap } from '../treemap';
import type { TreemapItem, TreemapNode } from '../../../types';

const overlaps = (a: TreemapNode, b: TreemapNode) => {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
};

describe('treemap layout', () => {
  it('lays out nodes within bounds without overlap', () => {
    const items: TreemapItem[] = [
      { id: 'a', label: 'A', value: 500, color: '#111', categoryId: 'c1', kind: 'expense' },
      { id: 'b', label: 'B', value: 300, color: '#222', categoryId: 'c1', kind: 'expense' },
      { id: 'c', label: 'C', value: 200, color: '#333', categoryId: 'c2', kind: 'expense' },
      { id: 'd', label: 'D', value: 100, color: '#444', categoryId: 'c2', kind: 'expense' }
    ];

    const width = 800;
    const height = 400;
    const nodes = generateTreemap(items, width, height);

    expect(nodes).toHaveLength(items.length);

    nodes.forEach((node) => {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
      expect(node.x + node.width).toBeLessThanOrEqual(width + 0.0001);
      expect(node.y + node.height).toBeLessThanOrEqual(height + 0.0001);
    });

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        expect(overlaps(nodes[i], nodes[j])).toBe(false);
      }
    }
  });
});
