import { n as addMenuButtonEventListener, t as MENU_BUTTON_EVENTS } from "../events-Qrks-Ivi.js";
import { a as parseSafeInteger, i as getMenuPanel, r as getMatchingRoots, t as ITEM_SELECTOR } from "../shared-CfHq7gqB.js";
//#region src/addons/recent-actions.ts
const ROOT_SELECTOR = "[data-menu-recent=\"true\"]";
const ACTION_ID_ATTR = "data-menu-action-id";
const RECENT_SECTION_CLASS = "a11y-menu-button__recent";
const RECENT_HEADING_CLASS = "a11y-menu-button__recent-heading";
const RECENT_LIST_CLASS = "a11y-menu-button__recent-list";
const RECENT_SEPARATOR_CLASS = "a11y-menu-button__recent-separator";
const RECENT_CLONE_ATTR = "data-menu-recent-clone";
const DEFAULT_LABEL = "Recent";
const DEFAULT_MAX_ITEMS = 3;
const DEFAULT_STORAGE_PREFIX = "a11y-menu-button:recent-actions:";
const controllers = /* @__PURE__ */ new WeakMap();
let recentIdCounter = 0;
function storageKeyFor(root, options) {
	if (options.storageKey?.trim()) return options.storageKey.trim();
	if (root.dataset.menuRecentStorageKey) return root.dataset.menuRecentStorageKey;
	const trigger = root.querySelector(":scope > .a11y-menu-button__trigger");
	const id = root.id || (trigger instanceof HTMLElement ? trigger.id : "");
	return id ? `${DEFAULT_STORAGE_PREFIX}${id}` : null;
}
function readIds(key) {
	try {
		const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
		return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
	} catch {
		return [];
	}
}
function writeIds(key, ids) {
	try {
		window.localStorage.setItem(key, JSON.stringify(ids));
	} catch {}
}
function actionId(item) {
	return item?.getAttribute(ACTION_ID_ATTR)?.trim() || "";
}
function itemLabel(item) {
	return (item.getAttribute("data-menu-label") || item.getAttribute("aria-label") || item.textContent || "").replace(/\s+/g, " ").trim();
}
function unique(ids) {
	return ids.filter((id, index) => Boolean(id) && ids.indexOf(id) === index);
}
function enhanceRecentActions(root, options = {}) {
	if (!(root instanceof HTMLElement)) throw new TypeError("enhanceRecentActions: root must be an HTMLElement");
	if (root.dataset.menuRecent !== "true" && options.force !== true) return null;
	const existing = controllers.get(root);
	if (existing) return existing;
	const panel = getMenuPanel(root);
	if (!panel) throw new Error("enhanceRecentActions: no panel found");
	const label = options.label?.trim() || root.dataset.menuRecentLabel || DEFAULT_LABEL;
	const limit = parseSafeInteger(options.maxItems ?? root.dataset.menuRecentMax, DEFAULT_MAX_ITEMS, 1);
	const persist = options.persist ?? root.dataset.menuRecentPersist === "true";
	const storageKey = storageKeyFor(root, options);
	const useStorage = Boolean(persist && storageKey && "localStorage" in window);
	let ids = unique(useStorage && storageKey ? readIds(storageKey) : []).slice(0, limit);
	let section = null;
	let list = null;
	let destroyed = false;
	const eligibleItems = () => Array.from(panel.querySelectorAll(`${ITEM_SELECTOR}[${ACTION_ID_ATTR}]`)).filter((item) => item instanceof HTMLElement && !item.hasAttribute(RECENT_CLONE_ATTR));
	const persistIds = () => {
		if (useStorage && storageKey) writeIds(storageKey, ids);
	};
	const createSection = () => {
		section = document.createElement("section");
		const heading = document.createElement("div");
		list = document.createElement("div");
		const separator = document.createElement("div");
		section.className = RECENT_SECTION_CLASS;
		heading.className = RECENT_HEADING_CLASS;
		heading.id = `a11y-menu-recent-${++recentIdCounter}`;
		heading.textContent = label;
		list.className = RECENT_LIST_CLASS;
		list.setAttribute("aria-labelledby", heading.id);
		separator.className = `a11y-menu-button__separator ${RECENT_SEPARATOR_CLASS}`;
		separator.setAttribute("role", "separator");
		section.append(heading, list, separator);
		panel.prepend(section);
	};
	const render = () => {
		const byId = new Map(eligibleItems().map((item) => [actionId(item), item]));
		const items = ids.map((id) => byId.get(id)).filter((item) => item !== void 0).slice(0, limit);
		if (!items.length) {
			section?.remove();
			section = null;
			list = null;
			return;
		}
		if (!section || !list) createSection();
		const clones = items.map((item) => {
			const clone = item.cloneNode(true);
			if (!(clone instanceof HTMLElement)) throw new Error("enhanceRecentActions: failed to clone an action");
			const sourceId = item.id;
			clone.removeAttribute("id");
			clone.setAttribute(RECENT_CLONE_ATTR, "true");
			clone.dataset.menuRecentSourceId = actionId(item);
			if (sourceId) clone.dataset.menuRecentSourceElementId = sourceId;
			if (!clone.hasAttribute("aria-label")) clone.setAttribute("aria-label", `${label}: ${itemLabel(item)}`);
			return clone;
		});
		list?.replaceChildren(...clones);
	};
	const removeItemClickListener = addMenuButtonEventListener(root, MENU_BUTTON_EVENTS.itemClick, (event) => {
		const item = event.detail.item;
		const id = actionId(item);
		if (!id) return;
		ids = unique([id, ...ids]).slice(0, limit);
		persistIds();
		render();
	});
	const controller = {
		panel,
		get recentIds() {
			return [...ids];
		},
		render() {
			if (!destroyed) render();
		},
		clear() {
			if (destroyed) return;
			ids = [];
			persistIds();
			render();
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			removeItemClickListener();
			section?.remove();
			controllers.delete(root);
		}
	};
	controllers.set(root, controller);
	render();
	return controller;
}
function enhanceRecentActionMenus(root = document, options = {}) {
	return getMatchingRoots(root, ROOT_SELECTOR).map((menu) => enhanceRecentActions(menu, options)).filter((controller) => controller !== null);
}
//#endregion
export { enhanceRecentActions as default, enhanceRecentActions, enhanceRecentActionMenus };

//# sourceMappingURL=recent-actions.js.map