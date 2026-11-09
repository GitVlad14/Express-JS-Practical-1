import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.resolve(projectDir, '..', 'express');
if (fs.existsSync(path.join(target, 'lib', 'response.js'))) {
  console.log(`Express.js уже є: ${target}`);
  process.exit(0);
}
if (fs.existsSync(target)) {
  console.error(`Папка ${target} вже існує, але це не коректний репозиторій Express.js. Перевір її вручну.`);
  process.exit(2);
}
const command = process.platform === 'win32' ? 'git.exe' : 'git';
const child = spawnSync(command, ['clone', 'https://github.com/expressjs/express.git', target], {stdio:'inherit'});
if (child.error) console.error('Помилка запуску Git:', child.error.message);
process.exit(child.status ?? 1);
