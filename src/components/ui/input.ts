import { createShadowRoot } from '../../app/dom';

class UiInput extends HTMLElement {
  private container: HTMLDivElement;

  constructor() {
    super();
    const { container } = createShadowRoot(this);
    this.container = container;
  }

  connectedCallback() {
    this.render();
  }

  static get observedAttributes() {
    return ['type', 'value', 'placeholder', 'name'];
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    const type = this.getAttribute('type') ?? 'text';
    const value = this.getAttribute('value') ?? '';
    const placeholder = this.getAttribute('placeholder') ?? '';
    const name = this.getAttribute('name') ?? '';

    this.container.innerHTML = `
      <input
        class="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none"
        type="${type}"
        name="${name}"
        placeholder="${placeholder}"
        value="${value}"
      />
    `;
  }
}

customElements.define('ui-input', UiInput);
