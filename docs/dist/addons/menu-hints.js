import { n as addMenuButtonEventListener, t as MENU_BUTTON_EVENTS } from "../events-Qrks-Ivi.js";
import { a as parseSafeInteger, i as getMenuPanel, r as getMatchingRoots } from "../shared-CfHq7gqB.js";
//#region src/addons/menu-hints.ts
const ROOT_SELECTOR = "[data-menu-hints=\"true\"]";
const HINT_CLASS = "a11y-menu-button__hint";
const VISIBLE_CLASS = "a11y-menu-button__hint--visible";
const DEFAULT_MESSAGES = Object.freeze([
	"Use arrow keys to move",
	"Press Escape to close",
	"Start typing to search"
]);
const DEFAULT_TIMEOUT = 4e3;
const DEFAULT_MAX_OPENINGS = 3;
const DEFAULT_STORAGE_PREFIX = "a11y-menu-button:menu-hints:";
const controllers = /* @__PURE__ */ new WeakMap();
function normalizeMessages(messages) {
	if (typeof messages === "string") return messages.split("|").map((value) => value.trim()).filter(Boolean);
	if (Array.isArray(messages)) return messages.map((value) => String(value).trim()).filter(Boolean);
	return [...DEFAULT_MESSAGES];
}
function storageKeyFor(root, options) {
	if (options.storageKey?.trim()) return options.storageKey.trim();
	if (root.dataset.menuHintsStorageKey) return root.dataset.menuHintsStorageKey;
	const trigger = root.querySelector(":scope > .a11y-menu-button__trigger");
	const id = root.id || (trigger instanceof HTMLElement ? trigger.id : "");
	return id ? `${DEFAULT_STORAGE_PREFIX}${id}` : null;
}
function readState(key) {
	try {
		const parsed = JSON.parse(window.localStorage.getItem(key) || "{}");
		if (typeof parsed !== "object" || parsed === null) return {
			dismissed: false,
			openCount: 0
		};
		const record = parsed;
		return {
			dismissed: record.dismissed === true,
			openCount: typeof record.openCount === "number" && Number.isInteger(record.openCount) ? record.openCount : 0
		};
	} catch {
		return {
			dismissed: false,
			openCount: 0
		};
	}
}
function writeState(key, state) {
	try {
		window.localStorage.setItem(key, JSON.stringify(state));
	} catch {}
}
function createHint(messages) {
	const hint = document.createElement("div");
	const list = document.createElement("ul");
	hint.className = HINT_CLASS;
	hint.setAttribute("aria-hidden", "true");
	hint.hidden = true;
	messages.forEach((message) => {
		const item = document.createElement("li");
		item.textContent = message;
		list.append(item);
	});
	hint.append(list);
	return hint;
}
function attachMenuHints(root, options = {}) {
	if (!(root instanceof HTMLElement)) throw new TypeError("attachMenuHints: root must be an HTMLElement");
	if (root.dataset.menuHints === "false") return null;
	const existingController = controllers.get(root);
	if (existingController) return existingController;
	const panel = options.panel ?? getMenuPanel(root);
	if (!panel) throw new Error("attachMenuHints: no panel found");
	const messages = normalizeMessages(options.messages ?? root.dataset.menuHintMessages);
	const timeout = parseSafeInteger(options.timeout ?? root.dataset.menuHintsTimeout, DEFAULT_TIMEOUT);
	const maxOpenings = parseSafeInteger(options.maxOpenings ?? root.dataset.menuHintsMaxOpenings, DEFAULT_MAX_OPENINGS, 1);
	const persist = options.persist ?? root.dataset.menuHintsPersist === "true";
	const storageKey = storageKeyFor(root, options);
	const useStorage = Boolean(persist && storageKey && "localStorage" in window);
	const existingHint = panel.querySelector(`:scope > .${HINT_CLASS}`);
	const hint = options.hint ?? (existingHint instanceof HTMLElement ? existingHint : null) ?? createHint(messages);
	const generated = !options.hint && !existingHint;
	const initialHintParent = hint.parentNode;
	const initialHintNextSibling = hint.nextSibling;
	const initialHintHidden = hint.hidden;
	const initialHintVisible = hint.classList.contains(VISIBLE_CLASS);
	if (!hint.parentNode) panel.prepend(hint);
	const state = useStorage && storageKey ? readState(storageKey) : {
		dismissed: false,
		openCount: 0
	};
	let hideTimer = null;
	let showFrame = null;
	let destroyed = false;
	const persistState = () => {
		if (useStorage && storageKey) writeState(storageKey, state);
	};
	const hide = () => {
		if (hideTimer !== null) window.clearTimeout(hideTimer);
		if (showFrame !== null) cancelAnimationFrame(showFrame);
		hideTimer = null;
		showFrame = null;
		hint.classList.remove(VISIBLE_CLASS);
		hint.hidden = true;
	};
	const dismiss = () => {
		hide();
		state.dismissed = true;
		persistState();
	};
	const show = () => {
		if (state.dismissed || !messages.length) return;
		state.openCount += 1;
		if (state.openCount > maxOpenings) {
			state.dismissed = true;
			persistState();
			hide();
			return;
		}
		persistState();
		hint.hidden = false;
		showFrame = requestAnimationFrame(() => {
			showFrame = null;
			hint.classList.add(VISIBLE_CLASS);
		});
		if (timeout > 0) hideTimer = window.setTimeout(hide, timeout);
	};
	const onOpen = () => show();
	const onClose = () => hide();
	const onKeydown = (event) => {
		if (!event.altKey && !event.ctrlKey && !event.metaKey) dismiss();
	};
	const removeOpenListener = addMenuButtonEventListener(root, MENU_BUTTON_EVENTS.open, onOpen);
	const removeCloseListener = addMenuButtonEventListener(root, MENU_BUTTON_EVENTS.close, onClose);
	const controller = {
		hint,
		panel,
		show() {
			if (!destroyed) show();
		},
		hide() {
			if (!destroyed) hide();
		},
		dismiss() {
			if (!destroyed) dismiss();
		},
		clearDismissal() {
			if (destroyed) return;
			state.dismissed = false;
			state.openCount = 0;
			persistState();
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			removeOpenListener();
			removeCloseListener();
			root.removeEventListener("keydown", onKeydown, true);
			panel.removeEventListener("keydown", onKeydown, true);
			hide();
			if (generated) hint.remove();
			else {
				hint.hidden = initialHintHidden;
				hint.classList.toggle(VISIBLE_CLASS, initialHintVisible);
				if (!initialHintParent) hint.remove();
				else if (hint.parentNode !== initialHintParent) initialHintParent.insertBefore(hint, initialHintNextSibling);
			}
			controllers.delete(root);
		}
	};
	root.addEventListener("keydown", onKeydown, true);
	if (!root.contains(panel)) panel.addEventListener("keydown", onKeydown, true);
	controllers.set(root, controller);
	return controller;
}
function attachMenuHintsToMenus(root = document, options = {}) {
	return getMatchingRoots(root, ROOT_SELECTOR).map((menu) => attachMenuHints(menu, options)).filter((controller) => controller !== null);
}
//#endregion
export { attachMenuHints, attachMenuHints as default, attachMenuHintsToMenus };

//# sourceMappingURL=menu-hints.js.map