import { n as addMenuButtonEventListener, t as MENU_BUTTON_EVENTS } from "../events-Qrks-Ivi.js";
//#region src/addons/menu-feedback.ts
const DEFAULT_DURATION = 2e3;
const FEEDBACK_CLASS = "a11y-menu-button__feedback";
const VISIBLE_CLASS = "a11y-menu-button__feedback--visible";
const controllers = /* @__PURE__ */ new WeakMap();
function getFeedbackMessage(item) {
	return item?.dataset.menuFeedback?.trim() || "";
}
function getFeedbackDuration(item, fallback) {
	const raw = item?.dataset.menuFeedbackDuration;
	const parsed = raw === void 0 ? fallback : Number.parseInt(raw, 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
function attachMenuFeedback(root, options = {}) {
	if (!(root instanceof HTMLElement)) throw new TypeError("attachMenuFeedback: root must be an HTMLElement");
	const existing = controllers.get(root);
	if (existing) return existing;
	const existingRegion = root.querySelector(`:scope > .${FEEDBACK_CLASS}`);
	const region = options.region ?? (existingRegion instanceof HTMLElement ? existingRegion : null) ?? document.createElement("span");
	const generated = !options.region && !existingRegion;
	const initialText = region.textContent ?? "";
	const initiallyVisible = region.classList.contains(VISIBLE_CLASS);
	if (generated) {
		region.className = FEEDBACK_CLASS;
		region.setAttribute("role", "status");
		region.setAttribute("aria-live", "polite");
		region.setAttribute("aria-atomic", "true");
		root.append(region);
	}
	const fallbackDuration = options.duration !== void 0 && options.duration >= 0 ? options.duration : DEFAULT_DURATION;
	let clearTimer = null;
	let announceFrame = null;
	let destroyed = false;
	const clear = () => {
		if (clearTimer !== null) window.clearTimeout(clearTimer);
		if (announceFrame !== null) cancelAnimationFrame(announceFrame);
		clearTimer = null;
		announceFrame = null;
		region.classList.remove(VISIBLE_CLASS);
		region.textContent = "";
	};
	const removeItemClickListener = addMenuButtonEventListener(root, MENU_BUTTON_EVENTS.itemClick, (event) => {
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
	});
	const controller = {
		region,
		clear() {
			if (!destroyed) clear();
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			removeItemClickListener();
			clear();
			if (generated) region.remove();
			else {
				region.textContent = initialText;
				region.classList.toggle(VISIBLE_CLASS, initiallyVisible);
			}
			controllers.delete(root);
		}
	};
	controllers.set(root, controller);
	return controller;
}
//#endregion
export { attachMenuFeedback, attachMenuFeedback as default };

//# sourceMappingURL=menu-feedback.js.map