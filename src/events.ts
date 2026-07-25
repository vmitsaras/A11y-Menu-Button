import type { MenuButtonEventDetail } from './A11yMenuButton.js';
import type {
  AsyncMenuState,
  AsyncMenuStateController,
} from './addons/async-menu-state.js';
import type { FilterableMenuController } from './addons/filterable-menu.js';

export const MENU_BUTTON_EVENTS = Object.freeze({
  init: 'menu-button:init',
  beforeOpen: 'menu-button:before-open',
  open: 'menu-button:open',
  beforeClose: 'menu-button:before-close',
  close: 'menu-button:close',
  itemClick: 'menu-button:item-click',
  refresh: 'menu-button:refresh',
  asyncState: 'menu-button:async-state',
  filter: 'menu-button:filter',
  destroy: 'menu-button:destroy',
} as const);

export interface MenuButtonInitEventDetail extends MenuButtonEventDetail {
  item: null;
  reason: 'programmatic';
}

export interface MenuButtonOpenEventDetail extends MenuButtonEventDetail {
  open: true;
  previousOpen: false;
  nextOpen: true;
  item: null;
}

export interface MenuButtonBeforeOpenEventDetail
  extends MenuButtonOpenEventDetail {}

export interface MenuButtonCloseEventDetail extends MenuButtonEventDetail {
  open: false;
  previousOpen: true;
  nextOpen: false;
  item: null;
}

export interface MenuButtonBeforeCloseEventDetail
  extends MenuButtonCloseEventDetail {}

export interface MenuButtonItemClickEventDetail extends MenuButtonEventDetail {
  item: HTMLElement;
  reason: 'item-click';
}

export interface MenuButtonRefreshEventDetail extends MenuButtonEventDetail {
  item: null;
  reason: 'programmatic';
}

export interface MenuButtonDestroyEventDetail extends MenuButtonEventDetail {
  item: null;
}

export interface AsyncMenuStateEventDetail {
  root: HTMLElement;
  state: AsyncMenuState;
  previousState: AsyncMenuState;
  loading: boolean;
  panel: HTMLElement;
  stateElement: HTMLElement;
  controller: AsyncMenuStateController;
  reason: 'initialization' | 'programmatic';
}

export interface FilterableMenuEventDetail {
  root: HTMLElement;
  query: string;
  normalizedQuery: string;
  matchCount: number;
  input: HTMLInputElement | HTMLTextAreaElement;
  panel: HTMLElement;
  controller: FilterableMenuController;
  reason: 'input';
}

export interface MenuButtonEventMap {
  [MENU_BUTTON_EVENTS.init]: MenuButtonInitEventDetail;
  [MENU_BUTTON_EVENTS.beforeOpen]: MenuButtonBeforeOpenEventDetail;
  [MENU_BUTTON_EVENTS.open]: MenuButtonOpenEventDetail;
  [MENU_BUTTON_EVENTS.beforeClose]: MenuButtonBeforeCloseEventDetail;
  [MENU_BUTTON_EVENTS.close]: MenuButtonCloseEventDetail;
  [MENU_BUTTON_EVENTS.itemClick]: MenuButtonItemClickEventDetail;
  [MENU_BUTTON_EVENTS.refresh]: MenuButtonRefreshEventDetail;
  [MENU_BUTTON_EVENTS.asyncState]: AsyncMenuStateEventDetail;
  [MENU_BUTTON_EVENTS.filter]: FilterableMenuEventDetail;
  [MENU_BUTTON_EVENTS.destroy]: MenuButtonDestroyEventDetail;
}

export type MenuButtonEventName = keyof MenuButtonEventMap;

export type MenuButtonCustomEvent<
  Type extends MenuButtonEventName = MenuButtonEventName,
> = CustomEvent<MenuButtonEventMap[Type]>;

export type MenuButtonEventListener<Type extends MenuButtonEventName> = (
  event: MenuButtonCustomEvent<Type>,
) => void;

export function dispatchMenuButtonEvent<Type extends MenuButtonEventName>(
  root: HTMLElement,
  type: Type,
  detail: MenuButtonEventMap[Type],
): MenuButtonCustomEvent<Type> {
  const event = new CustomEvent<MenuButtonEventMap[Type]>(type, {
    bubbles: true,
    composed: false,
    cancelable:
      type === MENU_BUTTON_EVENTS.beforeOpen ||
      type === MENU_BUTTON_EVENTS.beforeClose,
    detail,
  });
  root.dispatchEvent(event);
  return event;
}

export function addMenuButtonEventListener<Type extends MenuButtonEventName>(
  root: HTMLElement,
  type: Type,
  listener: MenuButtonEventListener<Type>,
  options?: boolean | AddEventListenerOptions,
): () => void {
  const eventListener: EventListener = (event) => {
    listener(event as MenuButtonCustomEvent<Type>);
  };
  root.addEventListener(type, eventListener, options);
  return () => root.removeEventListener(type, eventListener, options);
}
