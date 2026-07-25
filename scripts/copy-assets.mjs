import { cp, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function requireFile(path) {
  const file = resolve(projectRoot, path);
  const details = await stat(file).catch(() => null);
  if (!details?.isFile()) throw new Error(`Required asset is missing: ${path}`);
  return file;
}

await mkdir(resolve(projectRoot, 'dist/styles'), { recursive: true });
await cp(await requireFile('src/styles.css'), resolve(projectRoot, 'dist/styles.css'));
await cp(
  resolve(projectRoot, 'styles/addons'),
  resolve(projectRoot, 'dist/styles/addons'),
  { recursive: true },
);
await cp(
  resolve(projectRoot, 'styles/themes'),
  resolve(projectRoot, 'dist/styles/themes'),
  { recursive: true },
);

