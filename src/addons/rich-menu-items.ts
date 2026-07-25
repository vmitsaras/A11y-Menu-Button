import { getMatchingRoots, PANEL_SELECTOR } from './shared.js';

export interface RichMenuItemsOptions {
  itemSelector?: string;
}

export interface RichMenuItemsController {
  refresh(): void;
  destroy(): void;
}

interface ItemSnapshot {
  nodes: Node[];
  ariaLabel: string | null;
  rich: boolean;
  danger: boolean;
}

const ITEM_SELECTOR = 'a[href], button';
const ENHANCED_CLASS = 'a11y-menu-button__item--rich';
const CONTENT_CLASS = 'a11y-menu-button__item-content';
const LABEL_CLASS = 'a11y-menu-button__item-label';
const DESCRIPTION_CLASS = 'a11y-menu-button__item-description';
const ICON_CLASS = 'a11y-menu-button__item-icon';
const SHORTCUT_CLASS = 'a11y-menu-button__item-shortcut';
const DANGER_CLASS = 'a11y-menu-button__item--danger';

function decorativeSpan(className: string, text: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = className;
  span.setAttribute('aria-hidden', 'true');
  span.textContent = text;
  return span;
}

export function enhanceRichMenuItems(
  root: ParentNode = document,
  options: RichMenuItemsOptions = {},
): RichMenuItemsController {
  const snapshots = new Map<HTMLElement, ItemSnapshot>();
  let destroyed = false;
  const itemSelector = options.itemSelector?.trim() || ITEM_SELECTOR;

  const enhance = (item: HTMLElement): void => {
    if (snapshots.has(item) || item.classList.contains(ENHANCED_CLASS)) return;
    const originalLabel = item.textContent?.trim() ?? '';
    const nodes = Array.from(item.childNodes);
    snapshots.set(item, {
      nodes,
      ariaLabel: item.getAttribute('aria-label'),
      rich: item.classList.contains(ENHANCED_CLASS),
      danger: item.classList.contains(DANGER_CLASS),
    });

    const label = document.createElement('span');
    const content = document.createElement('span');
    label.className = LABEL_CLASS;
    label.append(...nodes);
    content.className = CONTENT_CLASS;
    content.append(label);
    item.classList.add(ENHANCED_CLASS);
    if (item.dataset.menuVariant === 'danger') item.classList.add(DANGER_CLASS);
    if (item.dataset.menuIcon) {
      item.append(decorativeSpan(ICON_CLASS, item.dataset.menuIcon));
    }
    item.append(content);
    if (item.dataset.menuDescription) {
      content.append(
        decorativeSpan(DESCRIPTION_CLASS, item.dataset.menuDescription),
      );
    }
    if (item.dataset.menuShortcut) {
      item.append(decorativeSpan(SHORTCUT_CLASS, item.dataset.menuShortcut));
    }
    if (originalLabel && !item.hasAttribute('aria-label')) {
      item.setAttribute('aria-label', originalLabel);
    }
  };

  const refresh = (): void => {
    if (destroyed) return;
    getMatchingRoots(root, PANEL_SELECTOR).forEach((panel) => {
      panel.querySelectorAll(itemSelector).forEach((item) => {
        if (item instanceof HTMLElement) enhance(item);
      });
    });
  };

  refresh();
  return {
    refresh,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      snapshots.forEach((snapshot, item) => {
        item.replaceChildren(...snapshot.nodes);
        item.classList.toggle(ENHANCED_CLASS, snapshot.rich);
        item.classList.toggle(DANGER_CLASS, snapshot.danger);
        if (snapshot.ariaLabel === null) item.removeAttribute('aria-label');
        else item.setAttribute('aria-label', snapshot.ariaLabel);
      });
      snapshots.clear();
    },
  };
}

export default enhanceRichMenuItems;
