import { describe, expect, it } from 'vitest';
import { escapeHtml, formatPercent } from '../../format';

describe('formatting helpers', () => {
  it('escapes html special characters', () => {
    expect(escapeHtml(`<img src=x onerror="alert('1')">&`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;&amp;'
    );
  });

  it('formats shares as percentages', () => {
    expect(formatPercent(0.5)).toBe('50%');
    expect(formatPercent(0.0512)).toBe('5.1%');
    expect(formatPercent(0.0001)).toBe('<0.1%');
    expect(formatPercent(0)).toBe('0.0%');
  });
});
