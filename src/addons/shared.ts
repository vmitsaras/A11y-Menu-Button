export const PANEL_SELECTOR = '.a11y-menu-button__panel';
export const ITEM_SELECTOR = '.a11y-menu-button__item';

export function getMenuPanel(root: HTMLElement): HTMLElement | null {
  const trigger = root.querySelector(
    ':scope > .a11y-menu-button__trigger, :scope > button[aria-controls]',
  );
  const panelId = trigger?.getAttribute('aria-controls');
  const controlled = panelId ? document.getElementById(panelId) : null;
  if (controlled instanceof HTMLElement) return controlled;

  const fallback = root.querySelector(`:scope > ${PANEL_SELECTOR}, :scope > [id]`);
  return fallback instanceof HTMLElement ? fallback : null;
}

export function getMatchingRoots(
  root: ParentNode,
  selector: string,
): HTMLElement[] {
  const current =
    root instanceof HTMLElement && root.matches(selector) ? [root] : [];
  const descendants = Array.from(root.querySelectorAll(selector)).filter(
    (element): element is HTMLElement => element instanceof HTMLElement,
  );
  return [...current, ...descendants];
}

export function parseSafeInteger(
  value: number | string | null | undefined,
  fallback: number,
  minimum = 0,
): number {
  const parsed =
    typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

