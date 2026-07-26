# Changelog

This package uses Changesets for release notes.

## 1.0.0 — 2026-07-26

Initial public release.

### Added

- A TypeScript-first, framework-independent disclosure-style menu button built
  around native links, buttons, and form controls.
- A core-only `a11y-menu-button/core` entry, a compatibility root entry, typed
  documentation metadata, explicit add-on subpaths, and CSS/theme exports.
- Typed lifecycle events, shared event constants, transition snapshots,
  cancelable before-open and before-close hooks, refresh reporting, and
  reentrancy guards.
- Optional async-state, command-menu, filter, feedback, hint, recent-action,
  and rich-item add-ons with explicit cleanup controllers.
- Package declarations, source maps, example markup, generated GitHub Pages
  documentation, themes, and release-focused tests.

### Accessibility and behavior

- Preserved application-directed focus when an item closes the panel, while
  restoring focus to the trigger when focus remains inside the closing panel.
- Kept native checkbox-label activation stable across pointer and focus-out
  event ordering.
- Expanded typeahead matching to native form labels and common accessible-name
  mechanisms while leaving printable keys available to editable controls.
- Used a polite status region for ordinary async-state errors.
- Restored author-owned DOM state during add-on teardown and made core/add-on
  cleanup ownership explicit.
- Documented browser-support, progressive-enhancement, storage, privacy, and
  assistive-technology validation boundaries without making a blanket WCAG or
  screen-reader compatibility claim.
