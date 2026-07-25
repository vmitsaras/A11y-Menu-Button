export type MenuButtonPlacement =
  | 'bottom-start'
  | 'bottom-end'
  | 'top-start'
  | 'top-end';

export type MenuButtonReason =
  | 'trigger'
  | 'keyboard'
  | 'escape'
  | 'outside-pointer'
  | 'focusout'
  | 'item-click'
  | 'programmatic'
  | 'visibility-change';

export interface A11yMenuButtonOptions {
  closeOnEscape?: boolean;
  closeOnOutsidePointer?: boolean;
  closeOnFocusOut?: boolean;
  closeOnItemClick?: boolean;
  focusFirstOnOpen?: boolean;
  returnFocusOnEscape?: boolean;
  matchTriggerWidth?: boolean;
  placement?: MenuButtonPlacement;
  flipOnOverflow?: boolean;
  maxPanelHeight?: boolean;
  observeVisibility?: boolean;
  typeahead?: boolean;
  typeaheadTimeout?: number;
}

export interface MenuButtonActionOptions {
  reason?: MenuButtonReason;
}

export interface MenuButtonCloseOptions extends MenuButtonActionOptions {
  returnFocus?: boolean;
}

export interface MenuButtonEventDetail {
  instance: A11yMenuButton;
  open: boolean;
  previousOpen: boolean;
  nextOpen: boolean;
  trigger: HTMLButtonElement;
  panel: HTMLElement;
  item: HTMLElement | null;
  reason: MenuButtonReason;
}

export interface A11yMenuButtonInstance {
  readonly root: HTMLElement;
  readonly trigger: HTMLButtonElement;
  readonly panel: HTMLElement;
  readonly options: Readonly<Required<A11yMenuButtonOptions>>;
  isOpen(): boolean;
  open(options?: MenuButtonActionOptions): void;
  close(options?: MenuButtonCloseOptions): void;
  toggle(options?: MenuButtonCloseOptions): void;
  refresh(): void;
  updatePlacement(): void;
  destroy(): void;
}

type EventDetailOverrides = Partial<
  Pick<
    MenuButtonEventDetail,
    'open' | 'previousOpen' | 'nextOpen' | 'item' | 'reason'
  >
>;

interface AttributeSnapshot {
  exists: boolean;
  value: string | null;
}

interface InitialDomState {
  rootState: AttributeSnapshot;
  rootPlacement: AttributeSnapshot;
  rootMatchWidth: AttributeSnapshot;
  rootWasOpen: boolean;
  panelMaxHeight: string;
  triggerWidth: string;
  triggerId: AttributeSnapshot;
  triggerType: AttributeSnapshot;
  triggerControls: AttributeSnapshot;
  triggerExpanded: AttributeSnapshot;
  panelId: AttributeSnapshot;
  panelLabelledBy: AttributeSnapshot;
  panelHidden: boolean;
}

let idCounter = 0;

const COMPONENT_NAME = 'a11y-menu-button';
const DEFAULT_OFFSET = 8;
const PANEL_HEIGHT_TOLERANCE = 1;

const DEFAULT_OPTIONS: Readonly<Required<A11yMenuButtonOptions>> = Object.freeze({
  closeOnEscape: true,
  closeOnOutsidePointer: true,
  closeOnFocusOut: true,
  closeOnItemClick: false,
  focusFirstOnOpen: false,
  returnFocusOnEscape: true,
  matchTriggerWidth: false,
  placement: 'bottom-end',
  flipOnOverflow: true,
  maxPanelHeight: true,
  observeVisibility: true,
  typeahead: true,
  typeaheadTimeout: 700,
});

const SELECTORS = Object.freeze({
  root: '[data-a11y-menu-button]',
  trigger:
    ':scope > .a11y-menu-button__trigger, :scope > button[aria-controls]',
  panel: ':scope > .a11y-menu-button__panel, :scope > [id]',
  item: '[data-menu-close], .a11y-menu-button__item',
  focusable: [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', '),
  hidden: '[hidden], [aria-hidden="true"], [inert]',
});

const CLASSES = Object.freeze({
  open: 'is-open',
});

const ATTRIBUTES = Object.freeze({
  controls: 'aria-controls',
  expanded: 'aria-expanded',
  labelledBy: 'aria-labelledby',
  hidden: 'hidden',
});

const PLACEMENTS = new Set<MenuButtonPlacement>([
  'bottom-start',
  'bottom-end',
  'top-start',
  'top-end',
]);

