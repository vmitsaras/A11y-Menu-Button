import {
  MENU_BUTTON_EVENTS,
  dispatchMenuButtonEvent,
} from '../events.js';
import {
  getMatchingRoots,
  getMenuPanel,
  ITEM_SELECTOR,
} from './shared.js';

export interface FilterResultCountContext {
  count: number;
  query: string;
  normalizedQuery: string;
}

export type FilterResultCountFormatter = (
  context: Readonly<FilterResultCountContext>,
) => string;

export interface FilterableMenuOptions {
  input?: HTMLInputElement | HTMLTextAreaElement;
  emptyState?: HTMLElement;
  label?: string;
  emptyMessage?: string;
  announceResultCount?: boolean;
  formatResultCount?: FilterResultCountFormatter;
}

export interface FilterableMenuController {
  readonly input: HTMLInputElement | HTMLTextAreaElement;
  readonly emptyState: HTMLElement;
  filter(): void;
  destroy(): void;
}

const ROOT_SELECTOR = '[data-menu-filterable="true"]';
const FILTER_CLASS = 'a11y-menu-button__filter';
const FILTER_INPUT_CLASS = 'a11y-menu-button__filter-input';
const EMPTY_CLASS = 'a11y-menu-button__empty';
const RESULT_STATUS_CLASS = 'a11y-menu-button__filter-status';
const INPUT_SELECTOR = '[data-menu-filter-input]';
const RESULT_STATUS_SELECTOR =
  ':scope > [data-menu-filter-status], :scope > .a11y-menu-button__filter-status';
const DEFAULT_EMPTY_MESSAGE = 'No matching items';
const RESULT_ANNOUNCEMENT_DELAY = 250;
const controllers = new WeakMap<HTMLElement, FilterableMenuController>();
let filterIdCounter = 0;

interface ResultStatusSnapshot {
  role: string | null;
  live: string | null;
  atomic: string | null;
  hidden: boolean;
  text: string;
}

interface InputSnapshot {
  id: string | null;
  label: string | null;
  placeholder: string | null;
}

interface EmptyStateSnapshot {
  hidden: boolean;
  text: string;
}

function defaultResultCountFormatter({
  count,
}: FilterResultCountContext): string {
  return count === 1
    ? '1 menu item available.'
    : `${count} menu items available.`;
}

