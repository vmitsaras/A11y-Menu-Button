import {
  MENU_BUTTON_EVENTS,
  dispatchMenuButtonEvent,
} from '../events.js';
import {
  getMatchingRoots,
  getMenuPanel,
  ITEM_SELECTOR,
  parseSafeInteger,
} from './shared.js';

export type AsyncMenuState = 'loading' | 'empty' | 'error' | 'ready';

export interface AsyncMenuStateOptions {
  panel?: HTMLElement;
  stateElement?: HTMLElement;
  state?: AsyncMenuState;
  message?: string;
  skeletonCount?: number;
  hideItems?: boolean;
}

export interface AsyncMenuStateController {
  readonly panel: HTMLElement;
  readonly stateElement: HTMLElement;
  setState(state: AsyncMenuState, options?: AsyncMenuStateOptions): void;
  setLoading(loading?: boolean, options?: AsyncMenuStateOptions): void;
  setEmpty(options?: AsyncMenuStateOptions): void;
  setError(options?: AsyncMenuStateOptions): void;
  setReady(options?: AsyncMenuStateOptions): void;
  destroy(): void;
}

const ROOT_SELECTOR = '[data-menu-loading="true"]';
const STATE_CLASS = 'a11y-menu-button__async-state';
const STATE_MESSAGE_CLASS = 'a11y-menu-button__async-message';
const SKELETON_CLASS = 'a11y-menu-button__async-skeleton';
const SKELETON_ITEM_CLASS = 'a11y-menu-button__async-skeleton-item';
const DEFAULT_LOADING_MESSAGE = 'Loading menu items…';
const DEFAULT_EMPTY_MESSAGE = 'No menu items are available.';
const DEFAULT_ERROR_MESSAGE = 'Menu items could not be loaded.';
const DEFAULT_SKELETON_COUNT = 3;
const VALID_STATES = new Set<AsyncMenuState>([
  'loading',
  'empty',
  'error',
  'ready',
]);
const controllers = new WeakMap<HTMLElement, AsyncMenuStateController>();

function getMessage(
  root: HTMLElement,
  options: AsyncMenuStateOptions,
  state: AsyncMenuState,
): string {
  if (options.message?.trim()) return options.message.trim();
  if (state === 'loading') {
    return root.dataset.menuLoadingMessage || DEFAULT_LOADING_MESSAGE;
  }
  if (state === 'error') {
    return root.dataset.menuErrorMessage || DEFAULT_ERROR_MESSAGE;
  }
  return root.dataset.menuEmptyMessage || DEFAULT_EMPTY_MESSAGE;
}

function createSkeleton(count: number): HTMLElement {
  const skeleton = document.createElement('div');
  skeleton.className = SKELETON_CLASS;
  skeleton.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < count; index += 1) {
    const item = document.createElement('span');
    item.className = SKELETON_ITEM_CLASS;
    skeleton.append(item);
  }
  return skeleton;
}

function updateStateElement(
  stateElement: HTMLElement,
  root: HTMLElement,
  options: AsyncMenuStateOptions,
  state: AsyncMenuState,
): void {
  const message =
    stateElement.querySelector(`.${STATE_MESSAGE_CLASS}`) ?? stateElement;
  stateElement.dataset.menuAsyncState = state;
  stateElement.setAttribute('role', 'status');
  stateElement.setAttribute('aria-live', 'polite');
  stateElement.setAttribute('aria-atomic', 'true');
  message.textContent = getMessage(root, options, state);
}

function createStateElement(
  root: HTMLElement,
  options: AsyncMenuStateOptions,
  state: AsyncMenuState,
): HTMLElement {
  const element = document.createElement('div');
  const message = document.createElement('p');
  const count = parseSafeInteger(
    options.skeletonCount ?? root.dataset.menuLoadingSkeletonCount,
    DEFAULT_SKELETON_COUNT,
    1,
  );
  element.className = STATE_CLASS;
  message.className = STATE_MESSAGE_CLASS;
  element.append(message, createSkeleton(count));
  updateStateElement(element, root, options, state);
  return element;
}

function setItemsHidden(
  panel: HTMLElement,
  hidden: boolean,
  originalHidden: Map<HTMLElement, boolean>,
): void {
  if (!hidden) {
    originalHidden.forEach((wasHidden, item) => {
      item.hidden = wasHidden;
    });
    originalHidden.clear();
    return;
  }
  panel.querySelectorAll(ITEM_SELECTOR).forEach((item) => {
    if (!(item instanceof HTMLElement)) return;
    if (!originalHidden.has(item)) originalHidden.set(item, item.hidden);
    item.hidden = true;
  });
}

