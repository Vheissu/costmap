import { createShadowRoot } from '../../app/dom';

class UiModal extends HTMLElement {
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
    return ['open'];
  }

  attributeChangedCallback() {
    this.render();
  }

  get open() {
    return this.hasAttribute('open');
  }

  set open(value: boolean) {
    if (value) {
      this.setAttribute('open', '');
    } else {
      this.removeAttribute('open');
    }
  }

  private render() {
    const isOpen = this.open;
    this.container.innerHTML = `
      <div class="${isOpen ? '' : 'hidden'} fixed inset-0 z-50 flex items-center justify-center">
        <div class="modal-backdrop absolute inset-0 bg-slate-900/30"></div>
        <div class="relative z-10 w-[min(92vw,520px)] rounded-3xl bg-white p-6 shadow-xl">
          <slot></slot>
        </div>
      </div>
    `;
  }
}

customElements.define('ui-modal', UiModal);