function snapshotAttribute(element: Element, name: string): AttributeSnapshot {
  return {
    exists: element.hasAttribute(name),
    value: element.getAttribute(name),
  };
}

function restoreAttribute(
  element: Element,
  name: string,
  snapshot: AttributeSnapshot,
): void {
  if (snapshot.exists) {
    element.setAttribute(name, snapshot.value ?? '');
  } else {
    element.removeAttribute(name);
  }
}

function toSafeBoolean(
  value: boolean | string | undefined,
  fallback: boolean,
): boolean {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
}

function toSafeInteger(
  value: number | string | undefined,
  fallback: number,
  options: { min?: number; max?: number } = {},
): number {
  const parsed =
    typeof value === 'number' ? value : Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed)) return fallback;
  if (options.min !== undefined && parsed < options.min) return fallback;
  if (options.max !== undefined && parsed > options.max) return fallback;
  return parsed;
}

function toSafePlacement(
  value: string | undefined,
  fallback: MenuButtonPlacement,
): MenuButtonPlacement {
  return PLACEMENTS.has(value as MenuButtonPlacement)
    ? (value as MenuButtonPlacement)
    : fallback;
}

function normalizeOptions(
  root: HTMLElement,
  options: A11yMenuButtonOptions,
): Readonly<Required<A11yMenuButtonOptions>> {
  const dataset = root.dataset;

  return Object.freeze({
    closeOnEscape: toSafeBoolean(
      options.closeOnEscape ?? dataset.closeOnEscape,
      DEFAULT_OPTIONS.closeOnEscape,
    ),
    closeOnOutsidePointer: toSafeBoolean(
      options.closeOnOutsidePointer ?? dataset.closeOnOutsidePointer,
      DEFAULT_OPTIONS.closeOnOutsidePointer,
    ),
    closeOnFocusOut: toSafeBoolean(
      options.closeOnFocusOut ?? dataset.closeOnFocusOut,
      DEFAULT_OPTIONS.closeOnFocusOut,
    ),
    closeOnItemClick: toSafeBoolean(
      options.closeOnItemClick ?? dataset.closeOnItemClick,
      DEFAULT_OPTIONS.closeOnItemClick,
    ),
    focusFirstOnOpen: toSafeBoolean(
      options.focusFirstOnOpen ?? dataset.focusFirstOnOpen,
      DEFAULT_OPTIONS.focusFirstOnOpen,
    ),
    returnFocusOnEscape: toSafeBoolean(
      options.returnFocusOnEscape ?? dataset.returnFocusOnEscape,
      DEFAULT_OPTIONS.returnFocusOnEscape,
    ),
    matchTriggerWidth: toSafeBoolean(
      options.matchTriggerWidth ?? dataset.matchWidth,
      DEFAULT_OPTIONS.matchTriggerWidth,
    ),
    placement: toSafePlacement(
      options.placement ?? dataset.placement,
      DEFAULT_OPTIONS.placement,
    ),
    flipOnOverflow: toSafeBoolean(
      options.flipOnOverflow ?? dataset.flipOnOverflow,
      DEFAULT_OPTIONS.flipOnOverflow,
    ),
    maxPanelHeight: toSafeBoolean(
      options.maxPanelHeight ?? dataset.maxPanelHeight,
      DEFAULT_OPTIONS.maxPanelHeight,
    ),
    observeVisibility: toSafeBoolean(
      options.observeVisibility ?? dataset.observeVisibility,
      DEFAULT_OPTIONS.observeVisibility,
    ),
    typeahead: toSafeBoolean(
      options.typeahead ?? dataset.typeahead,
      DEFAULT_OPTIONS.typeahead,
    ),
    typeaheadTimeout: toSafeInteger(
      options.typeaheadTimeout ?? dataset.typeaheadTimeout,
      DEFAULT_OPTIONS.typeaheadTimeout,
      { min: 0 },
    ),
  });
}

export class A11yMenuButton implements A11yMenuButtonInstance {
  private static readonly instances = new WeakMap<HTMLElement, A11yMenuButton>();

  public readonly root!: HTMLElement;
  public readonly options!: Readonly<Required<A11yMenuButtonOptions>>;
  public trigger!: HTMLButtonElement;
  public panel!: HTMLElement;

