// 语法检查：对受维护的游戏代码跑 node --check（不执行、不解析 import）
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['js', 'scripts', 'test'];
let failed = 0, checked = 0;
for (const d of DIRS) {
  let files = [];
  try { files = readdirSync(join(ROOT, d)).filter(f => f.endsWith('.js') || f.endsWith('.mjs')); }
  catch { continue; }
  for (const f of files) {
    const fp = join(ROOT, d, f);
    const r = spawnSync(process.execPath, ['--check', fp], { encoding: 'utf8' });
    checked++;
    if (r.status !== 0) { failed++; console.error('SYNTAX FAIL', d + '/' + f); console.error(r.stderr); }
    else console.log('ok', d + '/' + f);
  }
}
console.log(`\nsyntax check: ${checked - failed}/${checked} files passed`);
process.exit(failed ? 1 : 0);