function restoreAttribute(
  element: HTMLElement,
  name: string,
  value: string | null,
): void {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

function itemText(item: Element): string {
  return (item.getAttribute('data-menu-label') || item.textContent || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

function visibleItems(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll(ITEM_SELECTOR)).filter(
    (item): item is HTMLElement =>
      item instanceof HTMLElement && !item.hidden && item.offsetParent !== null,
  );
}

export function enhanceFilterableMenu(
  root: HTMLElement,
  options: FilterableMenuOptions = {},
): FilterableMenuController | null {
  if (!(root instanceof HTMLElement)) {
    throw new TypeError('enhanceFilterableMenu: root must be an HTMLElement');
  }
  if (root.dataset.menuFilterable !== 'true') return null;
  const existingController = controllers.get(root);
  if (existingController) return existingController;
  const panel = getMenuPanel(root);
  if (!panel) throw new Error('enhanceFilterableMenu: no panel found');

  const existingInput = panel.querySelector(INPUT_SELECTOR);
  let generatedWrapper: HTMLElement | null = null;
  let input = options.input;
  if (!input && (existingInput instanceof HTMLInputElement || existingInput instanceof HTMLTextAreaElement)) {
    input = existingInput;
  }
  if (!input) {
    generatedWrapper = document.createElement('div');
    const generatedInput = document.createElement('input');
    generatedWrapper.className = FILTER_CLASS;
    generatedInput.className = FILTER_INPUT_CLASS;
    generatedInput.type = 'search';
    generatedInput.autocomplete = 'off';
    generatedInput.spellcheck = false;
    generatedInput.dataset.menuFilterInput = '';
    generatedWrapper.append(generatedInput);
    panel.prepend(generatedWrapper);
    input = generatedInput;
  }
  const inputSnapshot: InputSnapshot | null = generatedWrapper
    ? null
    : {
        id: input.getAttribute('id'),
        label: input.getAttribute('aria-label'),
        placeholder: input.getAttribute('placeholder'),
      };
  const label = options.label?.trim() || 'Filter menu items';
  if (!input.id) input.id = `a11y-menu-filter-${++filterIdCounter}`;
  if (!input.hasAttribute('aria-label')) input.setAttribute('aria-label', label);
  if (input instanceof HTMLInputElement && !input.placeholder) input.placeholder = label;

  const existingEmpty = panel.querySelector(`:scope > .${EMPTY_CLASS}`);
  const empty =
    options.emptyState ??
    (existingEmpty instanceof HTMLElement ? existingEmpty : null) ??
    document.createElement('div');
  const generatedEmpty = !options.emptyState && !existingEmpty;
  const emptyStateSnapshot: EmptyStateSnapshot | null = generatedEmpty
    ? null
    : {
        hidden: empty.hidden,
        text: empty.textContent ?? '',
      };
  if (generatedEmpty) {
    empty.className = EMPTY_CLASS;
    empty.setAttribute('role', 'status');
    empty.setAttribute('aria-live', 'polite');
    panel.append(empty);
  }
  empty.textContent =
    options.emptyMessage?.trim() ||
    root.dataset.menuFilterEmpty ||
    DEFAULT_EMPTY_MESSAGE;
  empty.hidden = true;

  const announceResultCount = options.announceResultCount === true;
  const existingResultStatus = announceResultCount
    ? panel.querySelector(RESULT_STATUS_SELECTOR)
    : null;
  const resultStatus = announceResultCount
    ? existingResultStatus instanceof HTMLElement
      ? existingResultStatus
      : document.createElement('p')
    : null;
  const generatedResultStatus = Boolean(
    resultStatus && !(existingResultStatus instanceof HTMLElement),
  );
  const resultStatusSnapshot: ResultStatusSnapshot | null =
    resultStatus && !generatedResultStatus
      ? {
          role: resultStatus.getAttribute('role'),
          live: resultStatus.getAttribute('aria-live'),
          atomic: resultStatus.getAttribute('aria-atomic'),
          hidden: resultStatus.hidden,
          text: resultStatus.textContent ?? '',
        }
      : null;
  if (resultStatus) {
    if (generatedResultStatus) {
      resultStatus.className = RESULT_STATUS_CLASS;
      resultStatus.dataset.menuFilterStatus = '';
      panel.append(resultStatus);
    }
    resultStatus.setAttribute('role', 'status');
    resultStatus.setAttribute('aria-live', 'polite');
    resultStatus.setAttribute('aria-atomic', 'true');
    resultStatus.hidden = false;
    resultStatus.textContent = '';
  }

  const originalHidden = new Map<HTMLElement, boolean>();
  let destroyed = false;
  let resultAnnouncementTimer: number | null = null;
  let pendingResultContext: FilterResultCountContext | null = null;
  let lastResultAnnouncement = '';
  let controller: FilterableMenuController;

  const clearPendingResultAnnouncement = (): void => {
    if (resultAnnouncementTimer !== null) {
      window.clearTimeout(resultAnnouncementTimer);
    }
    resultAnnouncementTimer = null;
    pendingResultContext = null;
  };

  const scheduleResultAnnouncement = (
    context: FilterResultCountContext,
  ): void => {
    if (!resultStatus || destroyed) return;
    clearPendingResultAnnouncement();

    // The existing empty-state region is the sole zero-result announcement.
    if (context.count === 0) {
      resultStatus.textContent = '';
      lastResultAnnouncement = '';
      return;
    }

    pendingResultContext = context;
    resultAnnouncementTimer = window.setTimeout(() => {
      resultAnnouncementTimer = null;
      const pending = pendingResultContext;
      pendingResultContext = null;
      if (!pending || destroyed) return;
      const formatter =
        options.formatResultCount ?? defaultResultCountFormatter;
      const formatted = formatter(pending);
      const message = typeof formatted === 'string' ? formatted.trim() : '';
      if (!message || message === lastResultAnnouncement) return;
      resultStatus.textContent = message;
      lastResultAnnouncement = message;
    }, RESULT_ANNOUNCEMENT_DELAY);
  };

  const filter = (): { normalizedQuery: string; matchCount: number } => {
    if (destroyed) return { normalizedQuery: '', matchCount: 0 };
    const normalizedQuery = input.value
      .replace(/\s+/g, ' ')
      .trim()
      .toLocaleLowerCase();
    let matches = 0;
    panel.querySelectorAll(ITEM_SELECTOR).forEach((item) => {
      if (!(item instanceof HTMLElement)) return;
      if (!originalHidden.has(item)) {
        originalHidden.set(item, item.hasAttribute('hidden'));
      }
      const match = !normalizedQuery || itemText(item).includes(normalizedQuery);
      item.hidden = !match;
      if (match) matches += 1;
    });
    empty.hidden = matches > 0;
    if (
      document.activeElement instanceof HTMLElement &&
      document.activeElement.matches(ITEM_SELECTOR) &&
      document.activeElement.hidden
    ) {
      input.focus();
    }
    return { normalizedQuery, matchCount: visibleItems(panel).length };
  };

  const onInput = (): void => {
    const result = filter();
    if (destroyed) return;
    const query = input.value;
    dispatchMenuButtonEvent(root, MENU_BUTTON_EVENTS.filter, {
      root,
      query,
      normalizedQuery: result.normalizedQuery,
      matchCount: result.matchCount,
      input,
      panel,
      controller,
      reason: 'input',
    });
    scheduleResultAnnouncement({
      count: result.matchCount,
      query,
      normalizedQuery: result.normalizedQuery,
    });
  };

  controller = {
    input,
    emptyState: empty,
    filter() {
      filter();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearPendingResultAnnouncement();
      input.removeEventListener('input', onInput);
      originalHidden.forEach((hidden, item) => {
        item.hidden = hidden;
      });
      if (generatedEmpty) empty.remove();
      else if (emptyStateSnapshot) {
        empty.hidden = emptyStateSnapshot.hidden;
        empty.textContent = emptyStateSnapshot.text;
      }
      if (generatedResultStatus) {
        resultStatus?.remove();
      } else if (resultStatus && resultStatusSnapshot) {
        restoreAttribute(resultStatus, 'role', resultStatusSnapshot.role);
        restoreAttribute(resultStatus, 'aria-live', resultStatusSnapshot.live);
        restoreAttribute(resultStatus, 'aria-atomic', resultStatusSnapshot.atomic);
        resultStatus.hidden = resultStatusSnapshot.hidden;
        resultStatus.textContent = resultStatusSnapshot.text;
      }
      if (inputSnapshot) {
        restoreAttribute(input, 'id', inputSnapshot.id);
        restoreAttribute(input, 'aria-label', inputSnapshot.label);
        restoreAttribute(input, 'placeholder', inputSnapshot.placeholder);
      }
      generatedWrapper?.remove();
      controllers.delete(root);
    },
  };
  input.addEventListener('input', onInput);
  controllers.set(root, controller);
  filter();
  return controller;
}

export function enhanceFilterableMenus(
  root: ParentNode = document,
  options: FilterableMenuOptions = {},
): FilterableMenuController[] {
  return getMatchingRoots(root, ROOT_SELECTOR)
    .map((menu) => enhanceFilterableMenu(menu, options))
    .filter((controller): controller is FilterableMenuController => controller !== null);
}

export default enhanceFilterableMenus;
