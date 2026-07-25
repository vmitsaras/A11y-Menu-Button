import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync('src/styles.css', 'utf8');

describe('core stylesheet', () => {
  it('provides a panel boundary when forced colors are active', () => {
    expect(stylesheet).toMatch(
      /@media \(forced-colors: active\)\s*\{\s*\.a11y-menu-button__panel\s*\{\s*border: 1px solid CanvasText;\s*\}\s*\}/,
    );
  });

  it('visually hides the opt-in filter status without removing it from the accessibility tree', () => {
    expect(stylesheet).toMatch(
      /\.a11y-menu-button__filter-status,[\s\S]*?clip-path: inset\(50%\);[\s\S]*?white-space: nowrap;/,
    );
  });

  it('keeps filtered menu items hidden despite the item display rule', () => {
    expect(stylesheet).toMatch(
      /\.a11y-menu-button__item\[hidden\]\s*\{\s*display: none;\s*\}/,
    );
  });
});
