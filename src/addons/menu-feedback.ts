import {
  MENU_BUTTON_EVENTS,
  addMenuButtonEventListener,
} from '../events.js';

export interface MenuFeedbackOptions {
  region?: HTMLElement;
  duration?: number;
}

export interface MenuFeedbackController {
  readonly region: HTMLElement;
  clear(): void;
  destroy(): void;
}

const DEFAULT_DURATION = 2000;
const FEEDBACK_CLASS = 'a11y-menu-button__feedback';
const VISIBLE_CLASS = 'a11y-menu-button__feedback--visible';
const controllers = new WeakMap<HTMLElement, MenuFeedbackController>();

function getFeedbackMessage(item: HTMLElement | null): string {
  return item?.dataset.menuFeedback?.trim() || '';
}

function getFeedbackDuration(
  item: HTMLElement | null,
  fallback: number,
): number {
  const raw = item?.dataset.menuFeedbackDuration;
  const parsed = raw === undefined ? fallback : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function attachMenuFeedback(
  root: HTMLElement,
  options: MenuFeedbackOptions = {},
): MenuFeedbackController {
  if (!(root instanceof HTMLElement)) {
    throw new TypeError('attachMenuFeedback: root must be an HTMLElement');
  }
  const existing = controllers.get(root);
  if (existing) return existing;

  const existingRegion = root.querySelector(`:scope > .${FEEDBACK_CLASS}`);
  const region =
    options.region ??
    (existingRegion instanceof HTMLElement ? existingRegion : null) ??
    document.createElement('span');
  const generated = !options.region && !existingRegion;
  const initialText = region.textContent ?? '';
  const initiallyVisible = region.classList.contains(VISIBLE_CLASS);
  if (generated) {
    region.className = FEEDBACK_CLASS;
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    root.append(region);
  }

  const fallbackDuration =
    options.duration !== undefined && options.duration >= 0
      ? options.duration
      : DEFAULT_DURATION;
  let clearTimer: number | null = null;
  let announceFrame: number | null = null;
  let destroyed = false;

  const clear = (): void => {
    if (clearTimer !== null) window.clearTimeout(clearTimer);
    if (announceFrame !== null) cancelAnimationFrame(announceFrame);
    clearTimer = null;
    announceFrame = null;
    region.classList.remove(VISIBLE_CLASS);
    region.textContent = '';
  };

  const removeItemClickListener = addMenuButtonEventListener(
    root,
    MENU_BUTTON_EVENTS.itemClick,
    (event) => {
      const detail = event.detail;
      const message = getFeedbackMessage(detail.item);
      if (!message) return;
      clear();
      announceFrame = requestAnimationFrame(() => {
        announceFrame = null;
        region.textContent = message;
        region.classList.add(VISIBLE_CLASS);
      });
      const duration = getFeedbackDuration(detail.item, fallbackDuration);
      if (duration > 0) clearTimer = window.setTimeout(clear, duration);
    },
  );

  const controller: MenuFeedbackController = {
    region,
    clear() {
      if (!destroyed) clear();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      removeItemClickListener();
      clear();
      if (generated) {
        region.remove();
      } else {
        region.textContent = initialText;
        region.classList.toggle(VISIBLE_CLASS, initiallyVisible);
      }
      controllers.delete(root);
    },
  };
  controllers.set(root, controller);
  return controller;
}

export default attachMenuFeedback;
