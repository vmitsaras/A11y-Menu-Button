import { r as dispatchMenuButtonEvent, t as MENU_BUTTON_EVENTS } from "./events-Qrks-Ivi.js";
//#region src/A11yMenuButton.ts
let idCounter = 0;
const COMPONENT_NAME = "a11y-menu-button";
const DEFAULT_OFFSET = 8;
const PANEL_HEIGHT_TOLERANCE = 1;
const DEFAULT_OPTIONS = Object.freeze({
	closeOnEscape: true,
	closeOnOutsidePointer: true,
	closeOnFocusOut: true,
	closeOnItemClick: false,
	focusFirstOnOpen: false,
	returnFocusOnEscape: true,
	matchTriggerWidth: false,
	placement: "bottom-end",
	flipOnOverflow: true,
	maxPanelHeight: true,
	observeVisibility: true,
	typeahead: true,
	typeaheadTimeout: 700
});
const SELECTORS = Object.freeze({
	root: "[data-a11y-menu-button]",
	trigger: ":scope > .a11y-menu-button__trigger, :scope > button[aria-controls]",
	panel: ":scope > .a11y-menu-button__panel, :scope > [id]",
	item: "[data-menu-close], .a11y-menu-button__item",
	focusable: [
		"a[href]",
		"button:not([disabled])",
		"input:not([disabled])",
		"select:not([disabled])",
		"textarea:not([disabled])",
		"[tabindex]:not([tabindex=\"-1\"])"
	].join(", "),
	hidden: "[hidden], [aria-hidden=\"true\"], [inert]"
});
const CLASSES = Object.freeze({ open: "is-open" });
const ATTRIBUTES = Object.freeze({
	controls: "aria-controls",
	expanded: "aria-expanded",
	labelledBy: "aria-labelledby",
	hidden: "hidden"
});
const PLACEMENTS = /* @__PURE__ */ new Set([
	"bottom-start",
	"bottom-end",
	"top-start",
	"top-end"
]);
function snapshotAttribute(element, name) {
	return {
		exists: element.hasAttribute(name),
		value: element.getAttribute(name)
	};
}
function restoreAttribute(element, name, snapshot) {
	if (snapshot.exists) element.setAttribute(name, snapshot.value ?? "");
	else element.removeAttribute(name);
}
function toSafeBoolean(value, fallback) {
	if (value === true || value === "true") return true;
	if (value === false || value === "false") return false;
	return fallback;
}
function toSafeInteger(value, fallback, options = {}) {
	const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
	if (!Number.isFinite(parsed)) return fallback;
	if (options.min !== void 0 && parsed < options.min) return fallback;
	if (options.max !== void 0 && parsed > options.max) return fallback;
	return parsed;
}
function toSafePlacement(value, fallback) {
	return PLACEMENTS.has(value) ? value : fallback;
}
function normalizeOptions(root, options) {
	const dataset = root.dataset;
	return Object.freeze({
		closeOnEscape: toSafeBoolean(options.closeOnEscape ?? dataset.closeOnEscape, DEFAULT_OPTIONS.closeOnEscape),
		closeOnOutsidePointer: toSafeBoolean(options.closeOnOutsidePointer ?? dataset.closeOnOutsidePointer, DEFAULT_OPTIONS.closeOnOutsidePointer),
		closeOnFocusOut: toSafeBoolean(options.closeOnFocusOut ?? dataset.closeOnFocusOut, DEFAULT_OPTIONS.closeOnFocusOut),
		closeOnItemClick: toSafeBoolean(options.closeOnItemClick ?? dataset.closeOnItemClick, DEFAULT_OPTIONS.closeOnItemClick),
		focusFirstOnOpen: toSafeBoolean(options.focusFirstOnOpen ?? dataset.focusFirstOnOpen, DEFAULT_OPTIONS.focusFirstOnOpen),
		returnFocusOnEscape: toSafeBoolean(options.returnFocusOnEscape ?? dataset.returnFocusOnEscape, DEFAULT_OPTIONS.returnFocusOnEscape),
		matchTriggerWidth: toSafeBoolean(options.matchTriggerWidth ?? dataset.matchWidth, DEFAULT_OPTIONS.matchTriggerWidth),
		placement: toSafePlacement(options.placement ?? dataset.placement, DEFAULT_OPTIONS.placement),
		flipOnOverflow: toSafeBoolean(options.flipOnOverflow ?? dataset.flipOnOverflow, DEFAULT_OPTIONS.flipOnOverflow),
		maxPanelHeight: toSafeBoolean(options.maxPanelHeight ?? dataset.maxPanelHeight, DEFAULT_OPTIONS.maxPanelHeight),
		observeVisibility: toSafeBoolean(options.observeVisibility ?? dataset.observeVisibility, DEFAULT_OPTIONS.observeVisibility),
		typeahead: toSafeBoolean(options.typeahead ?? dataset.typeahead, DEFAULT_OPTIONS.typeahead),
		typeaheadTimeout: toSafeInteger(options.typeaheadTimeout ?? dataset.typeaheadTimeout, DEFAULT_OPTIONS.typeaheadTimeout, { min: 0 })
	});
}
var A11yMenuButton = class A11yMenuButton {
	static instances = /* @__PURE__ */ new WeakMap();
	root;
	options;
	trigger;
	panel;
	placementFrame = null;
	focusoutFrame = null;
	pointerInteractionTimer = null;
	visibilityObserver = null;
	typeaheadQuery = "";
	typeaheadTimer = null;
	pointerInteractionStartedInside = false;
	documentListenersAttached = false;
	layoutListenersAttached = false;
	transition = null;
	refreshing = false;
	destroyed = false;
	initialState;
	handleTriggerClick;
	handleKeydown;
	handlePointerdown;
	handlePointerend;
	handleFocusout;
	handleItemClick;
	handleLayoutChange;
	handleAsyncStateChange;
	constructor(root, options = {}) {
		if (!(root instanceof HTMLElement)) throw new TypeError("A11yMenuButton: root must be an HTMLElement");
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
	initialize() {
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
			reason: "programmatic"
		});
	}
	queryElements() {
		const trigger = this.root.querySelector(SELECTORS.trigger);
		if (!(trigger instanceof HTMLButtonElement)) throw new Error("A11yMenuButton: a direct-child button trigger is required");
		const panelId = trigger.getAttribute(ATTRIBUTES.controls);
		const controlledPanel = panelId ? document.getElementById(panelId) : null;
		const fallbackPanel = this.root.querySelector(SELECTORS.panel);
		const panel = controlledPanel ?? fallbackPanel;
		if (!(panel instanceof HTMLElement)) throw new Error("A11yMenuButton: no panel found; use aria-controls or a direct-child panel with an id");
		this.trigger = trigger;
		this.panel = panel;
	}
	captureInitialState() {
		return {
			rootState: snapshotAttribute(this.root, "data-state"),
			rootPlacement: snapshotAttribute(this.root, "data-placement"),
			rootMatchWidth: snapshotAttribute(this.root, "data-match-width"),
			rootWasOpen: this.root.classList.contains(CLASSES.open),
			panelMaxHeight: this.root.style.getPropertyValue("--_panel-max-height"),
			triggerWidth: this.root.style.getPropertyValue("--_trigger-width"),
			triggerId: snapshotAttribute(this.trigger, "id"),
			triggerType: snapshotAttribute(this.trigger, "type"),
			triggerControls: snapshotAttribute(this.trigger, ATTRIBUTES.controls),
			triggerExpanded: snapshotAttribute(this.trigger, ATTRIBUTES.expanded),
			panelId: snapshotAttribute(this.panel, "id"),
			panelLabelledBy: snapshotAttribute(this.panel, ATTRIBUTES.labelledBy),
			panelHidden: this.panel.hasAttribute(ATTRIBUTES.hidden)
		};
	}
	setInitialState() {
		if (!this.panel.id) this.panel.id = `${COMPONENT_NAME}-panel-${++idCounter}`;
		if (!this.trigger.id) this.trigger.id = `${COMPONENT_NAME}-trigger-${++idCounter}`;
		if (!this.trigger.getAttribute("type")) this.trigger.type = "button";
		this.trigger.setAttribute(ATTRIBUTES.controls, this.panel.id);
		this.panel.setAttribute(ATTRIBUTES.labelledBy, this.trigger.id);
		const open = !this.panel.hasAttribute(ATTRIBUTES.hidden);
		this.trigger.setAttribute(ATTRIBUTES.expanded, String(open));
		this.root.dataset.state = open ? "open" : "closed";
		this.root.classList.toggle(CLASSES.open, open);
		if (!this.root.dataset.placement) this.root.dataset.placement = this.options.placement;
	}
	attachTriggerListeners() {
		this.trigger.addEventListener("click", this.handleTriggerClick);
		this.root.addEventListener("keydown", this.handleKeydown);
		this.root.addEventListener(MENU_BUTTON_EVENTS.asyncState, this.handleAsyncStateChange);
	}
	detachTriggerListeners() {
		this.trigger.removeEventListener("click", this.handleTriggerClick);
		this.root.removeEventListener("keydown", this.handleKeydown);
		this.root.removeEventListener(MENU_BUTTON_EVENTS.asyncState, this.handleAsyncStateChange);
	}
	attachDocumentListeners() {
		if (this.documentListenersAttached) return;
		if (this.options.closeOnOutsidePointer || this.options.closeOnFocusOut) {
			document.addEventListener("pointerdown", this.handlePointerdown);
			document.addEventListener("pointerup", this.handlePointerend);
			document.addEventListener("pointercancel", this.handlePointerend);
		}
		if (this.options.closeOnFocusOut) {
			this.root.addEventListener("focusout", this.handleFocusout);
			if (!this.root.contains(this.panel)) this.panel.addEventListener("focusout", this.handleFocusout);
		}
		this.panel.addEventListener("click", this.handleItemClick);
		this.documentListenersAttached = true;
	}
	detachDocumentListeners() {
		document.removeEventListener("pointerdown", this.handlePointerdown);
		document.removeEventListener("pointerup", this.handlePointerend);
		document.removeEventListener("pointercancel", this.handlePointerend);
		this.root.removeEventListener("focusout", this.handleFocusout);
		this.panel.removeEventListener("focusout", this.handleFocusout);
		this.panel.removeEventListener("click", this.handleItemClick);
		this.pointerInteractionStartedInside = false;
		this.documentListenersAttached = false;
	}
	attachLayoutListeners() {
		if (this.layoutListenersAttached) return;
		window.addEventListener("resize", this.handleLayoutChange);
		window.addEventListener("scroll", this.handleLayoutChange, {
			passive: true,
			capture: true
		});
		this.layoutListenersAttached = true;
	}
	detachLayoutListeners() {
		window.removeEventListener("resize", this.handleLayoutChange);
		window.removeEventListener("scroll", this.handleLayoutChange, true);
		this.layoutListenersAttached = false;
	}
	onTriggerClick() {
		this.toggle({ reason: "trigger" });
	}
	onKeydown(event) {
		const isTriggerEvent = event.target === this.trigger;
		const isPanelEvent = event.target instanceof Node && this.panel.contains(event.target);
		if (event.key === "Escape" && this.isOpen()) {
			if (this.options.closeOnEscape) {
				event.preventDefault();
				this.close({
					returnFocus: this.options.returnFocusOnEscape,
					reason: "escape"
				});
			}
			return;
		}
		if (isTriggerEvent && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
			event.preventDefault();
			this.open({ reason: "keyboard" });
			this.focusMenuItem(event.key === "ArrowUp" ? "last" : "first");
			return;
		}
		if (!this.isOpen() || !isPanelEvent) return;
		if (this.handleTypeahead(event)) return;
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			this.focusAdjacentItem(event.key === "ArrowDown" ? 1 : -1);
			return;
		}
		if (event.key === "Home" || event.key === "End") {
			event.preventDefault();
			this.focusMenuItem(event.key === "Home" ? "first" : "last");
		}
	}
	onPointerdown(event) {
		const startedInside = event.target instanceof Node && this.containsMenuTarget(event.target);
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
		if (this.options.closeOnOutsidePointer) this.close({
			returnFocus: false,
			reason: "outside-pointer"
		});
	}
	onPointerend() {
		if (!this.pointerInteractionStartedInside) return;
		if (this.pointerInteractionTimer !== null) window.clearTimeout(this.pointerInteractionTimer);
		this.pointerInteractionTimer = window.setTimeout(() => {
			this.pointerInteractionStartedInside = false;
			this.pointerInteractionTimer = null;
		}, 0);
	}
	onFocusout(event) {
		if (!this.isOpen()) return;
		if (event.relatedTarget instanceof Node && this.containsMenuTarget(event.relatedTarget)) return;
		if (this.pointerInteractionStartedInside) return;
		if (this.focusoutFrame !== null) cancelAnimationFrame(this.focusoutFrame);
		this.focusoutFrame = requestAnimationFrame(() => {
			this.focusoutFrame = null;
			const activeElement = document.activeElement;
			if (activeElement instanceof Node && this.containsMenuTarget(activeElement)) return;
			this.close({
				returnFocus: false,
				reason: "focusout"
			});
		});
	}
	onItemClick(event) {
		if (!(event.target instanceof Element)) return;
		const item = event.target.closest(SELECTORS.item);
		if (!(item instanceof HTMLElement) || !this.panel.contains(item) || this.isDisabledItem(item)) return;
		this.dispatch(MENU_BUTTON_EVENTS.itemClick, {
			...this.createEventDetail(),
			item,
			reason: "item-click"
		});
		if (item.hasAttribute("data-menu-close") || this.options.closeOnItemClick) {
			const returnFocus = this.panel.contains(document.activeElement);
			this.closeWithFocusGuard({
				returnFocus,
				reason: "item-click"
			}, () => this.panel.contains(document.activeElement));
		}
	}
	onLayoutChange() {
		this.schedulePlacementUpdate();
	}
	onAsyncStateChange() {
		if (this.isOpen()) this.schedulePlacementUpdate();
	}
	containsMenuTarget(target) {
		return this.root.contains(target) || this.panel.contains(target);
	}
	getFocusableItems() {
		return Array.from(this.panel.querySelectorAll(SELECTORS.focusable)).filter((item) => {
			if (!(item instanceof HTMLElement)) return false;
			const hidden = item.closest(SELECTORS.hidden) || item.offsetParent === null;
			return !this.isDisabledItem(item) && !hidden;
		});
	}
	focusMenuItem(position) {
		const items = this.getFocusableItems();
		(position === "last" ? items.at(-1) : items[0])?.focus();
	}
	isDisabledItem(item) {
		return item.hasAttribute("disabled") || item.getAttribute("aria-disabled") === "true";
	}
	getAssociatedLabelText(item) {
		const labels = item instanceof HTMLButtonElement || item instanceof HTMLInputElement || item instanceof HTMLSelectElement || item instanceof HTMLTextAreaElement ? item.labels : null;
		return Array.from(labels ?? [], (label) => label.textContent || "").join(" ");
	}
	getAriaLabelledbyText(item) {
		return (item.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean).map((id) => item.ownerDocument.getElementById(id)?.textContent || "").join(" ");
	}
	getItemText(item) {
		const inputValue = item instanceof HTMLInputElement && [
			"button",
			"image",
			"reset",
			"submit"
		].includes(item.type) ? item.value : "";
		return (item.getAttribute("data-menu-label") || this.getAriaLabelledbyText(item) || item.getAttribute("aria-label") || this.getAssociatedLabelText(item) || inputValue || item.textContent || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
	}
	isEditableTypeaheadTarget(target) {
		if (!(target instanceof HTMLElement)) return false;
		if (target.isContentEditable) return true;
		if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
		if (!(target instanceof HTMLInputElement)) return false;
		return ![
			"button",
			"checkbox",
			"image",
			"radio",
			"reset",
			"submit"
		].includes(target.type);
	}
	handleTypeahead(event) {
		if (!this.options.typeahead || this.isEditableTypeaheadTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey || event.key.length !== 1 || event.key.trim() === "") return false;
		const items = this.getFocusableItems();
		if (!items.length) return false;
		event.preventDefault();
		if (this.typeaheadTimer !== null) window.clearTimeout(this.typeaheadTimer);
		const character = event.key.toLocaleLowerCase();
		const repeating = this.typeaheadQuery.length > 0 && [...this.typeaheadQuery].every((value) => value === character);
		this.typeaheadQuery = repeating ? character : `${this.typeaheadQuery}${character}`;
		const activeIndex = items.indexOf(document.activeElement);
		const start = activeIndex === -1 ? 0 : activeIndex + 1;
		[...items.slice(start), ...items.slice(0, start)].find((item) => this.getItemText(item).startsWith(this.typeaheadQuery))?.focus();
		this.typeaheadTimer = window.setTimeout(() => {
			this.typeaheadQuery = "";
			this.typeaheadTimer = null;
		}, this.options.typeaheadTimeout);
		return true;
	}
	focusAdjacentItem(direction) {
		const items = this.getFocusableItems();
		if (!items.length) return;
		const current = items.indexOf(document.activeElement);
		items[current === -1 ? direction > 0 ? 0 : items.length - 1 : (current + direction + items.length) % items.length]?.focus();
	}
	getOffset() {
		const raw = getComputedStyle(this.root).getPropertyValue("--_panel-offset").trim();
		if (!raw || raw === "none") return DEFAULT_OFFSET;
		const parsed = Number.parseFloat(raw);
		if (Number.isNaN(parsed)) return DEFAULT_OFFSET;
		if (raw.endsWith("rem")) return parsed * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
		return parsed;
	}
	updatePlacement() {
		if (this.destroyed) return;
		const triggerRect = this.trigger.getBoundingClientRect();
		const offset = this.getOffset();
		const spaceBelow = window.innerHeight - triggerRect.bottom - offset;
		const spaceAbove = triggerRect.top - offset;
		const align = this.options.placement.endsWith("start") ? "start" : "end";
		const panelBlockChrome = Math.max(0, this.panel.offsetHeight - this.panel.clientHeight);
		const panelHeight = this.panel.scrollHeight + panelBlockChrome;
		let side = this.options.placement.startsWith("top") ? "top" : "bottom";
		if (this.options.flipOnOverflow) {
			const fitsBelow = panelHeight <= spaceBelow;
			const fitsAbove = panelHeight <= spaceAbove;
			if (side === "bottom" && !fitsBelow && fitsAbove) side = "top";
			else if (side === "top" && !fitsAbove && fitsBelow) side = "bottom";
			else if (!fitsBelow && !fitsAbove) side = spaceAbove > spaceBelow ? "top" : "bottom";
		}
		const availableSpace = side === "top" ? spaceAbove : spaceBelow;
		this.root.dataset.placement = `${side}-${align}`;
		if (this.options.maxPanelHeight) {
			const maxHeight = Math.min(Math.max(0, availableSpace), panelHeight + PANEL_HEIGHT_TOLERANCE);
			this.root.style.setProperty("--_panel-max-height", `${maxHeight}px`);
		} else this.root.style.removeProperty("--_panel-max-height");
	}
	schedulePlacementUpdate() {
		if (this.placementFrame !== null) return;
		this.placementFrame = requestAnimationFrame(() => {
			this.placementFrame = null;
			if (this.isOpen()) this.updatePlacement();
		});
	}
	clearFramesAndTimer() {
		if (this.placementFrame !== null) cancelAnimationFrame(this.placementFrame);
		if (this.focusoutFrame !== null) cancelAnimationFrame(this.focusoutFrame);
		if (this.pointerInteractionTimer !== null) window.clearTimeout(this.pointerInteractionTimer);
		if (this.typeaheadTimer !== null) window.clearTimeout(this.typeaheadTimer);
		this.placementFrame = null;
		this.focusoutFrame = null;
		this.pointerInteractionTimer = null;
		this.pointerInteractionStartedInside = false;
		this.typeaheadTimer = null;
		this.typeaheadQuery = "";
	}
	setupVisibilityObserver() {
		if (!this.options.observeVisibility || !("IntersectionObserver" in window)) return;
		this.visibilityObserver = new IntersectionObserver(([entry]) => {
			if (!entry) return;
			if (!entry.isIntersecting && this.isOpen()) this.close({
				returnFocus: false,
				reason: "visibility-change"
			});
			else if (entry.isIntersecting && this.isOpen()) this.refresh();
		});
		this.visibilityObserver.observe(this.root);
	}
	createEventDetail(overrides = {}) {
		const open = this.isOpen();
		return {
			instance: this,
			open,
			previousOpen: open,
			nextOpen: open,
			trigger: this.trigger,
			panel: this.panel,
			item: null,
			reason: "programmatic",
			...overrides
		};
	}
	dispatch(type, detail) {
		return dispatchMenuButtonEvent(this.root, type, detail);
	}
	isOpen() {
		return !this.panel.hasAttribute(ATTRIBUTES.hidden);
	}
	open(options = {}) {
		if (this.destroyed || this.isOpen() || this.transition !== null) return;
		const reason = options.reason ?? "programmatic";
		let opened = false;
		this.transition = "opening";
		try {
			const detail = {
				...this.createEventDetail({
					open: true,
					previousOpen: false,
					nextOpen: true,
					reason
				}),
				open: true,
				previousOpen: false,
				nextOpen: true,
				item: null
			};
			if (this.dispatch(MENU_BUTTON_EVENTS.beforeOpen, detail).defaultPrevented || this.destroyed) return;
			this.panel.removeAttribute(ATTRIBUTES.hidden);
			this.trigger.setAttribute(ATTRIBUTES.expanded, "true");
			this.root.dataset.state = "open";
			this.root.classList.add(CLASSES.open);
			if (this.options.matchTriggerWidth) {
				this.root.style.setProperty("--_trigger-width", `${this.trigger.offsetWidth}px`);
				this.root.dataset.matchWidth = "true";
			}
			this.updatePlacement();
			this.attachDocumentListeners();
			this.attachLayoutListeners();
			if (this.options.focusFirstOnOpen) this.focusMenuItem("first");
			opened = true;
		} finally {
			this.transition = null;
		}
		if (opened && !this.destroyed) this.dispatch(MENU_BUTTON_EVENTS.open, {
			...this.createEventDetail({
				open: true,
				previousOpen: false,
				nextOpen: true,
				reason
			}),
			open: true,
			previousOpen: false,
			nextOpen: true,
			item: null
		});
	}
	closeWithFocusGuard(options, shouldReturnFocus = () => true) {
		if (this.destroyed || !this.isOpen() || this.transition !== null) return;
		const reason = options.reason ?? "programmatic";
		let closed = false;
		this.transition = "closing";
		try {
			const detail = {
				...this.createEventDetail({
					open: false,
					previousOpen: true,
					nextOpen: false,
					reason
				}),
				open: false,
				previousOpen: true,
				nextOpen: false,
				item: null
			};
			if (this.dispatch(MENU_BUTTON_EVENTS.beforeClose, detail).defaultPrevented || this.destroyed) return;
			const returnFocus = options.returnFocus && shouldReturnFocus();
			this.panel.setAttribute(ATTRIBUTES.hidden, "");
			this.trigger.setAttribute(ATTRIBUTES.expanded, "false");
			this.root.dataset.state = "closed";
			this.root.classList.remove(CLASSES.open);
			this.detachDocumentListeners();
			this.detachLayoutListeners();
			this.clearFramesAndTimer();
			if (returnFocus) this.trigger.focus();
			closed = true;
		} finally {
			this.transition = null;
		}
		if (closed && !this.destroyed) this.dispatch(MENU_BUTTON_EVENTS.close, {
			...this.createEventDetail({
				open: false,
				previousOpen: true,
				nextOpen: false,
				reason
			}),
			open: false,
			previousOpen: true,
			nextOpen: false,
			item: null
		});
	}
	close(options = {}) {
		this.closeWithFocusGuard(options);
	}
	toggle(options = {}) {
		if (this.isOpen()) this.close(options);
		else this.open(options);
	}
	refresh() {
		if (this.destroyed || this.refreshing) return;
		this.refreshing = true;
		try {
			const previousTrigger = this.trigger;
			const previousPanel = this.panel;
			this.queryElements();
			if (this.trigger !== previousTrigger || this.panel !== previousPanel) {
				this.trigger = previousTrigger;
				this.panel = previousPanel;
				throw new Error("A11yMenuButton: refresh cannot replace the trigger or panel; destroy and reinitialize the menu instead");
			}
			if (this.options.matchTriggerWidth) this.root.style.setProperty("--_trigger-width", `${this.trigger.offsetWidth}px`);
			if (this.isOpen()) this.updatePlacement();
			this.dispatch(MENU_BUTTON_EVENTS.refresh, {
				...this.createEventDetail(),
				item: null,
				reason: "programmatic"
			});
		} finally {
			this.refreshing = false;
		}
	}
	restoreInitialState() {
		const state = this.initialState;
		restoreAttribute(this.root, "data-state", state.rootState);
		restoreAttribute(this.root, "data-placement", state.rootPlacement);
		restoreAttribute(this.root, "data-match-width", state.rootMatchWidth);
		this.root.classList.toggle(CLASSES.open, state.rootWasOpen);
		if (state.panelMaxHeight) this.root.style.setProperty("--_panel-max-height", state.panelMaxHeight);
		else this.root.style.removeProperty("--_panel-max-height");
		if (state.triggerWidth) this.root.style.setProperty("--_trigger-width", state.triggerWidth);
		else this.root.style.removeProperty("--_trigger-width");
		restoreAttribute(this.trigger, "id", state.triggerId);
		restoreAttribute(this.trigger, "type", state.triggerType);
		restoreAttribute(this.trigger, ATTRIBUTES.controls, state.triggerControls);
		restoreAttribute(this.trigger, ATTRIBUTES.expanded, state.triggerExpanded);
		restoreAttribute(this.panel, "id", state.panelId);
		restoreAttribute(this.panel, ATTRIBUTES.labelledBy, state.panelLabelledBy);
		this.panel.toggleAttribute(ATTRIBUTES.hidden, state.panelHidden);
	}
	destroy() {
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
				item: null
			});
			this.restoreInitialState();
		} finally {
			A11yMenuButton.instances.delete(this.root);
		}
	}
};
function createMenuButton(root, options = {}) {
	return new A11yMenuButton(root, options);
}
function initMenuButtons(root = document, options = {}) {
	const matchesRoot = root instanceof HTMLElement && root.matches(SELECTORS.root) ? [root] : [];
	const descendants = Array.from(root.querySelectorAll(SELECTORS.root)).filter((element) => element instanceof HTMLElement);
	return [...matchesRoot, ...descendants].map((element) => createMenuButton(element, options));
}
//#endregion
export { createMenuButton as n, initMenuButtons as r, A11yMenuButton as t };

//# sourceMappingURL=core-4x3kILRD.js.map