import { createShadowRoot } from '../../app/dom';

class UiToast extends HTMLElement {
  private container: HTMLDivElement;
  private timeoutId: number | null = null;

  constructor() {
    super();
    const { container } = createShadowRoot(this);
    this.container = container;
  }

  connectedCallback() {
    this.render();
  }

  show(message: string, duration = 2400) {
    this.container.innerHTML = `
      <div class="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
        ${message}
      </div>
    `;

    if (this.timeoutId) window.clearTimeout(this.timeoutId);
    this.timeoutId = window.setTimeout(() => {
      this.container.innerHTML = '';
    }, duration);
  }

  private render() {
    if (!this.container.innerHTML) {
      this.container.innerHTML = '';
    }
  }
}

customElements.define('ui-toast', UiToast);
