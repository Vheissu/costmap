import { applySharedStyles } from './styles';

export const createShadowRoot = (host: HTMLElement) => {
  const root = host.attachShadow({ mode: 'open' });
  applySharedStyles(root);

  const container = document.createElement('div');
  root.appendChild(container);

  return { root, container };
};
