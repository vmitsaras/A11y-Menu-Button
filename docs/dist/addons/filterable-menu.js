import { r as dispatchMenuButtonEvent, t as MENU_BUTTON_EVENTS } from "../events-Qrks-Ivi.js";
import { i as getMenuPanel, r as getMatchingRoots, t as ITEM_SELECTOR } from "../shared-CfHq7gqB.js";
//#region src/addons/filterable-menu.ts
const ROOT_SELECTOR = "[data-menu-filterable=\"true\"]";
const FILTER_CLASS = "a11y-menu-button__filter";
const FILTER_INPUT_CLASS = "a11y-menu-button__filter-input";
const EMPTY_CLASS = "a11y-menu-button__empty";
const RESULT_STATUS_CLASS = "a11y-menu-button__filter-status";
const INPUT_SELECTOR = "[data-menu-filter-input]";
const RESULT_STATUS_SELECTOR = ":scope > [data-menu-filter-status], :scope > .a11y-menu-button__filter-status";
const DEFAULT_EMPTY_MESSAGE = "No matching items";
const RESULT_ANNOUNCEMENT_DELAY = 250;
const controllers = /* @__PURE__ */ new WeakMap();
let filterIdCounter = 0;
function defaultResultCountFormatter({ count }) {
	return count === 1 ? "1 menu item available." : `${count} menu items available.`;
}
function restoreAttribute(element, name, value) {
	if (value === null) element.removeAttribute(name);
	else element.setAttribute(name, value);
}
function itemText(item) {
	return (item.getAttribute("data-menu-label") || item.textContent || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}
function visibleItems(panel) {
	return Array.from(panel.querySelectorAll(ITEM_SELECTOR)).filter((item) => item instanceof HTMLElement && !item.hidden && item.offsetParent !== null);
}
function enhanceFilterableMenu(root, options = {}) {
	if (!(root instanceof HTMLElement)) throw new TypeError("enhanceFilterableMenu: root must be an HTMLElement");
	if (root.dataset.menuFilterable !== "true") return null;
	const existingController = controllers.get(root);
	if (existingController) return existingController;
	const panel = getMenuPanel(root);
	if (!panel) throw new Error("enhanceFilterableMenu: no panel found");
	const existingInput = panel.querySelector(INPUT_SELECTOR);
	let generatedWrapper = null;
	let input = options.input;
	if (!input && (existingInput instanceof HTMLInputElement || existingInput instanceof HTMLTextAreaElement)) input = existingInput;
	if (!input) {
		generatedWrapper = document.createElement("div");
		const generatedInput = document.createElement("input");
		generatedWrapper.className = FILTER_CLASS;
		generatedInput.className = FILTER_INPUT_CLASS;
		generatedInput.type = "search";
		generatedInput.autocomplete = "off";
		generatedInput.spellcheck = false;
		generatedInput.dataset.menuFilterInput = "";
		generatedWrapper.append(generatedInput);
		panel.prepend(generatedWrapper);
		input = generatedInput;
	}
	const inputSnapshot = generatedWrapper ? null : {
		id: input.getAttribute("id"),
		label: input.getAttribute("aria-label"),
		placeholder: input.getAttribute("placeholder")
	};
	const label = options.label?.trim() || "Filter menu items";
	if (!input.id) input.id = `a11y-menu-filter-${++filterIdCounter}`;
	if (!input.hasAttribute("aria-label")) input.setAttribute("aria-label", label);
	if (input instanceof HTMLInputElement && !input.placeholder) input.placeholder = label;
	const existingEmpty = panel.querySelector(`:scope > .${EMPTY_CLASS}`);
	const empty = options.emptyState ?? (existingEmpty instanceof HTMLElement ? existingEmpty : null) ?? document.createElement("div");
	const generatedEmpty = !options.emptyState && !existingEmpty;
	const emptyStateSnapshot = generatedEmpty ? null : {
		hidden: empty.hidden,
		text: empty.textContent ?? ""
	};
	if (generatedEmpty) {
		empty.className = EMPTY_CLASS;
		empty.setAttribute("role", "status");
		empty.setAttribute("aria-live", "polite");
		panel.append(empty);
	}
	empty.textContent = options.emptyMessage?.trim() || root.dataset.menuFilterEmpty || DEFAULT_EMPTY_MESSAGE;
	empty.hidden = true;
	const announceResultCount = options.announceResultCount === true;
	const existingResultStatus = announceResultCount ? panel.querySelector(RESULT_STATUS_SELECTOR) : null;
	const resultStatus = announceResultCount ? existingResultStatus instanceof HTMLElement ? existingResultStatus : document.createElement("p") : null;
	const generatedResultStatus = Boolean(resultStatus && !(existingResultStatus instanceof HTMLElement));
	const resultStatusSnapshot = resultStatus && !generatedResultStatus ? {
		role: resultStatus.getAttribute("role"),
		live: resultStatus.getAttribute("aria-live"),
		atomic: resultStatus.getAttribute("aria-atomic"),
		hidden: resultStatus.hidden,
		text: resultStatus.textContent ?? ""
	} : null;
	if (resultStatus) {
		if (generatedResultStatus) {
			resultStatus.className = RESULT_STATUS_CLASS;
			resultStatus.dataset.menuFilterStatus = "";
			panel.append(resultStatus);
		}
		resultStatus.setAttribute("role", "status");
		resultStatus.setAttribute("aria-live", "polite");
		resultStatus.setAttribute("aria-atomic", "true");
		resultStatus.hidden = false;
		resultStatus.textContent = "";
	}
	const originalHidden = /* @__PURE__ */ new Map();
	let destroyed = false;
	let resultAnnouncementTimer = null;
	let pendingResultContext = null;
	let lastResultAnnouncement = "";
	let controller;
	const clearPendingResultAnnouncement = () => {
		if (resultAnnouncementTimer !== null) window.clearTimeout(resultAnnouncementTimer);
		resultAnnouncementTimer = null;
		pendingResultContext = null;
	};
	const scheduleResultAnnouncement = (context) => {
		if (!resultStatus || destroyed) return;
		clearPendingResultAnnouncement();
		if (context.count === 0) {
			resultStatus.textContent = "";
			lastResultAnnouncement = "";
			return;
		}
		pendingResultContext = context;
		resultAnnouncementTimer = window.setTimeout(() => {
			resultAnnouncementTimer = null;
			const pending = pendingResultContext;
			pendingResultContext = null;
			if (!pending || destroyed) return;
			const formatted = (options.formatResultCount ?? defaultResultCountFormatter)(pending);
			const message = typeof formatted === "string" ? formatted.trim() : "";
			if (!message || message === lastResultAnnouncement) return;
			resultStatus.textContent = message;
			lastResultAnnouncement = message;
		}, RESULT_ANNOUNCEMENT_DELAY);
	};
	const filter = () => {
		if (destroyed) return {
			normalizedQuery: "",
			matchCount: 0
		};
		const normalizedQuery = input.value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
		let matches = 0;
		panel.querySelectorAll(ITEM_SELECTOR).forEach((item) => {
			if (!(item instanceof HTMLElement)) return;
			if (!originalHidden.has(item)) originalHidden.set(item, item.hasAttribute("hidden"));
			const match = !normalizedQuery || itemText(item).includes(normalizedQuery);
			item.hidden = !match;
			if (match) matches += 1;
		});
		empty.hidden = matches > 0;
		if (document.activeElement instanceof HTMLElement && document.activeElement.matches(".a11y-menu-button__item") && document.activeElement.hidden) input.focus();
		return {
			normalizedQuery,
			matchCount: visibleItems(panel).length
		};
	};
	const onInput = () => {
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
			reason: "input"
		});
		scheduleResultAnnouncement({
			count: result.matchCount,
			query,
			normalizedQuery: result.normalizedQuery
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
			input.removeEventListener("input", onInput);
			originalHidden.forEach((hidden, item) => {
				item.hidden = hidden;
			});
			if (generatedEmpty) empty.remove();
			else if (emptyStateSnapshot) {
				empty.hidden = emptyStateSnapshot.hidden;
				empty.textContent = emptyStateSnapshot.text;
			}
			if (generatedResultStatus) resultStatus?.remove();
			else if (resultStatus && resultStatusSnapshot) {
				restoreAttribute(resultStatus, "role", resultStatusSnapshot.role);
				restoreAttribute(resultStatus, "aria-live", resultStatusSnapshot.live);
				restoreAttribute(resultStatus, "aria-atomic", resultStatusSnapshot.atomic);
				resultStatus.hidden = resultStatusSnapshot.hidden;
				resultStatus.textContent = resultStatusSnapshot.text;
			}
			if (inputSnapshot) {
				restoreAttribute(input, "id", inputSnapshot.id);
				restoreAttribute(input, "aria-label", inputSnapshot.label);
				restoreAttribute(input, "placeholder", inputSnapshot.placeholder);
			}
			generatedWrapper?.remove();
			controllers.delete(root);
		}
	};
	input.addEventListener("input", onInput);
	controllers.set(root, controller);
	filter();
	return controller;
}
function enhanceFilterableMenus(root = document, options = {}) {
	return getMatchingRoots(root, ROOT_SELECTOR).map((menu) => enhanceFilterableMenu(menu, options)).filter((controller) => controller !== null);
}
//#endregion
export { enhanceFilterableMenus as default, enhanceFilterableMenus, enhanceFilterableMenu };

//# sourceMappingURL=filterable-menu.js.map