  private placementFrame: number | null = null;
  private focusoutFrame: number | null = null;
  private pointerInteractionTimer: number | null = null;
  private visibilityObserver: IntersectionObserver | null = null;
  private typeaheadQuery = '';
  private typeaheadTimer: number | null = null;
  private pointerInteractionStartedInside = false;
  private documentListenersAttached = false;
  private layoutListenersAttached = false;
  private transition: 'opening' | 'closing' | null = null;
  private refreshing = false;
  private destroyed = false;
  private initialState!: InitialDomState;

  private readonly handleTriggerClick!: (event: MouseEvent) => void;
  private readonly handleKeydown!: (event: KeyboardEvent) => void;
  private readonly handlePointerdown!: (event: PointerEvent) => void;
  private readonly handlePointerend!: (event: PointerEvent) => void;
  private readonly handleFocusout!: (event: FocusEvent) => void;
  private readonly handleItemClick!: (event: MouseEvent) => void;
  private readonly handleLayoutChange!: () => void;
  private readonly handleAsyncStateChange!: () => void;

  public constructor(root: HTMLElement, options: A11yMenuButtonOptions = {}) {
    if (!(root instanceof HTMLElement)) {
      throw new TypeError('A11yMenuButton: root must be an HTMLElement');
    }

    const existingInstance = A11yMenuButton.instances.get(root);
    if (existingInstance) return existingInstance;

    this.root = root;
    this.options = normalizeOptions(root, options);
    this.handleTriggerClick = this.onTriggerClick.bind(this);
    this.handleKeydown = this.onKeydown.bind(this);
    this.handlePointerdown = this.onPointerdown.bind(this);
    this.handlePointerend = this.onPointerend.bind(this);
    this.handleFocusout = this.onFocusout.bind(this);
    this.handleItemClick = this.onItemClick.bind(this);
    this.handleLayoutChange = this.onLayoutChange.bind(this);
    this.handleAsyncStateChange = this.onAsyncStateChange.bind(this);

    this.queryElements();
    this.initialState = this.captureInitialState();
    A11yMenuButton.instances.set(root, this);

    try {
      this.initialize();
    } catch (error) {
      A11yMenuButton.instances.delete(root);
      throw error;
    }
  }

  private initialize(): void {
    this.setInitialState();
    this.attachTriggerListeners();

    if (this.isOpen()) {
      this.updatePlacement();
      this.attachDocumentListeners();
      this.attachLayoutListeners();
    }

    this.setupVisibilityObserver();
    this.dispatch(MENU_BUTTON_EVENTS.init, {
      ...this.createEventDetail(),
      item: null,
      reason: 'programmatic',
    });
  }

  private queryElements(): void {
    const trigger = this.root.querySelector(SELECTORS.trigger);
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('A11yMenuButton: a direct-child button trigger is required');
    }

    const panelId = trigger.getAttribute(ATTRIBUTES.controls);
    const controlledPanel = panelId ? document.getElementById(panelId) : null;
    const fallbackPanel = this.root.querySelector(SELECTORS.panel);
    const panel = controlledPanel ?? fallbackPanel;

    if (!(panel instanceof HTMLElement)) {
      throw new Error(
        'A11yMenuButton: no panel found; use aria-controls or a direct-child panel with an id',
      );
    }

