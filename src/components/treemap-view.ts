import type { Period, TreemapItem, TreemapNode } from '../types';
import { createShadowRoot } from '../app/dom';
import { generateTreemap } from '../app/services/treemap';
import { escapeHtml, formatMoney, formatMoneyShort, formatPercent, PERIOD_SUFFIX } from '../app/format';
import { toPeriod } from '../app/services/yearly';

const GAP = 1; // half the visible gap between tiles, in px

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string) => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) return 0.5;
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};

/** Dark ink or white, whichever reads better on the tile colour. */
const textColorFor = (hex: string) => {
  const l = luminance(hex);
  const onDark = 1.05 / (l + 0.05);
  const onLight = (l + 0.05) / (0.0161 + 0.05); // #1d2230
  return onLight >= onDark ? '#1d2230' : '#ffffff';
};

class TreemapView extends HTMLElement {
  private container: HTMLDivElement;
  private tooltip: HTMLDivElement;
  private items: TreemapItem[] = [];
  private nodes: TreemapNode[] = [];
  private tiles = new Map<string, HTMLButtonElement>();
  private observer: ResizeObserver | null = null;
  private width = 0;
  private height = 0;
  private total = 0;
  private selected: string | null = null;
  private highlighted: string | null = null;
  private currencyCode = 'USD';
  private displayPeriod: Period = 'year';
  private frame = 0;

  constructor() {
    super();
    const { container } = createShadowRoot(this);
    this.container = container;
    this.container.className = 'relative h-full w-full';
    this.container.setAttribute('role', 'group');
    this.tooltip = document.createElement('div');
    this.tooltip.className =
      'pointer-events-none absolute z-10 hidden min-w-[160px] max-w-[240px] rounded-[3px] bg-ink px-3 py-2 text-xs text-on-ink shadow-sheet';
    this.tooltip.setAttribute('aria-hidden', 'true');
    this.container.appendChild(this.tooltip);

    this.container.addEventListener('click', (event) => {
      const tile = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]');
      if (!tile) return;
      this.dispatchEvent(
        new CustomEvent('select-item', {
          bubbles: true,
          composed: true,
          detail: { id: tile.dataset.id, kind: tile.dataset.kind }
        })
      );
    });

