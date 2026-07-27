import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  A11yMenuButton,
  MENU_BUTTON_EVENTS,
  addMenuButtonEventListener,
  attachMenuFeedback,
  attachMenuHints,
  createMenuButton,
  enhanceAsyncMenuState,
  enhanceCommandMenu,
  enhanceFilterableMenu,
  enhanceRecentActions,
  enhanceRichMenuItems,
  initMenuButtons,
  type FilterResultCountContext,
  type MenuButtonEventMap,
} from '../src/index.js';
import * as core from '../src/core.js';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, String(value));
  }
}

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: new MemoryStorage(),
});

function renderMenu(attributes = ''): HTMLElement {
  document.body.innerHTML = `
    <div class="a11y-menu-button" data-a11y-menu-button ${attributes}>
      <button class="a11y-menu-button__trigger" aria-controls="test-panel">
        Actions
      </button>
      <div class="a11y-menu-button__panel" id="test-panel" hidden>
        <button class="a11y-menu-button__item" type="button" data-menu-close>Archive</button>
        <button class="a11y-menu-button__item" type="button">Duplicate</button>
        <button class="a11y-menu-button__item" type="button" aria-disabled="true">Disabled</button>
      </div>
    </div>`;

  document.querySelectorAll('.a11y-menu-button__item').forEach((item) => {
    Object.defineProperty(item, 'offsetParent', {
      configurable: true,
      get: () => (item.hasAttribute('hidden') ? null : document.body),
    });
  });
  const root = document.querySelector('[data-a11y-menu-button]');
  if (!(root instanceof HTMLElement)) throw new Error('Test root was not rendered');
  return root;
}

