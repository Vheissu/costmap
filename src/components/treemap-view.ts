import type { TreemapItem } from '../types';
import { createShadowRoot } from '../app/dom';
import { generateTreemap } from '../app/services/treemap';
import { formatAmount } from '../app/format';
import { toMonthly } from '../app/services/yearly';

class TreemapView extends HTMLElement {
  private container: HTMLDivElement;
  private items: TreemapItem[] = [];
  private observer: ResizeObserver | null = null;
  private width = 0;
  private height = 0;

  constructor() {
    super();
    const { container } = createShadowRoot(this);
    this.container = container;
  }

  set data(items: TreemapItem[]) {
    this.items = items;
    this.render();
  }

  connectedCallback() {
    this.container.className = 'w-full h-full';
    this.observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.contentRect;
        this.width = rect.width;
        this.height = rect.height;
        this.render();
      }
    });
    this.observer.observe(this);
    this.render();
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }

  private render() {
    if (this.width === 0 || this.height === 0) {
      const rect = this.getBoundingClientRect();
      this.width = rect.width || 800;
      this.height = rect.height || 520;
    }

    if (!this.items.length) {
      this.container.innerHTML = `
        <div class="flex h-full min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/60 px-6 text-center">
          <div class="text-3xl">No expenses yet</div>
          <p class="mt-2 text-sm text-slate-500">Add your first expense to see the cost map.</p>
        </div>
      `;
      return;
    }

    const nodes = generateTreemap(this.items, this.width, this.height);
    const total = this.items.reduce((sum, item) => sum + item.value, 0);
    const viewBox = `0 0 ${this.width} ${this.height}`;
    const tileMarkup = nodes
      .map((node, index) => {
        const padding = 12;
        const pad = Math.min(padding, node.width / 6, node.height / 6);
        const x = node.x + pad;
        const y = node.y + pad;
        const width = Math.max(1, node.width - pad * 2);
        const height = Math.max(1, node.height - pad * 2);
        const radius = Math.min(18, width / 4, height / 4);
        const percentValue = total > 0 ? (node.value / total) * 100 : 0;
        const percentText =
          percentValue < 0.1
            ? '&lt;0.1'
            : percentValue >= 10
              ? percentValue.toFixed(0)
              : percentValue.toFixed(1);
        const showLabel = width > 64 && height > 28;
        const showCompactLabel = !showLabel && width > 28 && height > 20;
        const showPercent = width > 18 && height > 14;
        const label = node.label.length > 22 ? `${node.label.slice(0, 20)}...` : node.label;
        const compactLabel = node.label
          .split(' ')
          .filter(Boolean)
          .map((word) => word[0])
          .join('')
          .slice(0, 3)
          .toUpperCase();
        const labelSize = Math.max(11, Math.min(16, Math.min(width / 8, height / 3)));
        const percentSize = Math.max(9, Math.min(22, Math.min(width / 5.5, height / 2.4)));
        const compactSize = Math.max(8, Math.min(12, Math.min(width / 6, height / 2.8)));
        const textShadow = 'paint-order: stroke; stroke: rgba(255,255,255,0.7); stroke-width: 3px;';
        const clipId = `clip-${node.id.replace(/[^a-z0-9_-]/gi, '')}-${index}`;
        const showValue = width > 120 && height > 52;
        const showMonthly = width > 120 && height > 70;
        const valueText = formatAmount(node.value);
        const monthlyText = formatAmount(toMonthly(node.value));

        return `
          <g class="treemap-tile" data-id="${node.id}" data-kind="${node.kind}">
            <defs>
              <clipPath id="${clipId}">
                <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}"></rect>
              </clipPath>
            </defs>
            <rect
              x="${x}"
              y="${y}"
              width="${width}"
              height="${height}"
              rx="${radius}"
              fill="${node.color}"
              fill-opacity="0.9"
              stroke="rgba(255,255,255,0.9)"
              stroke-width="1.5"
              filter="url(#tileShadow)"
            ></rect>
            <title>${node.label} - ${node.value.toFixed(0)} (${percentText}%)</title>
            <g clip-path="url(#${clipId})">
              ${
                showLabel
                  ? `<text
                      x="${x + 12}"
                      y="${y + 12}"
                      fill="#0f172a"
                      font-size="${labelSize}"
                      font-weight="600"
                      dominant-baseline="hanging"
                      style="${textShadow}"
                    >
                      ${label}
                    </text>`
                  : showCompactLabel
                    ? `<text
                        x="${x + 10}"
                        y="${y + 10}"
                        fill="#0f172a"
                        font-size="${compactSize}"
                        font-weight="700"
                        dominant-baseline="hanging"
                        style="${textShadow}"
                      >
                        ${compactLabel}
                      </text>`
                    : ''
              }
              ${
                showValue && showLabel
                  ? `<text
                      x="${x + 12}"
                      y="${y + 34}"
                      fill="#1f2937"
                      font-size="${Math.max(9, labelSize - 2)}"
                      font-weight="500"
                      dominant-baseline="hanging"
                      style="${textShadow}"
                    >
                      ${valueText} / yr
                    </text>`
                  : ''
              }
              ${
                showMonthly && showLabel
                  ? `<text
                      x="${x + 12}"
                      y="${y + 52}"
                      fill="#1f2937"
                      font-size="${Math.max(9, labelSize - 3)}"
                      font-weight="500"
                      dominant-baseline="hanging"
                      style="${textShadow}"
                    >
                      ${monthlyText} / mo
                    </text>`
                  : ''
              }
              ${
                showPercent
                  ? showLabel || showCompactLabel
                    ? `<text
                        x="${x + width - 10}"
                        y="${y + height - 10}"
                        fill="#0f172a"
                        font-size="${percentSize}"
                        font-weight="700"
                        dominant-baseline="auto"
                        text-anchor="end"
                        style="${textShadow}"
                      >
                        ${percentText}%
                      </text>`
                    : `<text
                        x="${x + width / 2}"
                        y="${y + height / 2}"
                        fill="#0f172a"
                        font-size="${percentSize}"
                        font-weight="700"
                        text-anchor="middle"
                        dominant-baseline="middle"
                        style="${textShadow}"
                      >
                        ${percentText}%
                      </text>`
                  : ''
              }
            </g>
          </g>
        `;
      })
      .join('');

    this.container.innerHTML = `
      <svg class="h-full w-full rounded-3xl border border-white/60 bg-white/70 shadow-sm" viewBox="${viewBox}">
        <defs>
          <pattern id="gridPattern" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(148,163,184,0.18)" stroke-width="1" />
          </pattern>
          <filter id="tileShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="rgba(15,23,42,0.08)" />
          </filter>
        </defs>
        <rect x="0" y="0" width="${this.width}" height="${this.height}" rx="24" fill="url(#gridPattern)" opacity="0.4"></rect>
        ${tileMarkup}
      </svg>
    `;

    const svg = this.container.querySelector('svg');
    svg?.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest('g');
      if (!target) return;
      const id = target.getAttribute('data-id');
      const kind = target.getAttribute('data-kind') as 'expense' | 'category' | null;
      if (!id || !kind) return;
      this.dispatchEvent(
        new CustomEvent('select-item', {
          bubbles: true,
          detail: { id, kind }
        })
      );
    });
  }
}

customElements.define('treemap-view', TreemapView);
