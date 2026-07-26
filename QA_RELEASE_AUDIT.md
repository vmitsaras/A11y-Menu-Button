# QA release audit

Audit date: 2026-07-26

## Verdict

**Ready for the first public release after the final automated gates pass.**
The intended source and generated documentation are committed on `main`, the
package version is `1.0.0`, the consumed Changesets are represented in the
changelog, and a verification-only CI workflow covers install, test, typecheck,
build, package contents, and generated-documentation drift.

No unresolved Blocker or High implementation defect was found in the exercised
paths. Firefox, Safari, assistive-technology, forced-colors, zoom/text-resize,
reduced-motion, and expanded real-browser geometry checks remain unperformed
manual validation. They are recorded below as evidence gaps rather than
silently inferred results. The README limits the support claim accordingly,
makes no blanket WCAG or screen-reader compatibility claim, and asks consumers
to test their final markup and supported browser/assistive-technology matrix.

## Implemented audit findings

1. Added a non-breaking `a11y-menu-button/core` entry and dedicated add-on
   subpaths. The existing root entry and all public exports remain available.
2. Restored author-owned input, empty-state, async-state, feedback, and hint
   DOM on add-on destruction. Author-owned storage marker attributes are no
   longer repurposed by the async add-on.
3. Added regression tests for the new package boundary, add-on cleanup,
   malformed/unavailable storage, and `IntersectionObserver` teardown.
4. Added a runnable `examples/basic/` example that imports the core-only entry.
5. Updated README, generated docs source, demo copy, package exports, Changeset
   metadata, browser-support guidance, and raw-query privacy guidance.
6. Updated the Pages generator to copy code-split runtime chunks. The first
   post-change build exposed the stale single-bundle assumption; the corrected
   build passes.
7. Removed an inaccurate progressive-enhancement claim. Panels authored with
   `hidden` require JavaScript to become available; the README now requires a
   separate visible fallback or native disclosure when no-JavaScript access is
   a product requirement.

## Automated evidence

| Gate | Result |
| --- | --- |
| `npm run test` | Pass: 2 files, 48 tests |
| `npm run typecheck` | Pass |
| `npm run build` | Pass; package and generated Pages output rebuilt |
| `npm run pack:check` | Pass |
| Changesets status | No pending Changesets; consumed notes are included in the `1.0.0` changelog |
| Lockfile dependency view | Five declared development dependencies; no runtime dependencies |
| Package self-imports | Root, core, docs, and all seven add-on subpaths import successfully |
| Packed consumer JavaScript | Pass from an isolated temporary install |
| Packed consumer TypeScript | Pass with `NodeNext` resolution |
| CSS export resolution | Core, add-on, and four theme CSS subpaths resolve from the tarball |
| Secret-pattern filename scan | No matches |

The physical development `node_modules` directory contains several extraneous
WASM support packages left by local tooling. `npm ls --package-lock-only
--depth=0` is clean, and an isolated tarball consumer install is clean. A future
approved `npm ci` can normalize the local development tree.

## Package and performance evidence

| Artifact | Transitive raw JavaScript | Sum of per-file gzip sizes |
| --- | ---: | ---: |
| `a11y-menu-button/core` | 27,823 B | 6,804 B |
| `a11y-menu-button` root | 71,882 B | 20,883 B |
| Filter add-on subpath | 12,714 B | 4,011 B |
| Default CSS | 12,968 B | 2,522 B |

The final dry-run tarball contains 56 files, is approximately 68.5 kB
compressed, and is approximately 295.1 kB unpacked. The increase from the
earlier 18-file baseline is explained by the new explicit JavaScript/type entry
points, their code-split chunks/maps, and the completed `1.0.0` changelog.
Package contents remain limited to `dist`, README, changelog, license, and
package metadata.

Runtime inspection found no hidden network, telemetry, cookie, session storage,
or IndexedDB behavior. Persistence remains opt-in and limited to stable recent
action IDs or hint dismissal/open-count state. Storage read/write failures are
caught. Custom filter result formatters receive the raw query and are now
documented as a privacy boundary.

## Chromium evidence

The repository demo and the new basic example were served locally and exercised
in the in-app Chromium browser.

- Nine demo triggers had non-empty names, unique relationships, synchronized
  `aria-expanded`/`hidden` state, and no duplicate IDs.
- ArrowDown opened the panel and focused its first enabled control.
- Arrow navigation moved focus; Escape closed and restored trigger focus.
- The generated filter kept focus in its labeled search input, reduced the
  visible result set, and emitted one settled polite count.
