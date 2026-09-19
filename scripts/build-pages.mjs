import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const item of ['index.html', 'css', 'js', 'models', 'textures', 'ps.json']) {
  await cp(join(root, item), join(dist, item), { recursive: true });
}

const runtimeFiles = [
  ['node_modules/three/build/three.module.js', 'node_modules/three/build/three.module.js'],
  ['node_modules/three/examples/jsm', 'node_modules/three/examples/jsm'],
  ['node_modules/quarks.core/dist/quarks.core.esm.js', 'node_modules/quarks.core/dist/quarks.core.esm.js'],
  ['node_modules/three.quarks/dist/three.quarks.esm.js', 'node_modules/three.quarks/dist/three.quarks.esm.js']
];

for (const [from, to] of runtimeFiles) {
  await mkdir(dirname(join(dist, to)), { recursive: true });
  await cp(join(root, from), join(dist, to), { recursive: true });
}

await writeFile(join(dist, '.nojekyll'), '');
console.log(`GitHub Pages artifact ready: ${dist}`);
