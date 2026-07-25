# A11y Menu Button

A TypeScript-first, framework-independent disclosure-style menu button for
short collections of native links, buttons, and form controls. It provides open/close state,
placement, keyboard movement, typeahead, lifecycle events, optional add-ons,
and complete cleanup without turning the panel into an ARIA application menu.

The package is prepared for npm publishing but this repository does not claim
that it is currently published.

## Installation

After publication:

```bash
npm install a11y-menu-button
pnpm add a11y-menu-button
yarn add a11y-menu-button
```

For local development:

```bash
npm install
npm run build:dist
```

## Usage

```ts
import { createMenuButton } from "a11y-menu-button/core";
import "a11y-menu-button/styles.css";

const root = document.querySelector("[data-a11y-menu-button]");

if (root instanceof HTMLElement) {
  const menu = createMenuButton(root);
  // menu.destroy() removes behavior and restores plugin-owned DOM state.
}
```

Use `initMenuButtons()` to initialize every marked root in a document or
container. Importing the package never auto-initializes the DOM.

The package root remains a compatibility entry that exports the core and every
add-on. Use `a11y-menu-button/core` when a consumer needs a structurally
core-only entry without depending on bundler tree-shaking.

## HTML structure

```html
<div
  class="a11y-menu-button"
  data-a11y-menu-button
  data-placement="bottom-end">
  <button
    class="a11y-menu-button__trigger"
    type="button"
    aria-expanded="false"
    aria-controls="account-actions">
    Account actions
  </button>

  <div
    class="a11y-menu-button__panel"
    id="account-actions"
    hidden>
    <a class="a11y-menu-button__item" href="/profile" data-menu-close>
      Profile
    </a>
    <button class="a11y-menu-button__item" type="button" data-menu-close>
      Sign out
    </button>
  </div>
</div>
```

The trigger must be a real `button`; panel actions remain native links,
buttons, and form controls after enhancement. JavaScript is required to reveal
a panel authored with `hidden`. If actions must remain available without
JavaScript, provide a separate visible fallback or use a native disclosure such
as `details`/`summary` instead of this plugin.

When `data-menu-close` or `closeOnItemClick` closes the panel, focus returns to
the trigger only if it is still inside the panel after synchronous application
listeners finish. If an item or `before-close` listener deliberately focuses a
dialog or destination outside the panel, the menu preserves that destination.
A canceled `before-close` keeps both the panel and current focus in place.

## API

### Runtime exports

```ts
createMenuButton(root, options?)
initMenuButtons(root?, options?)
new A11yMenuButton(root, options?)
```

Duplicate initialization reuses the existing instance for the same root.

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `closeOnEscape` | `boolean` | `true` | Close on Escape. |
| `closeOnOutsidePointer` | `boolean` | `true` | Close after a pointer action outside. |
| `closeOnFocusOut` | `boolean` | `true` | Close when focus leaves the component. |
| `closeOnItemClick` | `boolean` | `false` | Close for all items rather than only `data-menu-close`. |
| `focusFirstOnOpen` | `boolean` | `false` | Focus the first enabled control after opening. |
| `returnFocusOnEscape` | `boolean` | `true` | Return focus to the trigger after Escape. |
| `matchTriggerWidth` | `boolean` | `false` | Match panel width to the trigger. |
| `placement` | `MenuButtonPlacement` | `"bottom-end"` | `bottom-start`, `bottom-end`, `top-start`, or `top-end`. |
| `flipOnOverflow` | `boolean` | `true` | Flip vertically when the preferred side lacks space. |
| `maxPanelHeight` | `boolean` | `true` | Limit the panel to available viewport space. |
| `observeVisibility` | `boolean` | `true` | Refresh or close when root visibility changes. |
| `typeahead` | `boolean` | `true` | Find controls by typing the beginning of their label. |
| `typeaheadTimeout` | `number` | `700` | Milliseconds before the typeahead query resets. |

Options can also be provided through matching `data-*` attributes. Explicit
TypeScript/JavaScript options take precedence, followed by dataset values, then
defaults. Invalid boolean, placement, and integer values fall back safely.

### Instance methods

- `open()`
- `close()`
- `toggle()`
- `isOpen()`
- `refresh()`
- `updatePlacement()`
- `destroy()`

### Events

