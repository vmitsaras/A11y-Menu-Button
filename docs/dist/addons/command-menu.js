import { i as getMenuPanel, r as getMatchingRoots, t as ITEM_SELECTOR } from "../shared-CfHq7gqB.js";
//#region src/addons/command-menu.ts
const ROOT_SELECTOR = "[data-command-menu=\"true\"]";
const ENHANCED_ATTR = "data-command-menu-enhanced";
const GROUP_ATTR = "data-command-group";
const DESCRIPTION_ATTR = "data-command-description";
const SHORTCUT_ATTR = "data-command-shortcut";
const GROUP_LABEL_CLASS = "a11y-menu-button__command-group-label";
const COMMAND_ITEM_CLASS = "a11y-menu-button__command-item";
const COMMAND_CONTENT_CLASS = "a11y-menu-button__command-content";
const COMMAND_LABEL_CLASS = "a11y-menu-button__command-label";
const COMMAND_DESCRIPTION_CLASS = "a11y-menu-button__command-description";
const COMMAND_SHORTCUT_CLASS = "a11y-menu-button__command-shortcut";
const controllers = /* @__PURE__ */ new WeakMap();
let groupIdCounter = 0;
function normalizeText(value) {
	return (value || "").replace(/\s+/g, " ").trim();
}
function decorativeSpan(className, text) {
	const span = document.createElement("span");
	span.className = className;
	span.textContent = text;
	span.setAttribute("aria-hidden", "true");
	return span;
}
function enhanceCommandMenu(root, options = {}) {
	if (!(root instanceof HTMLElement)) throw new TypeError("enhanceCommandMenu: root must be an HTMLElement");
	if (root.dataset.commandMenu !== "true" && options.force !== true) return null;
	const existing = controllers.get(root);
	if (existing) return existing;
	const panel = options.panel ?? getMenuPanel(root);
	if (!panel) throw new Error("enhanceCommandMenu: no panel found");
	const snapshots = /* @__PURE__ */ new Map();
	let destroyed = false;
	const removeGroupLabels = () => {
		panel.querySelectorAll(`:scope > .${GROUP_LABEL_CLASS}`).forEach((label) => label.remove());
	};
	const enhanceItem = (item) => {
		if (snapshots.has(item) || item.hasAttribute(ENHANCED_ATTR)) return;
		const nodes = Array.from(item.childNodes);
		const labelText = normalizeText(item.dataset.menuLabel || item.getAttribute("aria-label") || item.textContent);
		snapshots.set(item, {
			nodes,
			enhanced: item.getAttribute(ENHANCED_ATTR),
			dataLabel: item.getAttribute("data-menu-label"),
			ariaLabel: item.getAttribute("aria-label"),
			commandClass: item.classList.contains(COMMAND_ITEM_CLASS)
		});
		const label = document.createElement("span");
		const content = document.createElement("span");
		label.className = COMMAND_LABEL_CLASS;
		label.append(...nodes);
		content.className = COMMAND_CONTENT_CLASS;
		content.append(label);
		const description = normalizeText(item.getAttribute(DESCRIPTION_ATTR));
		if (description) content.append(decorativeSpan(COMMAND_DESCRIPTION_CLASS, description));
		item.classList.add(COMMAND_ITEM_CLASS);
		item.setAttribute(ENHANCED_ATTR, "true");
		item.append(content);
		const shortcut = normalizeText(item.getAttribute(SHORTCUT_ATTR));
		if (shortcut) item.append(decorativeSpan(COMMAND_SHORTCUT_CLASS, shortcut));
		if (labelText) {
			if (!item.dataset.menuLabel) item.dataset.menuLabel = labelText;
			if (!item.hasAttribute("aria-label")) item.setAttribute("aria-label", labelText);
		}
	};
	const render = () => {
		if (destroyed) return;
		const items = Array.from(panel.querySelectorAll(`:scope > ${ITEM_SELECTOR}`)).filter((item) => item instanceof HTMLElement);
		removeGroupLabels();
		items.forEach(enhanceItem);
		let currentGroup = "";
		items.forEach((item) => {
			const group = normalizeText(item.getAttribute(GROUP_ATTR));
			if (!group || group === currentGroup) return;
			currentGroup = group;
			const label = document.createElement("div");
			label.className = GROUP_LABEL_CLASS;
			label.id = `a11y-menu-command-group-${++groupIdCounter}`;
			label.textContent = group;
			label.setAttribute("role", "presentation");
			panel.insertBefore(label, item);
		});
	};
	const controller = {
		panel,
		refresh: render,
		destroy() {
			if (destroyed) return;
			destroyed = true;
			removeGroupLabels();
			snapshots.forEach((snapshot, item) => {
				item.replaceChildren(...snapshot.nodes);
				item.classList.toggle(COMMAND_ITEM_CLASS, snapshot.commandClass);
				if (snapshot.enhanced === null) item.removeAttribute(ENHANCED_ATTR);
				else item.setAttribute(ENHANCED_ATTR, snapshot.enhanced);
				if (snapshot.dataLabel === null) delete item.dataset.menuLabel;
				else item.dataset.menuLabel = snapshot.dataLabel;
				if (snapshot.ariaLabel === null) item.removeAttribute("aria-label");
				else item.setAttribute("aria-label", snapshot.ariaLabel);
			});
			snapshots.clear();
			controllers.delete(root);
		}
	};
	controllers.set(root, controller);
	render();
	return controller;
}
function enhanceCommandMenus(root = document, options = {}) {
	return getMatchingRoots(root, ROOT_SELECTOR).map((menu) => enhanceCommandMenu(menu, options)).filter((controller) => controller !== null);
}
//#endregion
export { enhanceCommandMenu as default, enhanceCommandMenu, enhanceCommandMenus };

//# sourceMappingURL=command-menu.js.map