export function enhanceAsyncMenuState(
  root: HTMLElement,
  options: AsyncMenuStateOptions = {},
): AsyncMenuStateController {
  if (!(root instanceof HTMLElement)) {
    throw new TypeError('enhanceAsyncMenuState: root must be an HTMLElement');
  }
  const existingController = controllers.get(root);
  if (existingController) return existingController;

  const panel = options.panel ?? getMenuPanel(root);
  if (!panel) throw new Error('enhanceAsyncMenuState: no panel found');

  const initialState = options.state ??
    (root.dataset.menuLoading === 'true' ? 'loading' : 'ready');
  const existingStateElement = panel.querySelector(`:scope > .${STATE_CLASS}`);
  const stateElement =
    options.stateElement ??
    (existingStateElement instanceof HTMLElement ? existingStateElement : null) ??
    createStateElement(root, options, initialState);
  const generatedStateElement = !options.stateElement && !existingStateElement;
  const initialStateElementParent = stateElement.parentNode;
  const initialStateElementNextSibling = stateElement.nextSibling;
  const stateMessage =
    stateElement.querySelector<HTMLElement>(`.${STATE_MESSAGE_CLASS}`) ??
    stateElement;
  const initialStateMessageChildren = generatedStateElement
    ? []
    : Array.from(stateMessage.childNodes);
  const initialStateElementAttributes = generatedStateElement
    ? null
    : {
        role: stateElement.getAttribute('role'),
        live: stateElement.getAttribute('aria-live'),
        atomic: stateElement.getAttribute('aria-atomic'),
        state: stateElement.getAttribute('data-menu-async-state'),
        hidden: stateElement.hidden,
      };
  if (!stateElement.parentNode) panel.prepend(stateElement);

  const initialRootState = root.getAttribute('data-menu-async-state');
  const initialLoading = root.getAttribute('data-menu-loading');
  const initialBusy = panel.getAttribute('aria-busy');
  let currentState = initialState;
  let destroyed = false;
  const originalHidden = new Map<HTMLElement, boolean>();
  let controller: AsyncMenuStateController;

  const applyState = (
    nextState: AsyncMenuState,
    nextOptions: AsyncMenuStateOptions,
    reason: 'initialization' | 'programmatic',
  ): void => {
    if (destroyed) return;
    const previousState = currentState;
    const state = VALID_STATES.has(nextState) ? nextState : 'ready';
    const merged = { ...options, ...nextOptions };
    const loading = state === 'loading';
    const messageState = loading || state === 'empty' || state === 'error';
    currentState = state;
    root.dataset.menuAsyncState = state;
    root.dataset.menuLoading = String(loading);
    panel.setAttribute('aria-busy', String(loading));
    stateElement.hidden = !messageState;
    updateStateElement(stateElement, root, merged, state);
    setItemsHidden(
      panel,
      messageState && merged.hideItems !== false,
      originalHidden,
    );
    dispatchMenuButtonEvent(root, MENU_BUTTON_EVENTS.asyncState, {
      root,
      state,
      previousState,
      loading,
      panel,
      stateElement,
      controller,
      reason,
    });
  };

  controller = {
    panel,
    stateElement,
    setState(nextState, nextOptions = {}) {
      applyState(nextState, nextOptions, 'programmatic');
    },
    setLoading(loading = true, nextOptions = {}) {
      controller.setState(loading ? 'loading' : 'ready', nextOptions);
    },
    setEmpty(nextOptions = {}) {
      controller.setState('empty', nextOptions);
    },
    setError(nextOptions = {}) {
      controller.setState('error', nextOptions);
    },
    setReady(nextOptions = {}) {
      controller.setState('ready', nextOptions);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      setItemsHidden(panel, false, originalHidden);
      if (initialRootState === null) delete root.dataset.menuAsyncState;
      else root.dataset.menuAsyncState = initialRootState;
      if (initialLoading === null) delete root.dataset.menuLoading;
      else root.dataset.menuLoading = initialLoading;
      if (initialBusy === null) panel.removeAttribute('aria-busy');
      else panel.setAttribute('aria-busy', initialBusy);
      if (generatedStateElement) {
        stateElement.remove();
      } else if (initialStateElementAttributes) {
        const restoreAttribute = (name: string, value: string | null): void => {
          if (value === null) stateElement.removeAttribute(name);
          else stateElement.setAttribute(name, value);
        };
        restoreAttribute('role', initialStateElementAttributes.role);
        restoreAttribute('aria-live', initialStateElementAttributes.live);
        restoreAttribute('aria-atomic', initialStateElementAttributes.atomic);
        restoreAttribute(
          'data-menu-async-state',
          initialStateElementAttributes.state,
        );
        stateElement.hidden = initialStateElementAttributes.hidden;
        stateMessage.replaceChildren(...initialStateMessageChildren);
        if (!initialStateElementParent) {
          stateElement.remove();
        } else if (stateElement.parentNode !== initialStateElementParent) {
          initialStateElementParent.insertBefore(
            stateElement,
            initialStateElementNextSibling,
          );
        }
      }
      controllers.delete(root);
    },
  };

  controllers.set(root, controller);
  applyState(initialState, {}, 'initialization');
  return controller;
}

export function setAsyncMenuLoading(
  root: HTMLElement,
  loading = true,
  options: AsyncMenuStateOptions = {},
): AsyncMenuStateController {
  const controller = controllers.get(root) ?? enhanceAsyncMenuState(root, options);
  controller.setLoading(loading, options);
  return controller;
}

export function enhanceAsyncMenuStates(
  root: ParentNode = document,
  options: AsyncMenuStateOptions = {},
): AsyncMenuStateController[] {
  return getMatchingRoots(root, ROOT_SELECTOR).map((menu) =>
    enhanceAsyncMenuState(menu, options),
  );
}

export default enhanceAsyncMenuState;