    this.trigger = trigger;
    this.panel = panel;
  }

  private captureInitialState(): InitialDomState {
    return {
      rootState: snapshotAttribute(this.root, 'data-state'),
      rootPlacement: snapshotAttribute(this.root, 'data-placement'),
      rootMatchWidth: snapshotAttribute(this.root, 'data-match-width'),
      rootWasOpen: this.root.classList.contains(CLASSES.open),
      panelMaxHeight: this.root.style.getPropertyValue('--_panel-max-height'),
      triggerWidth: this.root.style.getPropertyValue('--_trigger-width'),
      triggerId: snapshotAttribute(this.trigger, 'id'),
      triggerType: snapshotAttribute(this.trigger, 'type'),
      triggerControls: snapshotAttribute(this.trigger, ATTRIBUTES.controls),
      triggerExpanded: snapshotAttribute(this.trigger, ATTRIBUTES.expanded),
      panelId: snapshotAttribute(this.panel, 'id'),
      panelLabelledBy: snapshotAttribute(this.panel, ATTRIBUTES.labelledBy),
      panelHidden: this.panel.hasAttribute(ATTRIBUTES.hidden),
    };
  }

  private setInitialState(): void {
    if (!this.panel.id) this.panel.id = `${COMPONENT_NAME}-panel-${++idCounter}`;
    if (!this.trigger.id) this.trigger.id = `${COMPONENT_NAME}-trigger-${++idCounter}`;
    if (!this.trigger.getAttribute('type')) this.trigger.type = 'button';

    this.trigger.setAttribute(ATTRIBUTES.controls, this.panel.id);
    this.panel.setAttribute(ATTRIBUTES.labelledBy, this.trigger.id);

    const open = !this.panel.hasAttribute(ATTRIBUTES.hidden);
    this.trigger.setAttribute(ATTRIBUTES.expanded, String(open));
    this.root.dataset.state = open ? 'open' : 'closed';
    this.root.classList.toggle(CLASSES.open, open);

    if (!this.root.dataset.placement) {
      this.root.dataset.placement = this.options.placement;
    }
  }

  private attachTriggerListeners(): void {
    this.trigger.addEventListener('click', this.handleTriggerClick);
    this.root.addEventListener('keydown', this.handleKeydown);
    this.root.addEventListener(
      MENU_BUTTON_EVENTS.asyncState,
      this.handleAsyncStateChange,
    );
  }

  private detachTriggerListeners(): void {
    this.trigger.removeEventListener('click', this.handleTriggerClick);
    this.root.removeEventListener('keydown', this.handleKeydown);
    this.root.removeEventListener(
      MENU_BUTTON_EVENTS.asyncState,
      this.handleAsyncStateChange,
    );
  }

  private attachDocumentListeners(): void {
    if (this.documentListenersAttached) return;

    if (this.options.closeOnOutsidePointer || this.options.closeOnFocusOut) {
      document.addEventListener('pointerdown', this.handlePointerdown);
      document.addEventListener('pointerup', this.handlePointerend);
      document.addEventListener('pointercancel', this.handlePointerend);
    }
    if (this.options.closeOnFocusOut) {
      this.root.addEventListener('focusout', this.handleFocusout);
      if (!this.root.contains(this.panel)) {
        this.panel.addEventListener('focusout', this.handleFocusout);
      }
    }
    this.panel.addEventListener('click', this.handleItemClick);
    this.documentListenersAttached = true;
  }

  private detachDocumentListeners(): void {
    document.removeEventListener('pointerdown', this.handlePointerdown);
    document.removeEventListener('pointerup', this.handlePointerend);
    document.removeEventListener('pointercancel', this.handlePointerend);
    this.root.removeEventListener('focusout', this.handleFocusout);
    this.panel.removeEventListener('focusout', this.handleFocusout);
    this.panel.removeEventListener('click', this.handleItemClick);
    this.pointerInteractionStartedInside = false;
    this.documentListenersAttached = false;
  }

  private attachLayoutListeners(): void {
    if (this.layoutListenersAttached) return;
    window.addEventListener('resize', this.handleLayoutChange);
    window.addEventListener('scroll', this.handleLayoutChange, {
      passive: true,
      capture: true,
    });
    this.layoutListenersAttached = true;
  }

  private detachLayoutListeners(): void {
    window.removeEventListener('resize', this.handleLayoutChange);
    window.removeEventListener('scroll', this.handleLayoutChange, true);
    this.layoutListenersAttached = false;
  }

  private onTriggerClick(): void {
    this.toggle({ reason: 'trigger' });
  }

  private onKeydown(event: KeyboardEvent): void {
    const isTriggerEvent = event.target === this.trigger;
    const isPanelEvent =
      event.target instanceof Node && this.panel.contains(event.target);

    if (event.key === 'Escape' && this.isOpen()) {
      if (this.options.closeOnEscape) {
        event.preventDefault();
        this.close({
          returnFocus: this.options.returnFocusOnEscape,
          reason: 'escape',
        });
      }
      return;
    }

    if (isTriggerEvent && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      this.open({ reason: 'keyboard' });
      this.focusMenuItem(event.key === 'ArrowUp' ? 'last' : 'first');
      return;
    }

    if (!this.isOpen() || !isPanelEvent) return;
    if (this.handleTypeahead(event)) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusAdjacentItem(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      this.focusMenuItem(event.key === 'Home' ? 'first' : 'last');
    }
  }

  private onPointerdown(event: PointerEvent): void {
    const startedInside =
      event.target instanceof Node && this.containsMenuTarget(event.target);
    this.pointerInteractionStartedInside = startedInside;

    if (startedInside) {
      if (this.pointerInteractionTimer !== null) {
        window.clearTimeout(this.pointerInteractionTimer);
        this.pointerInteractionTimer = null;
      }
      if (this.focusoutFrame !== null) {
        cancelAnimationFrame(this.focusoutFrame);
        this.focusoutFrame = null;
      }
      return;
    }

    if (this.options.closeOnOutsidePointer) {
      this.close({ returnFocus: false, reason: 'outside-pointer' });
    }
  }

  private onPointerend(): void {
    if (!this.pointerInteractionStartedInside) return;
    if (this.pointerInteractionTimer !== null) {
      window.clearTimeout(this.pointerInteractionTimer);
    }
    this.pointerInteractionTimer = window.setTimeout(() => {
      this.pointerInteractionStartedInside = false;
      this.pointerInteractionTimer = null;
    }, 0);
  }

  private onFocusout(event: FocusEvent): void {
    if (!this.isOpen()) return;
    if (
      event.relatedTarget instanceof Node &&
      this.containsMenuTarget(event.relatedTarget)
    ) {
      return;
    }
    if (this.pointerInteractionStartedInside) return;

    if (this.focusoutFrame !== null) cancelAnimationFrame(this.focusoutFrame);
    this.focusoutFrame = requestAnimationFrame(() => {
      this.focusoutFrame = null;
      const activeElement = document.activeElement;
      if (
        activeElement instanceof Node &&
        this.containsMenuTarget(activeElement)
      ) {
        return;
      }
      this.close({ returnFocus: false, reason: 'focusout' });
    });
  }

  private onItemClick(event: MouseEvent): void {
    if (!(event.target instanceof Element)) return;
    const item = event.target.closest(SELECTORS.item);
    if (
      !(item instanceof HTMLElement) ||
      !this.panel.contains(item) ||
      this.isDisabledItem(item)
    ) {
      return;
    }

    this.dispatch(MENU_BUTTON_EVENTS.itemClick, {
      ...this.createEventDetail(),
      item,
      reason: 'item-click',
    });

    if (item.hasAttribute('data-menu-close') || this.options.closeOnItemClick) {
      const returnFocus = this.panel.contains(document.activeElement);
      this.closeWithFocusGuard(
        { returnFocus, reason: 'item-click' },
        () => this.panel.contains(document.activeElement),
      );
    }
  }

  private onLayoutChange(): void {
    this.schedulePlacementUpdate();
  }

  private onAsyncStateChange(): void {
    if (this.isOpen()) this.schedulePlacementUpdate();
  }

  private containsMenuTarget(target: Node): boolean {
    return this.root.contains(target) || this.panel.contains(target);
  }

  private getFocusableItems(): HTMLElement[] {
    return Array.from(this.panel.querySelectorAll(SELECTORS.focusable)).filter(
      (item): item is HTMLElement => {
        if (!(item instanceof HTMLElement)) return false;
        const hidden = item.closest(SELECTORS.hidden) || item.offsetParent === null;
        return !this.isDisabledItem(item) && !hidden;
      },
    );
  }

  private focusMenuItem(position: 'first' | 'last'): void {
    const items = this.getFocusableItems();
    const item = position === 'last' ? items.at(-1) : items[0];
    item?.focus();
  }

  private isDisabledItem(item: HTMLElement): boolean {
    return item.hasAttribute('disabled') || item.getAttribute('aria-disabled') === 'true';
  }

  private getAssociatedLabelText(item: HTMLElement): string {
    const labels =
      item instanceof HTMLButtonElement ||
      item instanceof HTMLInputElement ||
      item instanceof HTMLSelectElement ||
      item instanceof HTMLTextAreaElement
        ? item.labels
        : null;
    return Array.from(labels ?? [], (label) => label.textContent || '').join(' ');
  }

  private getAriaLabelledbyText(item: HTMLElement): string {
    return (item.getAttribute('aria-labelledby') || '')
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => item.ownerDocument.getElementById(id)?.textContent || '')
      .join(' ');
  }

  private getItemText(item: HTMLElement): string {
    const inputValue =
      item instanceof HTMLInputElement &&
      ['button', 'image', 'reset', 'submit'].includes(item.type)
        ? item.value
        : '';
    return (
      item.getAttribute('data-menu-label') ||
      this.getAriaLabelledbyText(item) ||
      item.getAttribute('aria-label') ||
      this.getAssociatedLabelText(item) ||
      inputValue ||
      item.textContent ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim()
      .toLocaleLowerCase();
  }

  private isEditableTypeaheadTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
      return true;
    }
    if (!(target instanceof HTMLInputElement)) return false;
    return !['button', 'checkbox', 'image', 'radio', 'reset', 'submit'].includes(
      target.type,
    );
  }

  private handleTypeahead(event: KeyboardEvent): boolean {
    if (
      !this.options.typeahead ||
      this.isEditableTypeaheadTarget(event.target) ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.key.length !== 1 ||
      event.key.trim() === ''
    ) {
      return false;
    }

    const items = this.getFocusableItems();
    if (!items.length) return false;
    event.preventDefault();

    if (this.typeaheadTimer !== null) window.clearTimeout(this.typeaheadTimer);
    const character = event.key.toLocaleLowerCase();
    const repeating =
      this.typeaheadQuery.length > 0 &&
      [...this.typeaheadQuery].every((value) => value === character);
    this.typeaheadQuery = repeating
      ? character
      : `${this.typeaheadQuery}${character}`;

    const activeIndex = items.indexOf(document.activeElement as HTMLElement);
    const start = activeIndex === -1 ? 0 : activeIndex + 1;
    const ordered = [...items.slice(start), ...items.slice(0, start)];
    ordered
      .find((item) => this.getItemText(item).startsWith(this.typeaheadQuery))
      ?.focus();

    this.typeaheadTimer = window.setTimeout(() => {
      this.typeaheadQuery = '';
      this.typeaheadTimer = null;
    }, this.options.typeaheadTimeout);
    return true;
  }

  private focusAdjacentItem(direction: 1 | -1): void {
    const items = this.getFocusableItems();
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next =
      current === -1
        ? direction > 0
          ? 0
          : items.length - 1
        : (current + direction + items.length) % items.length;
    items[next]?.focus();
  }

  private getOffset(): number {
    const raw = getComputedStyle(this.root)
      .getPropertyValue('--_panel-offset')
      .trim();
    if (!raw || raw === 'none') return DEFAULT_OFFSET;
    const parsed = Number.parseFloat(raw);
    if (Number.isNaN(parsed)) return DEFAULT_OFFSET;
    if (raw.endsWith('rem')) {
      const rootFontSize = Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      return parsed * rootFontSize;
    }
    return parsed;
  }

  public updatePlacement(): void {
    if (this.destroyed) return;
    const triggerRect = this.trigger.getBoundingClientRect();
    const offset = this.getOffset();
    const spaceBelow = window.innerHeight - triggerRect.bottom - offset;
    const spaceAbove = triggerRect.top - offset;
    const align = this.options.placement.endsWith('start') ? 'start' : 'end';
    const panelBlockChrome = Math.max(
      0,
      this.panel.offsetHeight - this.panel.clientHeight,
    );
    const panelHeight = this.panel.scrollHeight + panelBlockChrome;
    let side: 'top' | 'bottom' = this.options.placement.startsWith('top')
      ? 'top'
      : 'bottom';

    if (this.options.flipOnOverflow) {
      const fitsBelow = panelHeight <= spaceBelow;
      const fitsAbove = panelHeight <= spaceAbove;
      if (side === 'bottom' && !fitsBelow && fitsAbove) side = 'top';
      else if (side === 'top' && !fitsAbove && fitsBelow) side = 'bottom';
      else if (!fitsBelow && !fitsAbove) {
        side = spaceAbove > spaceBelow ? 'top' : 'bottom';
      }
    }

    const availableSpace = side === 'top' ? spaceAbove : spaceBelow;
    this.root.dataset.placement = `${side}-${align}`;
    if (this.options.maxPanelHeight) {
      const maxHeight = Math.min(
        Math.max(0, availableSpace),
        panelHeight + PANEL_HEIGHT_TOLERANCE,
      );
      this.root.style.setProperty('--_panel-max-height', `${maxHeight}px`);
    } else {
      this.root.style.removeProperty('--_panel-max-height');
    }
  }

  private schedulePlacementUpdate(): void {
    if (this.placementFrame !== null) return;
    this.placementFrame = requestAnimationFrame(() => {
      this.placementFrame = null;
      if (this.isOpen()) this.updatePlacement();
    });
  }

  private clearFramesAndTimer(): void {
    if (this.placementFrame !== null) cancelAnimationFrame(this.placementFrame);
    if (this.focusoutFrame !== null) cancelAnimationFrame(this.focusoutFrame);
    if (this.pointerInteractionTimer !== null) {
      window.clearTimeout(this.pointerInteractionTimer);
    }
    if (this.typeaheadTimer !== null) window.clearTimeout(this.typeaheadTimer);
    this.placementFrame = null;
    this.focusoutFrame = null;
    this.pointerInteractionTimer = null;
    this.pointerInteractionStartedInside = false;
    this.typeaheadTimer = null;
    this.typeaheadQuery = '';
  }

  private setupVisibilityObserver(): void {
    if (!this.options.observeVisibility || !('IntersectionObserver' in window)) {
      return;
    }
    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      if (!entry.isIntersecting && this.isOpen()) {
        this.close({ returnFocus: false, reason: 'visibility-change' });
      } else if (entry.isIntersecting && this.isOpen()) {
        this.refresh();
      }
    });
    this.visibilityObserver.observe(this.root);
  }

  private createEventDetail(
    overrides: EventDetailOverrides = {},
  ): MenuButtonEventDetail {
    const open = this.isOpen();
    return {
      instance: this,
      open,
      previousOpen: open,
      nextOpen: open,
      trigger: this.trigger,
      panel: this.panel,
      item: null,
      reason: 'programmatic',
      ...overrides,
    };
  }

  private dispatch<Type extends MenuButtonEventName>(
    type: Type,
    detail: MenuButtonEventMap[Type],
  ): MenuButtonCustomEvent<Type> {
    return dispatchMenuButtonEvent(this.root, type, detail);
  }

  public isOpen(): boolean {
    return !this.panel.hasAttribute(ATTRIBUTES.hidden);
  }

  public open(options: MenuButtonActionOptions = {}): void {
    if (this.destroyed || this.isOpen() || this.transition !== null) return;
    const reason = options.reason ?? 'programmatic';
    let opened = false;
    this.transition = 'opening';
    try {
      const detail = {
        ...this.createEventDetail({
          open: true,
          previousOpen: false,
          nextOpen: true,
          reason,
        }),
        open: true as const,
        previousOpen: false as const,
        nextOpen: true as const,
        item: null,
      };
      const before = this.dispatch(MENU_BUTTON_EVENTS.beforeOpen, detail);
      if (before.defaultPrevented || this.destroyed) return;

      this.panel.removeAttribute(ATTRIBUTES.hidden);
      this.trigger.setAttribute(ATTRIBUTES.expanded, 'true');
      this.root.dataset.state = 'open';
      this.root.classList.add(CLASSES.open);

      if (this.options.matchTriggerWidth) {
        this.root.style.setProperty('--_trigger-width', `${this.trigger.offsetWidth}px`);
        this.root.dataset.matchWidth = 'true';
      }

      this.updatePlacement();
      this.attachDocumentListeners();
      this.attachLayoutListeners();
      if (this.options.focusFirstOnOpen) this.focusMenuItem('first');
      opened = true;
    } finally {
      this.transition = null;
    }
    if (opened && !this.destroyed) {
      this.dispatch(MENU_BUTTON_EVENTS.open, {
        ...this.createEventDetail({
          open: true,
          previousOpen: false,
          nextOpen: true,
          reason,
        }),
        open: true,
        previousOpen: false,
        nextOpen: true,
        item: null,
      });
    }
  }

  private closeWithFocusGuard(
    options: MenuButtonCloseOptions,
    shouldReturnFocus: () => boolean = () => true,
  ): void {
    if (this.destroyed || !this.isOpen() || this.transition !== null) return;
    const reason = options.reason ?? 'programmatic';
    let closed = false;
    this.transition = 'closing';
    try {
      const detail = {
        ...this.createEventDetail({
          open: false,
          previousOpen: true,
          nextOpen: false,
          reason,
        }),
        open: false as const,
        previousOpen: true as const,
        nextOpen: false as const,
        item: null,
      };
      const before = this.dispatch(MENU_BUTTON_EVENTS.beforeClose, detail);
      if (before.defaultPrevented || this.destroyed) return;
      const returnFocus = options.returnFocus && shouldReturnFocus();

      this.panel.setAttribute(ATTRIBUTES.hidden, '');
      this.trigger.setAttribute(ATTRIBUTES.expanded, 'false');
      this.root.dataset.state = 'closed';
      this.root.classList.remove(CLASSES.open);
      this.detachDocumentListeners();
      this.detachLayoutListeners();
      this.clearFramesAndTimer();
      if (returnFocus) this.trigger.focus();
      closed = true;
    } finally {
      this.transition = null;
    }
    if (closed && !this.destroyed) {
      this.dispatch(MENU_BUTTON_EVENTS.close, {
        ...this.createEventDetail({
          open: false,
          previousOpen: true,
          nextOpen: false,
          reason,
        }),
        open: false,
        previousOpen: true,
        nextOpen: false,
        item: null,
      });
    }
  }

  public close(options: MenuButtonCloseOptions = {}): void {
    this.closeWithFocusGuard(options);
  }

  public toggle(options: MenuButtonCloseOptions = {}): void {
    if (this.isOpen()) this.close(options);
    else this.open(options);
  }

  public refresh(): void {
    if (this.destroyed || this.refreshing) return;
    this.refreshing = true;
    try {
      const previousTrigger = this.trigger;
      const previousPanel = this.panel;
      this.queryElements();
      if (this.trigger !== previousTrigger || this.panel !== previousPanel) {
        this.trigger = previousTrigger;
        this.panel = previousPanel;
        throw new Error(
          'A11yMenuButton: refresh cannot replace the trigger or panel; destroy and reinitialize the menu instead',
        );
      }
      if (this.options.matchTriggerWidth) {
        this.root.style.setProperty('--_trigger-width', `${this.trigger.offsetWidth}px`);
      }
      if (this.isOpen()) this.updatePlacement();
      this.dispatch(MENU_BUTTON_EVENTS.refresh, {
        ...this.createEventDetail(),
        item: null,
        reason: 'programmatic',
      });
    } finally {
      this.refreshing = false;
    }
  }

  private restoreInitialState(): void {
    const state = this.initialState;
    restoreAttribute(this.root, 'data-state', state.rootState);
    restoreAttribute(this.root, 'data-placement', state.rootPlacement);
    restoreAttribute(this.root, 'data-match-width', state.rootMatchWidth);
    this.root.classList.toggle(CLASSES.open, state.rootWasOpen);
    if (state.panelMaxHeight) {
      this.root.style.setProperty('--_panel-max-height', state.panelMaxHeight);
    } else {
      this.root.style.removeProperty('--_panel-max-height');
    }
    if (state.triggerWidth) {
      this.root.style.setProperty('--_trigger-width', state.triggerWidth);
    } else {
      this.root.style.removeProperty('--_trigger-width');
    }
    restoreAttribute(this.trigger, 'id', state.triggerId);
    restoreAttribute(this.trigger, 'type', state.triggerType);
    restoreAttribute(this.trigger, ATTRIBUTES.controls, state.triggerControls);
    restoreAttribute(this.trigger, ATTRIBUTES.expanded, state.triggerExpanded);
    restoreAttribute(this.panel, 'id', state.panelId);
    restoreAttribute(this.panel, ATTRIBUTES.labelledBy, state.panelLabelledBy);
    this.panel.toggleAttribute(ATTRIBUTES.hidden, state.panelHidden);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.detachTriggerListeners();
    this.detachDocumentListeners();
    this.detachLayoutListeners();
    this.clearFramesAndTimer();
    this.visibilityObserver?.disconnect();
    this.visibilityObserver = null;
    try {
      this.dispatch(MENU_BUTTON_EVENTS.destroy, {
        ...this.createEventDetail(),
        item: null,
      });
      this.restoreInitialState();
    } finally {
      A11yMenuButton.instances.delete(this.root);
    }
  }
}

export function createMenuButton(
  root: HTMLElement,
  options: A11yMenuButtonOptions = {},
): A11yMenuButton {
  return new A11yMenuButton(root, options);
}

export function initMenuButtons(
  root: ParentNode = document,
  options: A11yMenuButtonOptions = {},
): A11yMenuButton[] {
  const matchesRoot =
    root instanceof HTMLElement && root.matches(SELECTORS.root) ? [root] : [];
  const descendants = Array.from(root.querySelectorAll(SELECTORS.root)).filter(
    (element): element is HTMLElement => element instanceof HTMLElement,
  );
  return [...matchesRoot, ...descendants].map((element) =>
    createMenuButton(element, options),
  );
}
import {
  MENU_BUTTON_EVENTS,
  dispatchMenuButtonEvent,
  type MenuButtonCustomEvent,
  type MenuButtonEventMap,
  type MenuButtonEventName,
} from './events.js';