Events dispatch from the component root with `bubbles: true` and
`composed: false`. They can be delegated within the same document or shadow
root, but they do not cross a Shadow DOM boundary. Observation events are not
cancelable. `before-open` and `before-close` are intentional synchronous veto
hooks and honor `preventDefault()`.

Use `MENU_BUTTON_EVENTS` instead of repeating event-name strings. The exported
`MenuButtonEventMap`, event-specific detail interfaces, and
`addMenuButtonEventListener()` helper preserve name/detail inference without
augmenting global DOM event maps:

```ts
import {
  MENU_BUTTON_EVENTS,
  addMenuButtonEventListener,
} from "a11y-menu-button";

const removeListener = addMenuButtonEventListener(
  root,
  MENU_BUTTON_EVENTS.open,
  (event) => {
    console.log(event.detail.reason, event.detail.nextOpen);
  },
);

// removeListener();
```

Core detail includes `instance`, `open`, `previousOpen`, `nextOpen`, `trigger`,
`panel`, `item`, and `reason`. For transition events, `open` is the intended or
settled state, while `previousOpen` and `nextOpen` provide an unambiguous
snapshot.

| Event | Cancelable | Exact trigger |
| --- | --- | --- |
| `menu-button:init` | No | Initialization and initial DOM synchronization completed. |
| `menu-button:before-open` | Yes | Immediately before an effective closed-to-open transition. |
| `menu-button:open` | No | Open DOM state, placement, listeners, and optional focus settled. |
| `menu-button:before-close` | Yes | Immediately before an effective open-to-closed transition. |
| `menu-button:close` | No | Closed DOM state, listener cleanup, and optional focus restoration settled. |
| `menu-button:item-click` | No | An enabled panel action was activated. It precedes any item-triggered close sequence. |
| `menu-button:refresh` | No | `refresh()` completed. Replacing the trigger or panel requires destroy and reinitialization. |
| `menu-button:async-state` | No | The async-state addon applied a caller-supplied state. |
| `menu-button:filter` | No | User input caused the filter addon to apply a query. |
| `menu-button:destroy` | No | Teardown started after the instance became inactive and before DOM restoration. |

Item-triggered closure follows this order: `menu-button:item-click` listeners
finish, focus eligibility is assessed, `menu-button:before-close` listeners
finish, the closed DOM state is applied, eligible focus returns to the trigger,
and `menu-button:close` is emitted. Focus eligibility is checked again before
restoration so a `before-close` listener can safely focus a dialog or another
destination. Canceling `before-close` stops the sequence before DOM or focus
changes.

Calls that do not change open state emit no transition events. Recursive calls
from `before-open` or `before-close` listeners are ignored until the active
transition settles. Destruction is idempotent and no lifecycle event is emitted
after destruction.

## Accessibility notes

- Uses real button, link, input, and status elements.
- Synchronizes `aria-expanded`, `aria-controls`, and `hidden`.
- Does not use `role="menu"` or `role="menuitem"`; the panel retains native
  document semantics and natural Tab order.
- Does not trap focus.
- Focus-out and outside-pointer closing can be configured.
- `destroy()` removes listeners, timers, observers, frames, generated state,
  and restores plugin-owned attributes and styles.
- Reduced-motion styles suppress non-essential transitions and animation.

| Keyboard input | Context | Behavior and focus result |
| --- | --- | --- |
| ArrowDown / ArrowUp | Trigger | Opens the panel and focuses the first / last enabled visible control. |
| ArrowDown / ArrowUp | Open panel | Moves through enabled visible controls with wrapping. |
| Home / End | Open panel | Focuses the first / last enabled visible control. |
| Printable character | Open panel, outside editable controls | Moves focus by typeahead using `data-menu-label`, ARIA naming, native form labels, or control text when enabled. |
| Escape | Open component | Closes the panel and returns focus to the trigger when configured. |
| Enter / Space | Native button item | Runs the native action; item-triggered closure returns focus only while focus remains in the panel. |
| Enter | Native link item | Follows native link activation; intercepted or same-document closure uses the same conditional focus restoration. |
| Space | Native checkbox | Toggles the checked state and leaves the disclosure open; Enter keeps the browser's native non-activation behavior. |

These behaviors are tested, but no blanket WCAG or screen-reader compatibility
claim is made. Test the final product markup with its supported browser and
assistive-technology combinations.