function keyboard(target: Element, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

beforeEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('A11yMenuButton', () => {
  it('keeps the core entry free of add-on exports', () => {
    expect(core.createMenuButton).toBe(createMenuButton);
    expect(core.MENU_BUTTON_EVENTS).toBe(MENU_BUTTON_EVENTS);
    expect(core).not.toHaveProperty('enhanceFilterableMenu');
    expect(core).not.toHaveProperty('enhanceAsyncMenuState');
  });

  it('creates an instance and initializes disclosure state', () => {
    const root = renderMenu();
    const initialized = vi.fn();
    root.addEventListener(MENU_BUTTON_EVENTS.init, initialized);
    const instance = createMenuButton(root, { observeVisibility: false });

    expect(instance).toBeInstanceOf(A11yMenuButton);
    expect(instance.trigger.type).toBe('button');
    expect(instance.trigger.getAttribute('aria-expanded')).toBe('false');
    expect(instance.panel.getAttribute('aria-labelledby')).toBe(instance.trigger.id);
    expect(instance.trigger.hasAttribute('aria-haspopup')).toBe(false);
    expect(instance.isOpen()).toBe(false);
    expect(initialized).toHaveBeenCalledOnce();
    expect((initialized.mock.calls[0]?.[0] as CustomEvent).detail).toMatchObject({
      instance,
      open: false,
      reason: 'programmatic',
    });
  });

  it('reuses duplicate initialization and allows initialization after destroy', () => {
    const root = renderMenu();
    const first = createMenuButton(root, { observeVisibility: false });
    const duplicate = createMenuButton(root, { observeVisibility: false });
    expect(duplicate).toBe(first);

    first.destroy();
    const replacement = createMenuButton(root, { observeVisibility: false });
    expect(replacement).not.toBe(first);
  });

  it('normalizes dataset values and lets explicit options win', () => {
    const root = renderMenu(
      'data-close-on-escape="false" data-placement="top-start" data-typeahead-timeout="900"',
    );
    const instance = createMenuButton(root, {
      closeOnEscape: true,
      observeVisibility: false,
    });

    expect(instance.options.closeOnEscape).toBe(true);
    expect(instance.options.placement).toBe('top-start');
    expect(instance.options.typeaheadTimeout).toBe(900);
  });

  it('opens, closes, bubbles typed lifecycle details, and supports cancellation', () => {
    const root = renderMenu();
    const details: unknown[] = [];
    root.addEventListener(MENU_BUTTON_EVENTS.open, (event) => {
      details.push((event as CustomEvent).detail);
    });
    const instance = createMenuButton(root, { observeVisibility: false });
    instance.open({ reason: 'programmatic' });

    expect(instance.isOpen()).toBe(true);
    expect(instance.trigger.getAttribute('aria-expanded')).toBe('true');
    expect(details).toHaveLength(1);
    expect(details[0]).toMatchObject({ instance, open: true, reason: 'programmatic' });

    root.addEventListener(MENU_BUTTON_EVENTS.beforeClose, (event) => event.preventDefault(), {
      once: true,
    });
    instance.close();
    expect(instance.isOpen()).toBe(true);
    instance.close();
    expect(instance.isOpen()).toBe(false);
  });

  it('uses explicit event options and stable transition snapshots', () => {
    const root = renderMenu();
    const events: CustomEvent[] = [];
    [
      MENU_BUTTON_EVENTS.beforeOpen,
      MENU_BUTTON_EVENTS.open,
      MENU_BUTTON_EVENTS.beforeClose,
      MENU_BUTTON_EVENTS.close,
    ].forEach((type) => {
      root.addEventListener(type, (event) => events.push(event as CustomEvent));
    });
    const instance = createMenuButton(root, { observeVisibility: false });

    instance.open({ reason: 'keyboard' });
    instance.close({ reason: 'escape' });

    expect(events.map((event) => event.type)).toEqual([
      MENU_BUTTON_EVENTS.beforeOpen,
      MENU_BUTTON_EVENTS.open,
      MENU_BUTTON_EVENTS.beforeClose,
      MENU_BUTTON_EVENTS.close,
    ]);
    expect(events.map((event) => event.detail)).toMatchObject([
      { open: true, previousOpen: false, nextOpen: true, reason: 'keyboard' },
      { open: true, previousOpen: false, nextOpen: true, reason: 'keyboard' },
      { open: false, previousOpen: true, nextOpen: false, reason: 'escape' },
      { open: false, previousOpen: true, nextOpen: false, reason: 'escape' },
    ]);
    expect(events.map(({ bubbles, composed, cancelable }) => ({
      bubbles,
      composed,
      cancelable,
    }))).toEqual([
      { bubbles: true, composed: false, cancelable: true },
      { bubbles: true, composed: false, cancelable: false },
      { bubbles: true, composed: false, cancelable: true },
      { bubbles: true, composed: false, cancelable: false },
    ]);
    expect(events.every((event) => event.target === root)).toBe(true);
  });

  it('blocks reentrant transitions and makes destroy final before notification', () => {
    const root = renderMenu();
    const beforeOpen = vi.fn();
    const beforeClose = vi.fn();
    const destroyed = vi.fn();
    const opened = vi.fn();
    let instance: A11yMenuButton;
    root.addEventListener(MENU_BUTTON_EVENTS.beforeOpen, () => {
      beforeOpen();
      instance.open();
    });
    root.addEventListener(MENU_BUTTON_EVENTS.open, opened);
    root.addEventListener(MENU_BUTTON_EVENTS.beforeClose, () => {
      beforeClose();
      instance.close();
    });
    root.addEventListener(MENU_BUTTON_EVENTS.destroy, () => {
      destroyed();
      instance.destroy();
      instance.close();
    });
    instance = createMenuButton(root, { observeVisibility: false });

    instance.open();
    expect(beforeOpen).toHaveBeenCalledOnce();
    expect(opened).toHaveBeenCalledOnce();
    instance.close();
    expect(beforeClose).toHaveBeenCalledOnce();
    instance.destroy();
    instance.open();
    expect(destroyed).toHaveBeenCalledOnce();
    expect(opened).toHaveBeenCalledOnce();
  });

  it('exports event names with their inferred detail payloads', () => {
    type OpenDetail = MenuButtonEventMap[typeof MENU_BUTTON_EVENTS.open];
    type ItemDetail = MenuButtonEventMap[typeof MENU_BUTTON_EVENTS.itemClick];

    expectTypeOf<OpenDetail['open']>().toEqualTypeOf<true>();
    expectTypeOf<OpenDetail['item']>().toEqualTypeOf<null>();
    expectTypeOf<ItemDetail['item']>().toEqualTypeOf<HTMLElement>();
    expect(Object.isFrozen(MENU_BUTTON_EVENTS)).toBe(true);
    expect(Object.values(MENU_BUTTON_EVENTS).every((name) => name.startsWith('menu-button:'))).toBe(true);

    const root = renderMenu();
    const remove = addMenuButtonEventListener(
      root,
      MENU_BUTTON_EVENTS.itemClick,
      (event) => {
        expectTypeOf(event.detail.item).toEqualTypeOf<HTMLElement>();
      },
    );
    remove();
  });

  it('reports refresh completion and rejects unsafe element replacement', () => {
    const root = renderMenu();
    const refreshed = vi.fn();
    let instance: A11yMenuButton;
    root.addEventListener(MENU_BUTTON_EVENTS.refresh, (event) => {
      refreshed(event);
      instance.refresh();
    });
    instance = createMenuButton(root, { observeVisibility: false });

    instance.refresh();
    expect(refreshed).toHaveBeenCalledOnce();
    expect((refreshed.mock.calls[0]?.[0] as CustomEvent).detail).toMatchObject({
      instance,
      trigger: instance.trigger,
      panel: instance.panel,
      reason: 'programmatic',
    });

    const replacement = instance.trigger.cloneNode(true);
    instance.trigger.replaceWith(replacement);
    expect(() => instance.refresh()).toThrow(/destroy and reinitialize/);
  });

  it('supports arrow keys, Home/End, Escape, and typeahead', () => {
    const root = renderMenu();
    const instance = createMenuButton(root, { observeVisibility: false });
    keyboard(instance.trigger, 'ArrowDown');
    const items = Array.from(instance.panel.querySelectorAll('button'));
    expect(document.activeElement).toBe(items[0]);

    keyboard(items[0], 'ArrowDown');
    expect(document.activeElement).toBe(items[1]);
    keyboard(items[1], 'End');
    expect(document.activeElement).toBe(items[1]);
    keyboard(items[1], 'a');
    expect(document.activeElement).toBe(items[0]);
    keyboard(items[0], 'Escape');
    expect(document.activeElement).toBe(instance.trigger);
    expect(instance.isOpen()).toBe(false);
  });

  it('uses associated native checkbox labels for typeahead', () => {
    vi.useFakeTimers();
    const root = renderMenu();
    const instance = createMenuButton(root, { observeVisibility: false });
    instance.panel.innerHTML = `
      <label>
        <input type="checkbox" name="mentions" />
        Mentions
      </label>
      <label for="weekly-summary">Weekly summary</label>
      <input id="weekly-summary" type="checkbox" name="weekly-summary" />`;
    const checkboxes = Array.from(
      instance.panel.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );
    checkboxes.forEach((checkbox) => {
      Object.defineProperty(checkbox, 'offsetParent', {
        configurable: true,
        get: () => document.body,
      });
    });
    const [mentions, weeklySummary] = checkboxes;
    if (!mentions || !weeklySummary) throw new Error('Checkbox options were not rendered');

    instance.open();
    mentions.focus();
    keyboard(mentions, 'w');
    expect(document.activeElement).toBe(weeklySummary);

    vi.advanceTimersByTime(instance.options.typeaheadTimeout);
    keyboard(weeklySummary, 'm');
    expect(document.activeElement).toBe(mentions);
  });

  it('does not intercept printable keys in editable panel controls', () => {
    const root = renderMenu();
    const instance = createMenuButton(root, { observeVisibility: false });
    instance.panel.innerHTML = '<input type="search" aria-label="Filter actions" />';
    const input = instance.panel.querySelector<HTMLInputElement>('input');
    if (!input) throw new Error('Search input was not rendered');

    instance.open();
    input.focus();
    const printable = new KeyboardEvent('keydown', {
      key: 'a',
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(printable);

    expect(printable.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  it('skips hidden and disabled items during keyboard navigation', () => {
    const root = renderMenu();
    const instance = createMenuButton(root, { observeVisibility: false });
    const items = Array.from(instance.panel.querySelectorAll<HTMLElement>('button'));
    items[1]?.setAttribute('hidden', '');

    keyboard(instance.trigger, 'ArrowDown');
    expect(document.activeElement).toBe(items[0]);
    keyboard(items[0] as HTMLElement, 'ArrowDown');
    expect(document.activeElement).toBe(items[0]);

    items[1]?.removeAttribute('hidden');
    keyboard(items[0] as HTMLElement, 'ArrowDown');
    expect(document.activeElement).toBe(items[1]);
  });

  it('returns focus after a closing button action and preserves lifecycle order', () => {
    const root = renderMenu();
    const order: string[] = [];
    const instance = createMenuButton(root, { observeVisibility: false });
    const item = instance.panel.querySelector<HTMLButtonElement>('[data-menu-close]');
    if (!item) throw new Error('Button item was not rendered');
    const setPanelAttribute = instance.panel.setAttribute.bind(instance.panel);
    vi.spyOn(instance.panel, 'setAttribute').mockImplementation((name, value) => {
      setPanelAttribute(name, value);
      if (name === 'hidden') item.blur();
    });
    [
      MENU_BUTTON_EVENTS.itemClick,
      MENU_BUTTON_EVENTS.beforeClose,
      MENU_BUTTON_EVENTS.close,
    ].forEach((type) => root.addEventListener(type, () => order.push(type)));

    instance.open();
    item.focus();
    item.click();

    expect(instance.isOpen()).toBe(false);
    expect(document.activeElement).toBe(instance.trigger);
    expect(order).toEqual([
      MENU_BUTTON_EVENTS.itemClick,
      MENU_BUTTON_EVENTS.beforeClose,
      MENU_BUTTON_EVENTS.close,
    ]);
  });

  it('returns focus after a closing link action', () => {
    const root = renderMenu();
    const instance = createMenuButton(root, { observeVisibility: false });
    const link = document.createElement('a');
    link.className = 'a11y-menu-button__item';
    link.href = '#profile';
    link.dataset.menuClose = '';
    link.textContent = 'Profile';
    link.addEventListener('click', (event) => event.preventDefault());
    instance.panel.append(link);

    instance.open();
    link.focus();
    link.click();

    expect(instance.isOpen()).toBe(false);
    expect(document.activeElement).toBe(instance.trigger);
  });

  it('preserves focus moved by item-click or before-close listeners', () => {
    const root = renderMenu();
    const destination = document.createElement('button');
    destination.textContent = 'Dialog action';
    document.body.append(destination);
    const instance = createMenuButton(root, { observeVisibility: false });
    const item = instance.panel.querySelector<HTMLButtonElement>('[data-menu-close]');
    if (!item) throw new Error('Button item was not rendered');
    const moveOnItemClick = () => destination.focus();
    root.addEventListener(MENU_BUTTON_EVENTS.itemClick, moveOnItemClick);

    instance.open();
    item.focus();
    item.click();
    expect(instance.isOpen()).toBe(false);
    expect(document.activeElement).toBe(destination);

    root.removeEventListener(MENU_BUTTON_EVENTS.itemClick, moveOnItemClick);
    root.addEventListener(
      MENU_BUTTON_EVENTS.beforeClose,
      () => destination.focus(),
      { once: true },
    );
    instance.open();
    item.focus();
    item.click();
    expect(instance.isOpen()).toBe(false);
    expect(document.activeElement).toBe(destination);
  });

  it('does not move focus when item-triggered closure is canceled', () => {
    const root = renderMenu();
    const instance = createMenuButton(root, { observeVisibility: false });
    const item = instance.panel.querySelector<HTMLButtonElement>('[data-menu-close]');
    if (!item) throw new Error('Button item was not rendered');
    root.addEventListener(
      MENU_BUTTON_EVENTS.beforeClose,
      (event) => event.preventDefault(),
      { once: true },
    );

    instance.open();
    item.focus();
    item.click();

    expect(instance.isOpen()).toBe(true);
    expect(document.activeElement).toBe(item);
  });

  it('restores item focus once after duplicate initialization', () => {
    const root = renderMenu();
    const first = createMenuButton(root, { observeVisibility: false });
    const duplicate = createMenuButton(root, { observeVisibility: false });
    const itemClicked = vi.fn();
    const closed = vi.fn();
    const item = first.panel.querySelector<HTMLButtonElement>('[data-menu-close]');
    if (!item) throw new Error('Button item was not rendered');
    root.addEventListener(MENU_BUTTON_EVENTS.itemClick, itemClicked);
    root.addEventListener(MENU_BUTTON_EVENTS.close, closed);

    first.open();
    item.focus();
    item.click();

    expect(duplicate).toBe(first);
    expect(itemClicked).toHaveBeenCalledOnce();
    expect(closed).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(first.trigger);
  });

  it('removes item focus-restoration behavior on destroy', () => {
    const root = renderMenu();
    const destination = document.createElement('button');
    destination.textContent = 'Outside';
    document.body.append(destination);
    const itemClicked = vi.fn();
    const instance = createMenuButton(root, { observeVisibility: false });
    const item = instance.panel.querySelector<HTMLButtonElement>('[data-menu-close]');
    if (!item) throw new Error('Button item was not rendered');
    root.addEventListener(MENU_BUTTON_EVENTS.itemClick, itemClicked);

    instance.open();
    instance.destroy();
    destination.focus();
    item.click();

    expect(itemClicked).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(destination);
  });

  it('closes after outside pointer and focus-out interactions', async () => {
    const root = renderMenu();
    const outside = document.createElement('button');
    outside.textContent = 'Outside';
    document.body.append(outside);
    const instance = createMenuButton(root, { observeVisibility: false });

    instance.open();
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(instance.isOpen()).toBe(false);

    instance.open();
    outside.focus();
    instance.panel.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }),
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(instance.isOpen()).toBe(false);
  });

  it('keeps the panel open long enough for an internal label click to toggle its checkbox', async () => {
    const root = renderMenu();
    const instance = createMenuButton(root, { observeVisibility: false });
    instance.panel.innerHTML = `
      <label>
        <input type="checkbox" name="weekly-summary" />
        Weekly summary
      </label>`;
    const label = instance.panel.querySelector('label');
    const checkbox = instance.panel.querySelector<HTMLInputElement>('input');
    if (!label || !checkbox) throw new Error('Checkbox option was not rendered');

    instance.open();
    instance.trigger.focus();
    label.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    instance.trigger.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: null }),
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    expect(instance.isOpen()).toBe(true);
    label.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    label.click();
    expect(checkbox.checked).toBe(true);
    expect(instance.isOpen()).toBe(true);
  });

  it('preserves native checkbox keyboard activation instead of synthesizing Enter clicks', () => {
    const root = renderMenu();
    const instance = createMenuButton(root, { observeVisibility: false });
    instance.panel.innerHTML = '<input type="checkbox" name="mentions" />';
    const checkbox = instance.panel.querySelector<HTMLInputElement>('input');
    if (!checkbox) throw new Error('Checkbox was not rendered');

    instance.open();
    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    checkbox.dispatchEvent(enter);

    expect(enter.defaultPrevented).toBe(false);
    expect(checkbox.checked).toBe(false);
    expect(instance.isOpen()).toBe(true);
  });

  it('toggles and flips placement when the preferred side overflows', () => {
    const root = renderMenu();
    const trigger = root.querySelector<HTMLButtonElement>('.a11y-menu-button__trigger');
    const panel = root.querySelector<HTMLElement>('.a11y-menu-button__panel');
    if (!trigger || !panel) throw new Error('Invalid fixture');
    trigger.getBoundingClientRect = () =>
      ({ top: 700, bottom: 730, left: 20, right: 120, width: 100, height: 30, x: 20, y: 700, toJSON: () => ({}) }) as DOMRect;
    Object.defineProperty(panel, 'scrollHeight', { configurable: true, value: 200 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    const instance = createMenuButton(root, {
      observeVisibility: false,
      placement: 'bottom-start',
    });

    instance.toggle();
    expect(instance.isOpen()).toBe(true);
    expect(root.dataset.placement).toBe('top-start');
    expect(root.style.getPropertyValue('--_panel-max-height')).toBe('201px');
    instance.toggle();
    expect(instance.isOpen()).toBe(false);
  });

  it('includes panel chrome when limiting its height', () => {
    const root = renderMenu();
    const trigger = root.querySelector<HTMLButtonElement>('.a11y-menu-button__trigger');
    const panel = root.querySelector<HTMLElement>('.a11y-menu-button__panel');
    if (!trigger || !panel) throw new Error('Invalid fixture');
    trigger.getBoundingClientRect = () =>
      ({ top: 100, bottom: 130, left: 20, right: 120, width: 100, height: 30, x: 20, y: 100, toJSON: () => ({}) }) as DOMRect;
    Object.defineProperties(panel, {
      scrollHeight: { configurable: true, value: 200 },
      clientHeight: { configurable: true, value: 200 },
      offsetHeight: { configurable: true, value: 202 },
    });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    const instance = createMenuButton(root, { observeVisibility: false });

    instance.open();

    expect(root.style.getPropertyValue('--_panel-max-height')).toBe('203px');
  });

  it('reapplies overflow placement after async state content changes', async () => {
    const root = renderMenu();
    const trigger = root.querySelector<HTMLButtonElement>('.a11y-menu-button__trigger');
    const panel = root.querySelector<HTMLElement>('.a11y-menu-button__panel');
    if (!trigger || !panel) throw new Error('Invalid fixture');
    trigger.getBoundingClientRect = () =>
      ({ top: 700, bottom: 730, left: 20, right: 120, width: 100, height: 30, x: 20, y: 700, toJSON: () => ({}) }) as DOMRect;
    Object.defineProperty(panel, 'scrollHeight', {
      configurable: true,
      get: () => root.dataset.menuAsyncState === 'loading' ? 200 : 40,
    });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    const instance = createMenuButton(root, {
      observeVisibility: false,
      placement: 'bottom-start',
    });
    const asyncState = enhanceAsyncMenuState(root);

    instance.open();
    expect(root.dataset.placement).toBe('bottom-start');

    asyncState.setLoading();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(root.dataset.placement).toBe('top-start');
    expect(root.style.getPropertyValue('--_panel-max-height')).toBe('201px');

    asyncState.setError();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(root.dataset.placement).toBe('bottom-start');
    expect(root.style.getPropertyValue('--_panel-max-height')).toBe('41px');
  });

  it('restores plugin-owned DOM state and removes listeners on destroy', () => {
    const root = renderMenu();
    const trigger = root.querySelector('button');
    const panel = root.querySelector('.a11y-menu-button__panel');
    if (!(trigger instanceof HTMLButtonElement) || !(panel instanceof HTMLElement)) {
      throw new Error('Invalid fixture');
    }
    trigger.removeAttribute('type');
    trigger.removeAttribute('aria-expanded');
    const instance = createMenuButton(root, { observeVisibility: false });
    instance.open();
    instance.destroy();

    expect(trigger.hasAttribute('type')).toBe(false);
    expect(trigger.hasAttribute('aria-expanded')).toBe(false);
    expect(panel.hidden).toBe(true);
    trigger.click();
    expect(panel.hidden).toBe(true);
  });

  it('disconnects its visibility observer on destroy', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    class MockIntersectionObserver {
      public observe = observe;
      public disconnect = disconnect;
    }
    vi.stubGlobal(
      'IntersectionObserver',
      MockIntersectionObserver as unknown as typeof IntersectionObserver,
    );
    const root = renderMenu();
    const instance = createMenuButton(root);

    expect(observe).toHaveBeenCalledWith(root);
    instance.destroy();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('initializes marked roots and rejects invalid markup', () => {
    renderMenu();
    expect(initMenuButtons(document, { observeVisibility: false })).toHaveLength(1);
    document.body.innerHTML = '<div data-a11y-menu-button></div>';
    const invalid = document.querySelector('div');
    expect(() => createMenuButton(invalid as HTMLElement)).toThrow(/button trigger/);
  });
});

describe('add-ons', () => {
  it('keeps core keyboard navigation across disabled and classless controls with filtering enabled', () => {
    const root = renderMenu('data-menu-filterable="true"');
    const instance = createMenuButton(root, { observeVisibility: false });
    const controller = enhanceFilterableMenu(root);
    if (!controller) throw new Error('Filter controller missing');

    const items = Array.from(
      instance.panel.querySelectorAll<HTMLButtonElement>('.a11y-menu-button__item'),
    );
    const disabled = items[2];
    if (!disabled) throw new Error('Disabled item missing');
    disabled.removeAttribute('aria-disabled');
    disabled.disabled = true;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('aria-label', 'Compact project view');
    instance.panel.append(checkbox);

    [controller.input, checkbox].forEach((control) => {
      Object.defineProperty(control, 'offsetParent', {
        configurable: true,
        get: () => document.body,
      });
    });

    instance.open();
    controller.input.focus();

    keyboard(controller.input, 'ArrowDown');
    expect(document.activeElement).toBe(items[0]);
    keyboard(items[0] as HTMLElement, 'ArrowDown');
    expect(document.activeElement).toBe(items[1]);
    keyboard(items[1] as HTMLElement, 'ArrowDown');
    expect(document.activeElement).toBe(checkbox);
    keyboard(checkbox, 'ArrowDown');
    expect(document.activeElement).toBe(controller.input);
    keyboard(controller.input, 'End');
    expect(document.activeElement).toBe(checkbox);
    keyboard(checkbox, 'Home');
    expect(document.activeElement).toBe(controller.input);
  });

  it('filters items, emits state, and restores hidden values', () => {
    const root = renderMenu('data-menu-filterable="true"');
    const controller = enhanceFilterableMenu(root);
    if (!controller) throw new Error('Filter controller missing');
    const event = vi.fn();
    root.addEventListener(MENU_BUTTON_EVENTS.filter, event);
    controller.input.value = 'archive';
    controller.input.dispatchEvent(new Event('input', { bubbles: true }));
    const items = root.querySelectorAll<HTMLElement>('.a11y-menu-button__item');
    expect(items[0]?.hidden).toBe(false);
    expect(items[1]?.hidden).toBe(true);
    expect(event).toHaveBeenCalledOnce();
    expect((event.mock.calls[0]?.[0] as CustomEvent).detail).toMatchObject({
      root,
      query: 'archive',
      normalizedQuery: 'archive',
      matchCount: 1,
      controller,
      reason: 'input',
    });
    expect(event.mock.calls[0]?.[0]).toMatchObject({
      bubbles: true,
      composed: false,
      cancelable: false,
    });
    controller.destroy();
    expect(items[1]?.hidden).toBe(false);
  });

  it('restores author-owned filter input and empty-state markup', () => {
    const root = renderMenu('data-menu-filterable="true"');
    const panel = root.querySelector<HTMLElement>('.a11y-menu-button__panel');
    if (!panel) throw new Error('Panel missing');
    const input = document.createElement('input');
    input.dataset.menuFilterInput = '';
    const empty = document.createElement('div');
    empty.className = 'a11y-menu-button__empty';
    empty.textContent = 'Original empty state';
    empty.hidden = false;
    panel.prepend(input);
    panel.append(empty);

    const controller = enhanceFilterableMenu(root);
    if (!controller) throw new Error('Filter controller missing');
    expect(input.id).toMatch(/^a11y-menu-filter-/);
    expect(input.getAttribute('aria-label')).toBe('Filter menu items');
    expect(input.getAttribute('placeholder')).toBe('Filter menu items');
    expect(empty.textContent).toBe('No matching items');
    expect(empty.hidden).toBe(true);

    controller.destroy();
    expect(input.hasAttribute('id')).toBe(false);
    expect(input.hasAttribute('aria-label')).toBe(false);
    expect(input.hasAttribute('placeholder')).toBe(false);
    expect(empty.textContent).toBe('Original empty state');
    expect(empty.hidden).toBe(false);
  });

  it('keeps filter result-count announcements disabled by default', async () => {
    vi.useFakeTimers();
    const root = renderMenu('data-menu-filterable="true"');
    const controller = enhanceFilterableMenu(root);
    if (!controller) throw new Error('Filter controller missing');

    expect(root.querySelector('[data-menu-filter-status]')).toBeNull();
    controller.input.value = 'archive';
    controller.input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(300);
    expect(root.querySelector('[data-menu-filter-status]')).toBeNull();
    controller.destroy();
  });

  it('delays rapid filter announcements and formats only the settled result', async () => {
    vi.useFakeTimers();
    const root = renderMenu('data-menu-filterable="true"');
    const formatResultCount = vi.fn(
      ({ count, query, normalizedQuery }: FilterResultCountContext) =>
        `${count} actions available for ${normalizedQuery || query}`,
    );
    const controller = enhanceFilterableMenu(root, {
      announceResultCount: true,
      formatResultCount,
    });
    if (!controller) throw new Error('Filter controller missing');
    const status = root.querySelector<HTMLElement>('[data-menu-filter-status]');
    if (!status) throw new Error('Filter status missing');

    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-atomic')).toBe('true');
    controller.input.value = 'a';
    controller.input.dispatchEvent(new Event('input', { bubbles: true }));
    controller.input.value = 'du';
    controller.input.dispatchEvent(new Event('input', { bubbles: true }));

    await vi.advanceTimersByTimeAsync(249);
    expect(status.textContent).toBe('');
    expect(formatResultCount).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(formatResultCount).toHaveBeenCalledOnce();
    expect(formatResultCount).toHaveBeenCalledWith({
      count: 1,
      query: 'du',
      normalizedQuery: 'du',
    });
    expect(status.textContent).toBe('1 actions available for du');
    controller.destroy();
  });

  it('deduplicates repeated formatted filter announcements', async () => {
    vi.useFakeTimers();
    const root = renderMenu('data-menu-filterable="true"');
    const controller = enhanceFilterableMenu(root, {
      announceResultCount: true,
    });
    if (!controller) throw new Error('Filter controller missing');
    const status = root.querySelector<HTMLElement>('[data-menu-filter-status]');
    if (!status) throw new Error('Filter status missing');

    controller.input.value = 'archive';
    controller.input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(250);
    expect(status.textContent).toBe('1 menu item available.');

    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) => mutations.push(...records));
    observer.observe(status, { childList: true, characterData: true, subtree: true });
    controller.input.value = 'duplicate';
    controller.input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();

    expect(status.textContent).toBe('1 menu item available.');
    expect(mutations).toHaveLength(0);
    observer.disconnect();
    controller.destroy();
  });

  it('lets the existing empty status own zero-result announcements', async () => {
    vi.useFakeTimers();
    const root = renderMenu('data-menu-filterable="true"');
    const formatResultCount = vi.fn(
      ({ count }: FilterResultCountContext) => `${count} actions available`,
    );
    const controller = enhanceFilterableMenu(root, {
      announceResultCount: true,
      formatResultCount,
    });
    if (!controller) throw new Error('Filter controller missing');
    const status = root.querySelector<HTMLElement>('[data-menu-filter-status]');
    if (!status) throw new Error('Filter status missing');

    controller.input.value = 'archive';
    controller.input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(250);
    expect(status.textContent).toBe('1 actions available');

    controller.input.value = 'nothing matches';
    controller.input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(controller.emptyState.hidden).toBe(false);
    expect(controller.emptyState.textContent).toBe('No matching items');
    expect(controller.emptyState.getAttribute('role')).toBe('status');
    expect(status.textContent).toBe('');
    await vi.advanceTimersByTimeAsync(300);
    expect(formatResultCount).toHaveBeenCalledOnce();
    controller.destroy();
  });

  it('cancels pending filter announcements and removes generated status on destroy', async () => {
    vi.useFakeTimers();
    const root = renderMenu('data-menu-filterable="true"');
    const formatResultCount = vi.fn(
      ({ count }: FilterResultCountContext) => `${count} actions available`,
    );
    const first = enhanceFilterableMenu(root, {
      announceResultCount: true,
      formatResultCount,
    });
    const duplicate = enhanceFilterableMenu(root, {
      announceResultCount: true,
      formatResultCount,
    });
    if (!first) throw new Error('Filter controller missing');
    const status = root.querySelector<HTMLElement>('[data-menu-filter-status]');
    if (!status) throw new Error('Filter status missing');

    expect(duplicate).toBe(first);
    expect(root.querySelectorAll('[data-menu-filter-status]')).toHaveLength(1);
    first.input.value = 'archive';
    first.input.dispatchEvent(new Event('input', { bubbles: true }));
    first.destroy();
    await vi.advanceTimersByTimeAsync(300);

    expect(formatResultCount).not.toHaveBeenCalled();
    expect(status.isConnected).toBe(false);
  });

  it('reuses and restores an author-provided filter status element', () => {
    const root = renderMenu('data-menu-filterable="true"');
    const panel = root.querySelector<HTMLElement>('.a11y-menu-button__panel');
    if (!panel) throw new Error('Panel missing');
    const status = document.createElement('p');
    status.dataset.menuFilterStatus = '';
    status.setAttribute('role', 'log');
    status.setAttribute('aria-live', 'assertive');
    status.setAttribute('aria-atomic', 'false');
    status.hidden = true;
    status.textContent = 'Original status';
    panel.append(status);

    const controller = enhanceFilterableMenu(root, {
      announceResultCount: true,
    });
    if (!controller) throw new Error('Filter controller missing');
    expect(root.querySelector('[data-menu-filter-status]')).toBe(status);
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-atomic')).toBe('true');
    expect(status.hidden).toBe(false);
    expect(status.textContent).toBe('');

    controller.destroy();
    expect(status.getAttribute('role')).toBe('log');
    expect(status.getAttribute('aria-live')).toBe('assertive');
    expect(status.getAttribute('aria-atomic')).toBe('false');
    expect(status.hidden).toBe(true);
    expect(status.textContent).toBe('Original status');
  });

  it('renders async loading, empty, error, and ready states', () => {
    const root = renderMenu('data-menu-loading="true"');
    const events = vi.fn();
    root.addEventListener(MENU_BUTTON_EVENTS.asyncState, events);
    const controller = enhanceAsyncMenuState(root);
    expect((events.mock.calls[0]?.[0] as CustomEvent).detail).toMatchObject({
      root,
      state: 'loading',
      previousState: 'loading',
      controller,
      reason: 'initialization',
    });
    expect(events.mock.calls[0]?.[0]).toMatchObject({
      bubbles: true,
      composed: false,
      cancelable: false,
    });
    expect(controller.panel.getAttribute('aria-busy')).toBe('true');
    controller.setError({ message: 'Could not load actions.' });
    expect(controller.stateElement.getAttribute('role')).toBe('status');
    expect(controller.stateElement.getAttribute('aria-live')).toBe('polite');
    expect(controller.stateElement.textContent).toContain('Could not load actions.');
    controller.setReady();
    expect(controller.panel.getAttribute('aria-busy')).toBe('false');
    const emittedBeforeDestroy = events.mock.calls.length;
    controller.destroy();
    controller.setLoading();
    expect(events).toHaveBeenCalledTimes(emittedBeforeDestroy);
    expect(controller.stateElement.isConnected).toBe(false);
  });

  it('restores author-owned async state and item metadata on destroy', () => {
    const root = renderMenu('data-menu-loading="true"');
    const panel = root.querySelector<HTMLElement>('.a11y-menu-button__panel');
    const item = root.querySelector<HTMLElement>('.a11y-menu-button__item');
    if (!panel || !item) throw new Error('Async fixture missing');
    item.dataset.menuAsyncWasHidden = 'author-owned';
    const state = document.createElement('div');
    state.className = 'a11y-menu-button__async-state';
    state.setAttribute('role', 'log');
    state.setAttribute('aria-live', 'assertive');
    state.setAttribute('aria-atomic', 'false');
    state.dataset.menuAsyncState = 'author-state';
    state.hidden = true;
    const originalChild = document.createElement('strong');
    originalChild.textContent = 'Original message';
    state.append(originalChild);
    panel.prepend(state);

    const controller = enhanceAsyncMenuState(root);
    expect(item.hidden).toBe(true);
    expect(item.dataset.menuAsyncWasHidden).toBe('author-owned');
    expect(state.getAttribute('role')).toBe('status');

    controller.destroy();
    expect(item.hidden).toBe(false);
    expect(item.dataset.menuAsyncWasHidden).toBe('author-owned');
    expect(state.getAttribute('role')).toBe('log');
    expect(state.getAttribute('aria-live')).toBe('assertive');
    expect(state.getAttribute('aria-atomic')).toBe('false');
    expect(state.dataset.menuAsyncState).toBe('author-state');
    expect(state.hidden).toBe(true);
    expect(state.firstChild).toBe(originalChild);
    expect(state.textContent).toBe('Original message');
  });

  it('enhances and fully restores command and rich item DOM', () => {
    const root = renderMenu('data-command-menu="true"');
    const firstItem = root.querySelector<HTMLElement>('.a11y-menu-button__item');
    if (!firstItem) throw new Error('Item missing');
    firstItem.dataset.commandGroup = 'Project';
    firstItem.dataset.commandDescription = 'Move this project to the archive';
    const original = firstItem.innerHTML;
    const command = enhanceCommandMenu(root);
    expect(firstItem.querySelector('.a11y-menu-button__command-description')).not.toBeNull();
    command?.destroy();
    expect(firstItem.innerHTML).toBe(original);

    firstItem.dataset.menuDescription = 'A saved action';
    const rich = enhanceRichMenuItems(root);
    expect(firstItem.classList.contains('a11y-menu-button__item--rich')).toBe(true);
    rich.destroy();
    expect(firstItem.innerHTML).toBe(original);
  });

  it('announces feedback and removes generated live regions', async () => {
    vi.useFakeTimers();
    const root = renderMenu();
    const item = root.querySelector<HTMLElement>('.a11y-menu-button__item');
    if (!item) throw new Error('Item missing');
    item.dataset.menuFeedback = 'Archived';
    const feedback = attachMenuFeedback(root, { duration: 50 });
    const menu = createMenuButton(root, { observeVisibility: false });
    menu.open();
    item.click();
    await vi.advanceTimersByTimeAsync(20);
    expect(feedback.region.textContent).toBe('Archived');
    await vi.advanceTimersByTimeAsync(50);
    expect(feedback.region.textContent).toBe('');
    feedback.destroy();
    expect(feedback.region.isConnected).toBe(false);
  });

  it('restores an author-owned feedback region on destroy', async () => {
    vi.useFakeTimers();
    const root = renderMenu();
    const item = root.querySelector<HTMLElement>('.a11y-menu-button__item');
    if (!item) throw new Error('Item missing');
    item.dataset.menuFeedback = 'Archived';
    const region = document.createElement('span');
    region.className =
      'a11y-menu-button__feedback a11y-menu-button__feedback--visible';
    region.textContent = 'Original feedback';
    root.append(region);
    const feedback = attachMenuFeedback(root, { region, duration: 0 });
    const menu = createMenuButton(root, { observeVisibility: false });

    menu.open();
    item.click();
    await vi.advanceTimersByTimeAsync(20);
    expect(region.textContent).toBe('Archived');
    feedback.destroy();
    expect(region.textContent).toBe('Original feedback');
    expect(
      region.classList.contains('a11y-menu-button__feedback--visible'),
    ).toBe(true);
  });

  it('tracks recent action ids only when configured and cleans up clones', () => {
    const root = renderMenu('data-menu-recent="true"');
    const item = root.querySelector<HTMLElement>('.a11y-menu-button__item');
    if (!item) throw new Error('Item missing');
    item.dataset.menuActionId = 'archive';
    const recent = enhanceRecentActions(root);
    const menu = createMenuButton(root, { observeVisibility: false });
    menu.open();
    item.click();
    expect(recent?.recentIds).toEqual(['archive']);
    expect(root.querySelector('[data-menu-recent-clone]')).not.toBeNull();
    recent?.destroy();
    expect(root.querySelector('[data-menu-recent-clone]')).toBeNull();
  });

  it('recovers from malformed and unavailable opt-in storage', () => {
    window.localStorage.setItem('recent-actions-test', '{not-json');
    const recentRoot = renderMenu('data-menu-recent="true"');
    const item =
      recentRoot.querySelector<HTMLElement>('.a11y-menu-button__item');
    if (!item) throw new Error('Item missing');
    item.dataset.menuActionId = 'archive';
    const recent = enhanceRecentActions(recentRoot, {
      persist: true,
      storageKey: 'recent-actions-test',
    });
    expect(recent?.recentIds).toEqual([]);

    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'SecurityError');
    });
    const menu = createMenuButton(recentRoot, { observeVisibility: false });
    menu.open();
    expect(() => item.click()).not.toThrow();
    expect(recent?.recentIds).toEqual(['archive']);
    recent?.destroy();

    const hintsRoot = renderMenu('data-menu-hints="true"');
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'SecurityError');
    });
    expect(() => {
      const hints = attachMenuHints(hintsRoot, {
        persist: true,
        storageKey: 'menu-hints-test',
      });
      hints?.clearDismissal();
      hints?.destroy();
    }).not.toThrow();
  });

  it('shows and dismisses keyboard hints without announcements', async () => {
    vi.useFakeTimers();
    const root = renderMenu('data-menu-hints="true"');
    const hints = attachMenuHints(root, { timeout: 0 });
    const menu = createMenuButton(root, { observeVisibility: false });
    menu.open();
    await vi.advanceTimersByTimeAsync(1);
    expect(hints?.hint.hidden).toBe(false);
    expect(hints?.hint.getAttribute('aria-hidden')).toBe('true');
    keyboard(menu.panel, 'ArrowDown');
    expect(hints?.hint.hidden).toBe(true);
    hints?.destroy();
  });

  it('restores an author-owned hint element on destroy', async () => {
    vi.useFakeTimers();
    const root = renderMenu('data-menu-hints="true"');
    const panel = root.querySelector<HTMLElement>('.a11y-menu-button__panel');
    if (!panel) throw new Error('Panel missing');
    const hint = document.createElement('div');
    hint.className =
      'a11y-menu-button__hint a11y-menu-button__hint--visible';
    hint.hidden = false;
    panel.prepend(hint);
    const hints = attachMenuHints(root, { hint, timeout: 0 });
    const menu = createMenuButton(root, { observeVisibility: false });

    menu.open();
    await vi.advanceTimersByTimeAsync(1);
    hints?.hide();
    expect(hint.hidden).toBe(true);
    hints?.destroy();
    expect(hint.hidden).toBe(false);
    expect(
      hint.classList.contains('a11y-menu-button__hint--visible'),
    ).toBe(true);
    expect(hint.parentNode).toBe(panel);
  });
});
