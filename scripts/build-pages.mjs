import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = resolve(projectRoot, 'docs');

async function requirePath(path, kind = 'file') {
  const absolute = resolve(projectRoot, path);
  const details = await stat(absolute).catch(() => null);
  const valid = kind === 'directory' ? details?.isDirectory() : details?.isFile();
  if (!valid) throw new Error(`Required ${kind} is missing: ${path}`);
  return absolute;
}

async function copyHtml(source, destination, replacements = []) {
  let html = await readFile(source, 'utf8');
  for (const [from, to] of replacements) html = html.split(from).join(to);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, html);
}

const indexSource = await requirePath('index.html');
const socialPreviewSource = await requirePath('.github/social-preview.png');
const faviconSource = await requirePath('favicon.svg');
await requirePath('dist/index.js');
await requirePath('dist/styles.css');
await requirePath('styles/demo.css');

await rm(docsRoot, { recursive: true, force: true });
await mkdir(resolve(docsRoot, 'styles'), { recursive: true });
await mkdir(resolve(docsRoot, 'dist'), { recursive: true });
await cp(resolve(projectRoot, 'dist'), resolve(docsRoot, 'dist'), {
  recursive: true,
  filter: async (source) => {
    const details = await stat(source);
    return (
      details.isDirectory() ||
      source.endsWith('.js') ||
      source.endsWith('.js.map') ||
      source.endsWith('.css')
    );
  },
});
await cp(resolve(projectRoot, 'styles/demo.css'), resolve(docsRoot, 'styles/demo.css'));
await cp(socialPreviewSource, resolve(docsRoot, 'social-preview.png'));
await cp(faviconSource, resolve(docsRoot, 'favicon.svg'));
await copyHtml(indexSource, resolve(docsRoot, 'index.html'));

await writeFile(resolve(docsRoot, '.nojekyll'), '');
await requirePath('docs/index.html');
