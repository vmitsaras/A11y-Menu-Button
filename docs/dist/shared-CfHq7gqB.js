//#region src/addons/shared.ts
const PANEL_SELECTOR = ".a11y-menu-button__panel";
const ITEM_SELECTOR = ".a11y-menu-button__item";
function getMenuPanel(root) {
	const panelId = root.querySelector(":scope > .a11y-menu-button__trigger, :scope > button[aria-controls]")?.getAttribute("aria-controls");
	const controlled = panelId ? document.getElementById(panelId) : null;
	if (controlled instanceof HTMLElement) return controlled;
	const fallback = root.querySelector(`:scope > ${PANEL_SELECTOR}, :scope > [id]`);
	return fallback instanceof HTMLElement ? fallback : null;
}
function getMatchingRoots(root, selector) {
	const current = root instanceof HTMLElement && root.matches(selector) ? [root] : [];
	const descendants = Array.from(root.querySelectorAll(selector)).filter((element) => element instanceof HTMLElement);
	return [...current, ...descendants];
}
function parseSafeInteger(value, fallback, minimum = 0) {
	const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
	return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}
//#endregion
export { parseSafeInteger as a, getMenuPanel as i, PANEL_SELECTOR as n, getMatchingRoots as r, ITEM_SELECTOR as t };

//# sourceMappingURL=shared-CfHq7gqB.js.map