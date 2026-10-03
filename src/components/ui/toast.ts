import { createShadowRoot } from '../../app/dom';
import { escapeHtml } from '../../app/format';

type ToastOptions = { actionLabel?: string; onAction?: () => void; duration?: number };

let instance: UiToast | null = null;

/** Show a message in the page's toast region, optionally with an action like Undo. */
export const showToast = (message: string, options: ToastOptions = {}) => instance?.show(message, options);

class UiToast extends HTMLElement {
  private container: HTMLDivElement;
  private timeoutId: number | null = null;

  constructor() {
    super();
    const { container } = createShadowRoot(this);
    this.container = container;
    this.container.setAttribute('role', 'status');
    this.container.setAttribute('aria-live', 'polite');
  }

  connectedCallback() {
    instance = this;
  }

  disconnectedCallback() {
    if (instance === this) instance = null;
  }

  show(message: string, { actionLabel, onAction, duration }: ToastOptions = {}) {
    this.container.innerHTML = `
      <div class="fixed bottom-4 left-1/2 z-[60] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-4 rounded-[3px] bg-ink px-4 py-3 text-sm text-on-ink shadow-sheet">
        <span>${escapeHtml(message)}</span>
        ${
          actionLabel
            ? `<button type="button" class="font-bold underline underline-offset-2 hover:no-underline">${escapeHtml(actionLabel)}</button>`
            : ''
        }
      </div>
    `;

    this.container.querySelector('button')?.addEventListener('click', () => {
      this.clear();
      onAction?.();
    });

    if (this.timeoutId) window.clearTimeout(this.timeoutId);
    this.timeoutId = window.setTimeout(() => this.clear(), duration ?? (actionLabel ? 6000 : 2600));
  }

  private clear() {
    if (this.timeoutId) window.clearTimeout(this.timeoutId);
    this.timeoutId = null;
    this.container.innerHTML = '';
  }
}

customElements.define('ui-toast', UiToast);