    this.container.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse') return;
      const tile = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]');
      if (!tile) {
        this.tooltip.classList.add('hidden');
        return;
      }
      this.showTooltip(tile, event.clientX, event.clientY);
    });

    this.container.addEventListener('pointerleave', () => this.tooltip.classList.add('hidden'));
  }

  set data(items: TreemapItem[]) {
    this.items = items;
    this.total = items.reduce((sum, item) => sum + item.value, 0);
    this.layout();
  }

  set selectedId(value: string | null) {
    if (this.selected === value) return;
    this.selected = value;
    this.paintState();
  }

  /** Category to emphasise, e.g. while hovering the legend. */
  set highlightCategory(value: string | null) {
    if (this.highlighted === value) return;
    this.highlighted = value;
    this.paintState();
  }

  set currency(value: string) {
    if (this.currencyCode === value) return;
    this.currencyCode = value;
    this.paint();
  }

  set period(value: Period) {
    if (this.displayPeriod === value) return;
    this.displayPeriod = value;
    this.paint();
  }

  connectedCallback() {
    this.observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      if (Math.abs(rect.width - this.width) < 0.5 && Math.abs(rect.height - this.height) < 0.5) return;
      this.width = rect.width;
      this.height = rect.height;
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => this.layout());
    });
    this.observer.observe(this);
  }

  disconnectedCallback() {
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
  }

  private layout() {
    this.nodes = generateTreemap(this.items, this.width, this.height);
    this.paint();
  }

  private amountText(value: number, short = false) {
    const amount = toPeriod(value, this.displayPeriod);
    // Cents are noise on big tiles; keep them only where they matter.
    const money =
      short || amount >= 100 ? formatMoneyShort(amount, this.currencyCode) : formatMoney(amount, this.currencyCode);
    return `${money}${PERIOD_SUFFIX[this.displayPeriod]}`;
  }

  private fullAmount(value: number) {
    return `${formatMoney(toPeriod(value, this.displayPeriod), this.currencyCode)}${PERIOD_SUFFIX[this.displayPeriod]}`;
  }

  private paint() {
    const seen = new Set<string>();
    const label = this.items.length
      ? `Cost map with ${this.items.length} ${this.items[0].kind === 'category' ? 'categories' : 'expenses'}`
      : 'Cost map';
    this.container.setAttribute('aria-label', label);

    this.nodes.forEach((node, index) => {
      const key = `${node.kind}:${node.id}`;
      seen.add(key);
      let tile = this.tiles.get(key);
      const isNew = !tile;
      if (!tile) {
        tile = document.createElement('button');
        tile.type = 'button';
        tile.dataset.id = node.id;
        tile.dataset.kind = node.kind;
        tile.className =
          'absolute overflow-hidden rounded-[2px] text-left transition-[left,top,width,height,opacity] duration-300 ease-out hover:brightness-[1.06] focus-visible:z-10 focus-visible:outline-offset-[-3px]';
        this.tiles.set(key, tile);
        this.container.appendChild(tile);
      }

      const width = Math.max(0, node.width - GAP * 2);
      const height = Math.max(0, node.height - GAP * 2);
      const share = this.total > 0 ? node.value / this.total : 0;
      const ink = textColorFor(node.color);

      Object.assign(tile.style, {
        left: `${node.x + GAP}px`,
        top: `${node.y + GAP}px`,
        width: `${width}px`,
        height: `${height}px`,
        background: node.color,
        color: ink,
        transitionDelay: isNew ? `${Math.min(index * 12, 240)}ms` : '0ms'
      });
      tile.setAttribute(
        'aria-label',
        `${node.label}: ${this.fullAmount(node.value)}, ${formatPercent(share)} of total`
      );
      tile.innerHTML = this.tileContent(node, width, height, share);
    });

    for (const [key, tile] of this.tiles) {
      if (!seen.has(key)) {
        tile.remove();
        this.tiles.delete(key);
      }
    }
    this.paintState();
  }

  private tileContent(node: TreemapNode, width: number, height: number, share: number) {
    const name = escapeHtml(node.label);
    if (width >= 96 && height >= 64) {
      const size = Math.round(Math.max(13, Math.min(22, Math.sqrt(width * height) / 13)));
      return `
        <span class="flex h-full flex-col justify-between p-2.5">
          <span>
            <span class="line-clamp-2 block font-bold leading-tight" style="font-size:${size}px">${name}</span>
            <span class="figures mt-1 block text-[13px] font-medium opacity-85">${escapeHtml(this.amountText(node.value))}</span>
          </span>
          ${height >= 88 ? `<span class="figures self-end text-[13px] font-bold opacity-85">${escapeHtml(formatPercent(share))}</span>` : ''}
        </span>`;
    }
    if (width >= 52 && height >= 30) {
      return `
        <span class="block p-1.5 leading-tight">
          <span class="block truncate text-[12px] font-bold">${name}</span>
          ${
            height >= 48
              ? `<span class="figures block truncate text-[11px] opacity-85">${escapeHtml(this.amountText(node.value, true))}</span>`
              : ''
          }
        </span>`;
    }
    return '';
  }

  private paintState() {
    const focusId = this.selected;
    const focusCategory = this.highlighted;
    for (const tile of this.tiles.values()) {
      const node = this.nodes.find((entry) => entry.id === tile.dataset.id && entry.kind === tile.dataset.kind);
      const isSelected = focusId !== null && tile.dataset.id === focusId;
      const dimmed =
        (focusId !== null && !isSelected) ||
        (focusCategory !== null && node?.categoryId !== focusCategory);
      tile.style.opacity = dimmed ? '0.4' : '1';
      tile.style.boxShadow = isSelected ? 'inset 0 0 0 2px var(--paper), inset 0 0 0 4px var(--ink)' : '';
      tile.setAttribute('aria-pressed', String(isSelected));
    }
  }

  private showTooltip(tile: HTMLElement, clientX: number, clientY: number) {
    const node = this.nodes.find((entry) => entry.id === tile.dataset.id && entry.kind === tile.dataset.kind);
    if (!node) return;
    const share = this.total > 0 ? node.value / this.total : 0;
    const yearly = formatMoney(node.value, this.currencyCode);
    this.tooltip.innerHTML = `
      <div class="font-bold">${escapeHtml(node.label)}</div>
      <div class="figures mt-1 flex justify-between gap-4"><span>${escapeHtml(this.fullAmount(node.value))}</span><span>${escapeHtml(formatPercent(share))}</span></div>
      ${this.displayPeriod !== 'year' ? `<div class="figures opacity-75">${escapeHtml(yearly)}/yr</div>` : ''}
    `;
    this.tooltip.classList.remove('hidden');

    const containerRect = this.container.getBoundingClientRect();
    const x = clientX - containerRect.left;
    const y = clientY - containerRect.top;
    const tipWidth = this.tooltip.offsetWidth;
    const tipHeight = this.tooltip.offsetHeight;
    const left = x + 14 + tipWidth > this.width ? x - tipWidth - 14 : x + 14;
    const top = y + 14 + tipHeight > this.height ? y - tipHeight - 10 : y + 14;
    this.tooltip.style.left = `${Math.max(0, left)}px`;
    this.tooltip.style.top = `${Math.max(0, top)}px`;
  }
}

customElements.define('treemap-view', TreemapView);
