import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import js from '@eslint/js';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.resolve(projectDir, '..', 'express', 'lib');
const files = ['application.js', 'express.js', 'request.js', 'response.js', 'utils.js', 'view.js'];
if (!files.every(f => fs.existsSync(path.join(sourceDir, f)))) {
  console.error(`Не знайдено код Express.js у ${sourceDir}. Запусти npm.cmd run setup:express.`);
  process.exit(2);
}
const eslint = new ESLint({
  cwd: projectDir,
  overrideConfigFile: true,
  overrideConfig: [{
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest', sourceType: 'commonjs',
      globals: {module:'readonly',exports:'writable',require:'readonly',process:'readonly',
        Buffer:'readonly',__dirname:'readonly',__filename:'readonly',console:'readonly',
        setTimeout:'readonly',clearTimeout:'readonly',setImmediate:'readonly',
        URL:'readonly',URLSearchParams:'readonly'}
    },
    rules: {...js.configs.recommended.rules, 'no-unused-vars':'warn', 'no-undef':'warn'}
  }]
});
const result = [];
for (const f of files) {
  const content = fs.readFileSync(path.join(sourceDir,f), 'utf8');
  const [entry] = await eslint.lintText(content, {filePath: path.join(projectDir, f), warnIgnored: false});
  if (!entry) throw new Error(`Не отримано аналіз файлу ${f}`);
  entry.filePath = path.join(sourceDir,f);
  result.push(entry);
}
const dir = path.join(projectDir, 'results');
fs.mkdirSync(dir,{recursive:true});
const out = path.join(dir,'eslint.json');
fs.writeFileSync(out, JSON.stringify(result,null,2)+'\n','utf8');
const count = result.reduce((a,x)=>a+x.errorCount+x.warningCount,0);
console.log(`ESLint: оброблено ${result.length} файлів, ${count} повідомлень; результат ${out}`);