## CSS

Import the default stylesheet:

```ts
import "a11y-menu-button/styles.css";
```

Public variables use the `--a11y-menu-button-*` prefix. Core BEM hooks include:

- `.a11y-menu-button`
- `.a11y-menu-button__trigger`
- `.a11y-menu-button__panel`
- `.a11y-menu-button__item`
- `.a11y-menu-button__separator`

Optional CSS exports:

```ts
import "a11y-menu-button/styles/addons/command-menu.css";
import "a11y-menu-button/styles/themes/a11y-menu-button-soft.css";
import "a11y-menu-button/styles/themes/a11y-menu-button-compact.css";
import "a11y-menu-button/styles/themes/a11y-menu-button-elevated.css";
import "a11y-menu-button/styles/themes/a11y-menu-button-command.css";
```

Theme files provide variable presets. Verify custom foreground/background,
hover, active, danger, and focus colors in the consuming product. The core
stylesheet gives the panel a `CanvasText` border when forced colors are active,
because its normal shadow may not be visible. If a product supplies its own
panel border, test the cascade in forced-colors mode; the core declaration uses
the `border` shorthand so it replaces the author border rather than adding a
second boundary.

For manual forced-colors verification, enable a Windows Contrast theme, open
the menu, and confirm that the panel boundary remains visible against adjacent
content at every supported placement. Also confirm that the trigger and menu
items retain visible focus indicators. Perform this check for any product theme
or border override before mapping the result to WCAG 1.4.11.

## Add-ons

All runtime add-ons remain typed exports from the package root for
compatibility. Dedicated subpaths make each optional boundary explicit and
return cleanup controllers where applicable.

| Add-on | Import subpath | Exports | Purpose |
| --- | --- | --- | --- |
| Async state | `a11y-menu-button/addons/async-menu-state` | `enhanceAsyncMenuState`, `enhanceAsyncMenuStates`, `setAsyncMenuLoading` | Loading, empty, error, ready, `aria-busy`, and live status states. |
| Command menu | `a11y-menu-button/addons/command-menu` | `enhanceCommandMenu`, `enhanceCommandMenus` | Group labels, descriptions, and decorative shortcut hints. |
| Filter | `a11y-menu-button/addons/filterable-menu` | `enhanceFilterableMenu`, `enhanceFilterableMenus` | Local text filtering with a labeled search control, empty status, and opt-in result-count announcements. |
| Feedback | `a11y-menu-button/addons/menu-feedback` | `attachMenuFeedback` | Polite, non-modal activation feedback. |
| Hints | `a11y-menu-button/addons/menu-hints` | `attachMenuHints`, `attachMenuHintsToMenus` | Visual keyboard hints; persistence is opt-in. |
| Recent actions | `a11y-menu-button/addons/recent-actions` | `enhanceRecentActions`, `enhanceRecentActionMenus` | Recent action clones; persistence is opt-in and stores only stable IDs. |
| Rich items | `a11y-menu-button/addons/rich-menu-items` | `enhanceRichMenuItems` | Decorative icons, descriptions, shortcuts, and danger styling. |

Filterable menus are flat text filters, not fuzzy or remote search. Recent
actions and hints do not write to `localStorage` unless explicitly configured.

### Filter result-count announcements

Result-count announcements are disabled by default. Enable them only when the
count adds useful context beyond the visible filtering behavior:

```ts
import { enhanceFilterableMenu } from "a11y-menu-button/addons/filterable-menu";

const filter = enhanceFilterableMenu(root, {
  announceResultCount: true,
  formatResultCount: ({ count }) =>
    count === 1 ? "1 action available" : `${count} actions available`,
});
```

`formatResultCount` receives a read-only object containing `count`, the raw
`query`, and `normalizedQuery`. The default formatter announces “1 menu item
available” or “N menu items available.” It does not repeat the query, which
avoids unnecessary verbosity and accidental disclosure of sensitive input.
Custom formatters receive the raw query, so do not forward it to analytics,
logs, remote services, or announcements when it could contain sensitive text.

When enabled, the add-on creates one visually hidden `role="status"` region
with `aria-live="polite"` and `aria-atomic="true"` during initialization. An
author-provided direct child can be reused instead:

```html
<p data-menu-filter-status></p>
```

