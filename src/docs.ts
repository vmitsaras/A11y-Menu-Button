export interface PluginDocs {
  slug: string;
  name: string;
  packageName: string;
  description: string;
  repo?: string;
  npm?: string;
  install: {
    npm: string;
    pnpm: string;
    yarn: string;
  };
  usage: string;
  selectors?: string[];
  keyboard?: Array<{
    key: string;
    description: string;
  }>;
  api: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  events?: Array<{
    name: string;
    description: string;
    cancelable: boolean;
    detail: string[];
  }>;
  examples?: Array<{
    name: string;
    description: string;
    path: string;
  }>;
}

export const docs = {
  slug: 'a11y-menu-button',
  name: 'A11y Menu Button',
  packageName: 'a11y-menu-button',
  description:
    'Disclosure-style menu button behavior for native links, buttons, and form controls, with keyboard navigation and optional add-ons.',
  repo: 'https://github.com/vmitsaras/A11y-Menu-Button',
  install: {
    npm: 'npm install a11y-menu-button',
    pnpm: 'pnpm add a11y-menu-button',
    yarn: 'yarn add a11y-menu-button',
  },
  usage: `import { createMenuButton } from 'a11y-menu-button/core';
import 'a11y-menu-button/styles.css';

const root = document.querySelector('[data-a11y-menu-button]');
if (root instanceof HTMLElement) {
  createMenuButton(root);
}`,
  selectors: [
    '[data-a11y-menu-button]',
    '.a11y-menu-button__trigger',
    '.a11y-menu-button__panel',
    '.a11y-menu-button__item',
  ],
  keyboard: [
    {
      key: 'Enter / Space',
      description: 'Uses native button activation to toggle the panel.',
    },
    {
      key: 'Space on a checkbox',
      description:
        'Uses native checkbox activation and leaves the panel open; Enter keeps its native non-activation behavior.',
    },
    {
      key: 'ArrowDown / ArrowUp',
      description: 'Opens from the trigger or moves through panel controls.',
    },
    {
      key: 'Home / End',
      description: 'Moves to the first or last focusable panel control.',
    },
    {
      key: 'Escape',
      description: 'Closes the panel and returns focus to the trigger.',
    },
    {
      key: 'Printable characters',
      description:
        'Moves focus to the next item whose data, ARIA, native form, or text label starts with the query; editable controls retain typing.',
    },
  ],
  api: [
    {
      name: 'createMenuButton(root, options)',
      type: '(root: HTMLElement, options?: A11yMenuButtonOptions) => A11yMenuButton',
      description: 'Initializes one menu button and reuses an existing instance.',
    },
    {
      name: 'initMenuButtons(root, options)',
      type: '(root?: ParentNode, options?: A11yMenuButtonOptions) => A11yMenuButton[]',
      description: 'Initializes descendants marked with data-a11y-menu-button.',
    },
    {
      name: 'destroy()',
      type: '() => void',
      description: 'Removes behavior and restores plugin-owned DOM state.',
    },
    {
      name: 'enhanceFilterableMenu(root, options)',
      type: '(root: HTMLElement, options?: FilterableMenuOptions) => FilterableMenuController | null',
      description:
        'Adds local filtering and optional delayed, deduplicated polite result-count announcements.',
    },
  ],
  events: [
    {
      name: 'menu-button:init',
      description: 'Initialization completed.',
      cancelable: false,
      detail: ['instance', 'open', 'previousOpen', 'nextOpen', 'trigger', 'panel', 'item', 'reason'],
    },
    {
      name: 'menu-button:before-open',
      description: 'Opening was requested; preventDefault() vetoes the transition.',
      cancelable: true,
      detail: ['instance', 'open', 'previousOpen', 'nextOpen', 'trigger', 'panel', 'item', 'reason'],
    },
    {
      name: 'menu-button:open',
      description: 'The panel opened and its public DOM state settled.',
      cancelable: false,
      detail: ['instance', 'open', 'previousOpen', 'nextOpen', 'trigger', 'panel', 'item', 'reason'],
    },
    {
      name: 'menu-button:before-close',
      description: 'Closing was requested; preventDefault() vetoes the transition.',
      cancelable: true,
      detail: ['instance', 'open', 'previousOpen', 'nextOpen', 'trigger', 'panel', 'item', 'reason'],
    },
    {
      name: 'menu-button:close',
      description: 'The panel closed and its public DOM state settled.',
      cancelable: false,
      detail: ['instance', 'open', 'previousOpen', 'nextOpen', 'trigger', 'panel', 'item', 'reason'],
    },
    {
      name: 'menu-button:item-click',
      description: 'An enabled panel action was activated.',
      cancelable: false,
      detail: ['instance', 'open', 'previousOpen', 'nextOpen', 'trigger', 'panel', 'item', 'reason'],
    },
    {
      name: 'menu-button:refresh',
      description: 'A refresh completed without replacing the trigger or panel.',
      cancelable: false,
      detail: ['instance', 'open', 'previousOpen', 'nextOpen', 'trigger', 'panel', 'item', 'reason'],
    },
    {
      name: 'menu-button:async-state',
      description: 'The async-state addon applied a caller-supplied state.',
      cancelable: false,
      detail: ['root', 'state', 'previousState', 'loading', 'panel', 'stateElement', 'controller', 'reason'],
    },
    {
      name: 'menu-button:filter',
      description: 'The filter addon applied a user input query.',
      cancelable: false,
      detail: ['root', 'query', 'normalizedQuery', 'matchCount', 'input', 'panel', 'controller', 'reason'],
    },
    {
      name: 'menu-button:destroy',
      description: 'Behavior is being removed; the instance is already inactive.',
      cancelable: false,
      detail: ['instance', 'open', 'previousOpen', 'nextOpen', 'trigger', 'panel', 'item', 'reason'],
    },
  ],
  examples: [
    {
      name: 'Account links',
      description: 'A minimal account actions panel using native links and a button.',
      path: 'index.html#live-demo',
    },
    {
      name: 'Edit actions',
      description: 'A classic three-dot trigger with native edit action buttons.',
      path: 'index.html#live-demo',
    },
    {
      name: 'Destructive actions',
      description: 'A panel that separates higher-risk actions.',
      path: 'index.html#live-demo',
    },
    {
      name: 'Document actions',
      description: 'Native action buttons with an unavailable control.',
      path: 'index.html#example-document-actions',
    },
    {
      name: 'Notifications',
      description: 'Descriptive native links with secondary time information.',
      path: 'index.html#example-notifications',
    },
    {
      name: 'Checkbox preferences',
      description:
        'Native checkbox controls that keep the disclosure open, including a disabled option.',
      path: 'index.html#example-checkboxes',
    },
    {
      name: 'Add-on cleanup ownership',
      description:
        'Reverse-order add-on cleanup followed by core teardown and safe reinitialization.',
      path: 'index.html#example-cleanup',
    },
    {
      name: 'Async retry and stale responses',
      description:
        'Application-owned cancellation, request ordering, retry UI, rendering, and async-state updates.',
      path: 'index.html#example-async',
    },
    {
      name: 'Filter result-count announcements',
      description:
        'Opt-in localized result counts with delayed updates, message deduplication, and an independent empty state.',
      path: 'index.html#example-filter',
    },
  ],
} satisfies PluginDocs;