- The async demo exposed a polite error, a named retry control, and recovered
  to three visible actions while moving focus to the first loaded action.
- The basic example loaded without console warnings/errors and passed the same
  ArrowDown opening path.
- At 320, 375, 768, and 1280 CSS pixels, the page had no horizontal document
  overflow. The three live-demo panels stayed within the viewport at 320 px.
- A 320 px visual inspection showed a visible keyboard focus outline and no
  clipped panel controls.

The browser runner did not produce native Enter, Space, or Tab behavior from
its synthetic key injection, so those inputs are not counted as verified.

## Lifecycle and accessibility contract review

Source, declarations, tests, README, docs metadata, and demo behavior agree on:

- options/default precedence and the existing option names/defaults;
- root-scoped, bubbling, non-composed lifecycle events;
- cancellation only for `before-open` and `before-close`;
- item-click → before-close → close ordering;
- reentrant transition guards and duplicate initialization reuse;
- conditional focus restoration after application listeners;
- native disclosure semantics without ARIA menu roles or a focus trap;
- idempotent destruction and cleanup ownership between add-ons and core.

No public option, default, event name/detail/order, CSS subpath, or existing
export was removed or changed.

## Prioritized edge-case matrix

| Priority | Scenario | Current evidence | Required suite |
| --- | --- | --- | --- |
| P0 | Native Enter/Space trigger activation and Tab/Shift+Tab exit | Source/native semantics and DOM tests only | Chromium, Firefox, Safari manual or real-browser automation |
| P0 | VoiceOver and NVDA names, expanded state, filter count, async error/retry timing | DOM/accessibility-tree inference only | VoiceOver/Safari; supported NVDA/browser pairs |
| P0 | 200–400% zoom, text-only resize, forced colors, reduced motion | CSS/source review; 320 px reflow passed | Actual platform manual checks |
| P0 | Four placements at every viewport edge with long localized labels | Vertical geometry unit tests; three demo panels at 320 px | Real-browser geometry suite |
| P1 | Pointer/focus-out race and checkbox-label activation | Vitest regression coverage | Pointer/touch smoke test in each supported browser |
| P1 | Cancellation, recursive transitions, listener-directed focus, duplicate initialization | Vitest coverage | Browser smoke test |
| P1 | Repeated mount/destroy, observer/timer/listener cleanup, author-owned DOM | Vitest coverage including new teardown cases | Long-running browser stress test |
| P1 | Malformed or blocked opt-in storage | Vitest coverage including thrown storage access | Private/locked-down browser smoke test |
| P1 | Rapid filter input, duplicate announcements, zero results | Vitest plus Chromium DOM timing | Screen-reader timing check |
| P1 | Async stale responses, abort, DOM removal, retry focus | Application-owned recipe plus Chromium demo recovery | Consumer integration/browser automation |
| P2 | Malformed markup and unsafe trigger/panel replacement | Vitest rejection coverage | Consumer error-message review |

## Release checklist and remaining validation

- [x] Confirm the exact source/generated/release file boundary and commit the
      intended repository state. `docs/` is documented as generated,
      committed GitHub Pages output; `dist/` remains ignored package output.
- [x] Add CI for clean install, test, typecheck, build, pack verification, and
      generated-documentation drift.
- [ ] Run the complete keyboard table in current Chromium, Firefox, and Safari,
      including rapid pointer-to-keyboard transitions and application listeners
      that move focus.
- [ ] Run VoiceOver with Safari and every NVDA/browser combination included in
      the support policy. Record actual spoken output; do not infer it.
- [ ] Test 320 px reflow, 200% and 400% zoom, text-only resize, long localized
      labels, scrolling, and all four placements at each viewport edge.
- [ ] Test all themes with visible focus, forced colors, and reduced motion on
      their actual platforms.
- [x] Keep screenshot baselines out of the initial release. None currently
      exist, and the current release does not claim visual-regression coverage.
- [x] Re-run `npm run test`, `npm run typecheck`, `npm run build`, and
      `npm run pack:check` on 2026-07-26 after the release-preparation changes.

## Compatibility basis

The package targets ES2022 and documents Baseline Widely Available web-platform
features as its compatibility policy. `IntersectionObserver` is feature
detected. The stylesheet contains reduced-motion and forced-colors fallbacks.
This is a target policy, not proof that the remaining
browser/assistive-technology matrix passed.
