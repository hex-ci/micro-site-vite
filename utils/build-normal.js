import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { build, loadConfigFromFile } from 'vite';
import chalk from 'chalk';
import cpy from 'cpy';
import { deleteAsync } from 'del';

import devConfig from '../config/config.dev.js';
import serverConfig from '../server/config/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const argv = process.argv;

const microSitePlugin = (projectName) => {
  return {
    name: 'vite-plugin-micro-site',
    apply: 'build',
    enforce: 'post',

    generateBundle(_, bundle) {
      for (const key in bundle) {
        console.log(key);
        if (key.endsWith('.html')) {
          bundle[key].fileName = path.basename(key);
        }
      }
    }
  }
}

const resolve = (str) => {
  return path.resolve(__dirname, `../${str}`);
}

const main = async () => {
  if (argv.length < 3) {
    console.log(chalk.yellow('\n请输入要构建的项目！\n'));

    process.exit(1);
  }

  const projectName = argv[2];

  try {
    fs.accessSync(resolve(`src/${serverConfig.normalUrlPrefix}/${projectName}`));
  }
  catch (e) {
    console.log(chalk.yellow('\n项目不存在！\n'));

    process.exit(1);
  }

  const defaultConfig = (await loadConfigFromFile()).config;

  // console.log(defaultConfig);

  defaultConfig.plugins.push(microSitePlugin());
  defaultConfig.base = `${devConfig.cdnUrlPrefix}${serverConfig.normalUrlPrefix}/${projectName}/`;
  defaultConfig.build = {
    outDir: `dist/${serverConfig.normalUrlPrefix}/${projectName}`,
    rollupOptions: {
      input: `src/${serverConfig.normalUrlPrefix}/${projectName}/index.html`,
    }
  };

  try {
    await build({
      configFile: false,
      ...defaultConfig
    });

    await cpy([resolve(`dist/${serverConfig.normalUrlPrefix}/${projectName}/**/*`), '!**/*.html'], resolve(`dist/assets/${serverConfig.normalUrlPrefix}/${projectName}`));
    await deleteAsync([resolve(`dist/${serverConfig.normalUrlPrefix}/${projectName}/**/*`), '!**/*.html']);

    await cpy(resolve(`src/${serverConfig.normalUrlPrefix}/${projectName}/server/**/*.js`), resolve(`dist/${serverConfig.normalUrlPrefix}/${projectName}/server`));
    await cpy(resolve('public/**'), resolve('dist/public'));
    await cpy(resolve('server/**'), resolve('dist/server'));
    await cpy([
      resolve('package.json'),
      resolve('ecosystem.config.js'),
      resolve('pnpm-lock.yaml')
    ], resolve('dist'));
  }
  catch (e) {
    console.log(e);
  }
}

main();
