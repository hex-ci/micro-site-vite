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
  const normalProjectPath = `${serverConfig.normalUrlPrefix}/${projectName}`;

  try {
    fs.accessSync(resolve(`src/${normalProjectPath}`));
  }
  catch (e) {
    console.log(chalk.yellow('\n项目不存在！\n'));

    process.exit(1);
  }

  const devConfig = await (await import('../config/config.dev.js')).default();

  const defaultConfig = (await loadConfigFromFile()).config;

  const buildConfig = mergeConfig(defaultConfig, {
    plugins: [renameHtml()],
    base: `${devConfig.cdnUrlPrefix}${normalProjectPath}/`,
    resolve: {
      alias: {
        '@current': resolve(`src/${normalProjectPath}`)
      }
    },
    build: {
      outDir: `dist/${normalProjectPath}`,
      rollupOptions: {
        input: `src/${normalProjectPath}/index.html`
      }
    }
  });

  try {
    await build({
      configFile: false,
      ...buildConfig
    });

    await cpy([resolve(`dist/${normalProjectPath}/**/*`), '!**/*.html'], resolve(`dist/${serverConfig.resUrlPrefix}/${normalProjectPath}`));
    await deleteAsync([resolve(`dist/${normalProjectPath}/**/*`), '!**/*.html']);
    await cpy(resolve(`src/${normalProjectPath}/server/**/*.js`), resolve(`dist/${normalProjectPath}/server`));

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