Count updates wait for a 250 ms quiet period. Rapid inputs replace the pending
update, and an identical formatted message is not written to the live region
again. When no items match, the count region is cleared and the existing “No
matching items” status remains the only announcement, avoiding two competing
zero-result messages. `destroy()` cancels pending updates, removes a generated
status region, and restores an author-provided region.

| Interaction | Expected status information |
| --- | --- |
| One or more results after input settles | One concise formatted count after 250 ms. |
| Several rapid inputs | Only the final settled result. |
| Different query with the same formatted message | No repeated announcement. |
| Zero results | The existing empty-state message only. |
| Add-on destruction before the delay ends | No delayed announcement. |

This behavior is designed to support WCAG 4.1.3 Status Messages, but automated
DOM tests cannot verify actual speech output. Before release, manually check
the enabled feature with the browser and screen-reader combinations supported
by the consuming product, such as VoiceOver with Safari and NVDA with Firefox
or Chrome. Confirm that typing remains responsive, only one settled count is
spoken, the empty message is not duplicated, and focus stays in the filter
input. Try the [inline filter result-count demo](index.html#example-filter).

## Recipes

### Disabled and checkable items

Prefer native disabled controls. The plugin excludes both native `disabled`
controls and elements with `aria-disabled="true"` from its managed Arrow,
Home, End, and typeahead movement, but ARIA does not disable browser or
application behavior:

```html
<button class="a11y-menu-button__item" type="button" disabled>
  Export report
</button>
```

Use `aria-disabled="true"` only when a native disabled state is unavailable or
the control must remain discoverable in the natural Tab order. For a disabled
link, remove its `href` and application activation handler when possible. If
the link must keep its destination, the application must suppress navigation
and guard every activation path; `aria-disabled` alone does not do this:

```ts
const unavailableLink = root.querySelector<HTMLAnchorElement>(
  'a[aria-disabled="true"]',
);

unavailableLink?.addEventListener('click', (event) => {
  event.preventDefault();
  // Do not run the unavailable application action.
});
```

For settings that remain in the open disclosure panel, use a native checkbox
or a toggle button. Do not add `role="menuitemcheckbox"`; this plugin does not
implement the ARIA application-menu pattern:

```html
<label for="email-updates">
  <input id="email-updates" type="checkbox" name="email-updates" />
  Email updates
</label>

<button
  class="a11y-menu-button__item"
  type="button"
  aria-pressed="false">
  Compact view: off
</button>
```

Clicking either the checkbox or its label toggles the native control without
closing the disclosure. With keyboard focus on the checkbox, use Space to
toggle it; Enter is not a native checkbox activation key.

The application owns the checkbox value and must update both the toggle
button's `aria-pressed` value and visible label when its state changes. Try the
[inline native-checkbox demo](index.html#example-checkboxes).

### Add-on cleanup ownership

Install the core first, then install optional add-ons. Because each add-on owns
its own generated DOM, listeners, timers, and storage interactions, destroy
controllers in reverse installation order before destroying the menu:

```ts
import {
  createMenuButton,
} from "a11y-menu-button/core";
import { attachMenuHints } from "a11y-menu-button/addons/menu-hints";
import {
  enhanceFilterableMenu,
} from "a11y-menu-button/addons/filterable-menu";

const menu = createMenuButton(root);
const filter = enhanceFilterableMenu(root);
const hints = attachMenuHints(root);

function destroyMenu(): void {
  hints?.destroy();
  filter?.destroy();
  menu.destroy();
}
```

Core `destroy()` cannot clean up add-ons it did not install. Keep the returned
controllers with the owning view or component and call the same cleanup
function during unmount, navigation, or DOM replacement. The
[inline add-on lifecycle demo](index.html#example-cleanup) demonstrates
destroying and safely reinitializing the same server-rendered markup.

### Async retry and stale-response protection

The async-state add-on only reflects caller-supplied state. The application
must start and cancel requests, reject stale responses, render trusted DOM, and
own the retry control:

```ts
import {
  createMenuButton,
} from "a11y-menu-button/core";
import {
  enhanceAsyncMenuState,
} from "a11y-menu-button/addons/async-menu-state";

const menu = createMenuButton(root);
const asyncState = enhanceAsyncMenuState(root);
const retryButton = root.querySelector<HTMLButtonElement>("[data-menu-retry]");
const actions = root.querySelector<HTMLElement>("[data-menu-actions]");
let activeRequest: AbortController | null = null;
let requestVersion = 0;

async function loadActions(): Promise<void> {
  const version = ++requestVersion;
  activeRequest?.abort();
  const request = new AbortController();
  activeRequest = request;
  const retryHadFocus = document.activeElement === retryButton;
  if (retryButton) {
    retryButton.hidden = !retryHadFocus;
    retryButton.setAttribute("aria-disabled", "true");
  }
  asyncState.setLoading(true, { message: "Loading actions…" });

  try {
    const response = await fetch("/api/menu-actions", {
      signal: request.signal,
    });
    if (!response.ok) throw new Error("Request failed");
    const result: Array<{ id: string; label: string }> = await response.json();
    if (request.signal.aborted || version !== requestVersion) return;

    const items = result.map(({ id, label }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "a11y-menu-button__item";
      button.dataset.menuActionId = id;
      button.textContent = label;
      return button;
    });
    actions?.replaceChildren(...items);
    asyncState.setReady();
    menu.refresh();
    if (retryHadFocus && menu.isOpen()) {
      (items[0] ?? menu.trigger).focus();
    }
    if (retryButton) {
      retryButton.hidden = true;
      retryButton.removeAttribute("aria-disabled");
    }
  } catch (error) {
    if (
      request.signal.aborted ||
      version !== requestVersion ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      return;
    }
    asyncState.setError({ message: "Actions could not be loaded." });
    if (retryButton) {
      retryButton.hidden = false;
      retryButton.removeAttribute("aria-disabled");
    }
  } finally {
    if (activeRequest === request) activeRequest = null;
  }
}

retryButton?.addEventListener("click", () => {
  if (retryButton.getAttribute("aria-disabled") === "true") return;
  void loadActions();
});
```

Abort the active request before destroying the async controller and core
instance. Do not include request URLs, response data, or sensitive error text
in status announcements. The runnable
[inline async retry demo](index.html#example-async) uses a local simulated
request, so it makes no hidden network call.

## Examples

The [demo and compact documentation](index.html#live-demo) keeps every runnable
example on one page. The main demo covers account links, common edit actions,
and destructive actions; the [live pattern gallery](index.html#examples) adds
document actions, notifications, native checkboxes, filtering, asynchronous
retry, and add-on teardown without separate example pages.

The page imports the compiled package from `dist`, so run
`npm run build:dist` before opening it through a local static server.
For a minimal standalone starting point, open
[`examples/basic/index.html`](examples/basic/index.html) after the same build.

## Docs metadata

Documentation aggregators can import typed metadata without scraping this file:

```ts
import { docs } from "a11y-menu-button/docs";
```

## Browser support policy

The compatibility target is modern browsers that support ES2022 modules and
web-platform features in the [Baseline Widely Available](https://web.dev/baseline/)
set at release time. The package ships no polyfills. `IntersectionObserver` is
feature-detected and visibility observation degrades safely when it is absent.

This target is a compatibility policy, not a claim of completed browser or
assistive-technology verification. Before release, record keyboard and focus
results in current Chromium, Firefox, and Safari, plus VoiceOver with Safari
and any NVDA/browser combinations the consuming product supports.

## Limitations

- Flat disclosure panels only; nested and mega menus are outside scope.
- No application-menu ARIA roles and no focus trap.
- Four placements with vertical flipping, not a general portal or collision
  engine.
- The plugin does not create application markup, confirmation flows, or action
  labels.
- Conditional item focus restoration observes synchronous `item-click` and
  `before-close` listeners. Applications that schedule a later asynchronous
  focus move must coordinate it with their own destination lifecycle.
- Full-page link navigation replaces the document context; conditional focus
  restoration mainly benefits button actions and links handled in the current
  document.
- Add-on status announcements and storage choices remain the consuming
  application’s responsibility to test and explain.
- The async-state addon reports caller-supplied states; it does not start,
  cancel, sequence, or protect asynchronous requests from stale results.
- Add-ons are installed independently. Destroy their controllers before the
  menu instance; destroying the core instance cannot clean up addons it did not
  install.

## License

[MIT](LICENSE) © 2026 Vasileios Mitsaras.
