import type { Recommendation } from '../types';
import { createShadowRoot } from '../app/dom';
import { formatAmount } from '../app/format';

class RecommendationCard extends HTMLElement {
  private container: HTMLDivElement;
  private data: Recommendation | null = null;

  constructor() {
    super();
    const { container } = createShadowRoot(this);
    this.container = container;
  }

  set recommendation(value: Recommendation | null) {
    this.data = value;
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  private render() {
    if (!this.data) {
      this.container.innerHTML = '';
      return;
    }
    const { title, description, savingsYearly, effort } = this.data;
    this.container.innerHTML = `
      <div class="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-semibold text-slate-900">${title}</p>
            <p class="mt-1 text-xs text-slate-600">${description}</p>
          </div>
          <span class="rounded-full bg-accent-mint/40 px-2 py-1 text-xs font-semibold text-slate-700">${effort}</span>
        </div>
        <div class="mt-3 text-xs text-slate-500">Est. savings: ${formatAmount(savingsYearly)} / yr</div>
      </div>
    `;
  }
}

customElements.define('recommendation-card', RecommendationCard);
