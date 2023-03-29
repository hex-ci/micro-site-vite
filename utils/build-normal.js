import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { build, loadConfigFromFile, mergeConfig } from 'vite';
import chalk from 'chalk';
import cpy from 'cpy';
import { deleteAsync } from 'del';
import renameHtml from './vite-plugin-rename-html.js';

import serverConfig from '../server/config/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const argv = process.argv;

const resolve = (str) => {
  return path.resolve(__dirname, `../${str}`);
}

const main = async () => {
  if (argv.length < 3) {
    console.log(chalk.yellow('\n请输入要构建的项目！\n'));

    process.exit(1);
  }

  const projectName = argv[2];
  const normalPath = `${serverConfig.normalUrlPrefix}/${projectName}`;

  try {
    fs.accessSync(resolve(`src/${normalPath}`));
  }
  catch (e) {
    console.log(chalk.yellow('\n项目不存在！\n'));

    process.exit(1);
  }

  const devConfig = await (await import('../config/config.dev.js')).default();

  const defaultConfig = (await loadConfigFromFile()).config;

  const buildConfig = mergeConfig(defaultConfig, {
    plugins: [renameHtml()],
    base: `${devConfig.cdnUrlPrefix}${normalPath}/`,
    build: {
      outDir: `dist/${normalPath}`,
      rollupOptions: {
        input: `src/${normalPath}/index.html`
      }
    }
  });

  try {
    await build({
      configFile: false,
      ...buildConfig
    });

    await cpy([resolve(`dist/${normalPath}/**/*`), '!**/*.html'], resolve(`dist/${serverConfig.resUrlPrefix}/${normalPath}`));
    await deleteAsync([resolve(`dist/${normalPath}/**/*`), '!**/*.html']);
    await cpy(resolve(`src/${normalPath}/server/**/*.js`), resolve(`dist/${normalPath}/server`));

    await cpy(resolve('public/**'), resolve('dist/public'));
    await cpy(resolve('server/**'), resolve('dist/server'));
    await cpy([
      resolve('package.json')
    ], resolve('dist'));
  }
  catch (e) {
    console.log(e);
  }
}

main();
