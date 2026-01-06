import tailwindCss from '../styles/main.css?inline';

let sharedSheet: CSSStyleSheet | null = null;
const canAdopt =
  'adoptedStyleSheets' in Document.prototype &&
  'replaceSync' in CSSStyleSheet.prototype;

export const applySharedStyles = (root: ShadowRoot) => {
  if (canAdopt) {
    if (!sharedSheet) {
      sharedSheet = new CSSStyleSheet();
      sharedSheet.replaceSync(tailwindCss);
    }
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sharedSheet];
    return;
  }

  const styleTag = document.createElement('style');
  styleTag.textContent = tailwindCss;
  root.appendChild(styleTag);
};
