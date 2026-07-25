//#region src/events.ts
const MENU_BUTTON_EVENTS = Object.freeze({
	init: "menu-button:init",
	beforeOpen: "menu-button:before-open",
	open: "menu-button:open",
	beforeClose: "menu-button:before-close",
	close: "menu-button:close",
	itemClick: "menu-button:item-click",
	refresh: "menu-button:refresh",
	asyncState: "menu-button:async-state",
	filter: "menu-button:filter",
	destroy: "menu-button:destroy"
});
function dispatchMenuButtonEvent(root, type, detail) {
	const event = new CustomEvent(type, {
		bubbles: true,
		composed: false,
		cancelable: type === MENU_BUTTON_EVENTS.beforeOpen || type === MENU_BUTTON_EVENTS.beforeClose,
		detail
	});
	root.dispatchEvent(event);
	return event;
}
function addMenuButtonEventListener(root, type, listener, options) {
	const eventListener = (event) => {
		listener(event);
	};
	root.addEventListener(type, eventListener, options);
	return () => root.removeEventListener(type, eventListener, options);
}
//#endregion
export { addMenuButtonEventListener as n, dispatchMenuButtonEvent as r, MENU_BUTTON_EVENTS as t };

//# sourceMappingURL=events-Qrks-Ivi.js.map