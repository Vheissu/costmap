import { createShadowRoot } from '../../app/dom';

class UiButton extends HTMLElement {
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
    return ['variant', 'type', 'disabled'];
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    const variant = this.getAttribute('variant') ?? 'primary';
    const type = this.getAttribute('type') ?? 'button';
    const disabled = this.hasAttribute('disabled');

    const base = 'px-4 py-2 rounded-full text-sm font-semibold transition';
    const variants: Record<string, string> = {
      primary: 'bg-primary-500 text-white hover:bg-primary-600',
      ghost: 'bg-transparent text-slate-700 hover:bg-white/70',
      outline: 'border border-slate-200 text-slate-700 hover:bg-white/70'
    };

    this.container.innerHTML = `
      <button
        class="${base} ${variants[variant] ?? variants.primary}"
        type="${type}"
        ${disabled ? 'disabled' : ''}
      >
        <slot></slot>
      </button>
    `;

    const button = this.container.querySelector('button');
    if (button) {
      button.onclick = (event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }

        if (type === 'submit') {
          const form = this.closest('form');
          if (form) {
            event.preventDefault();
            if (typeof (form as HTMLFormElement).requestSubmit === 'function') {
              (form as HTMLFormElement).requestSubmit();
            } else {
              form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            }
          }
        }

        if (type === 'reset') {
          const form = this.closest('form');
          form?.reset();
        }
      };
    }
  }
}

customElements.define('ui-button', UiButton);
