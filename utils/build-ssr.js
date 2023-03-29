import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { build, loadConfigFromFile, mergeConfig } from 'vite';
import chalk from 'chalk';
import cpy from 'cpy';
import { deleteAsync } from 'del';

import serverConfig from '../server/config/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const argv = process.argv;

const microSitePlugin = () => {
  return {
    name: 'vite-plugin-micro-site',
    apply: 'build',
    enforce: 'post',

    generateBundle(_, bundle) {
      for (const key in bundle) {
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
    fs.accessSync(resolve(`src/${serverConfig.ssrUrlPrefix}/${projectName}`));
  }
  catch (e) {
    console.log(chalk.yellow('\n项目不存在！\n'));

    process.exit(1);
  }

  const devConfig = await (await import('../config/config.dev.js')).default();

  const clientViteConfig = (await loadConfigFromFile()).config;
  const serverViteConfig = (await loadConfigFromFile()).config;

  const clientBuildConfig = mergeConfig(clientViteConfig, {
    plugins: [microSitePlugin()],
    base: `${devConfig.cdnUrlPrefix}${serverConfig.ssrUrlPrefix}/${projectName}/`,
    build: {
      ssrManifest: true,
      outDir: `dist/${serverConfig.ssrUrlPrefix}/${projectName}/client`,
      rollupOptions: {
        input: `src/${serverConfig.ssrUrlPrefix}/${projectName}/index.html`
      }
    }
  });

  const serverBuildConfig = mergeConfig(serverViteConfig, {
    base: `${devConfig.cdnUrlPrefix}${serverConfig.ssrUrlPrefix}/${projectName}/`,
    build: {
      ssr: true,
      outDir: `dist/${serverConfig.ssrUrlPrefix}/${projectName}/server`,
      rollupOptions: {
        input: `src/${serverConfig.ssrUrlPrefix}/${projectName}/entry-server.js`
      }
    }
  });

  try {
    console.log(chalk.cyanBright('\n构建 Server...\n'));

    await build({
      configFile: false,
      ...serverBuildConfig
    });

    console.log(chalk.cyanBright('\n构建 Client...\n'));

    await build({
      configFile: false,
      ...clientBuildConfig
    });

    await cpy([resolve(`dist/${serverConfig.ssrUrlPrefix}/${projectName}/client/**/*`), '!**/*.html', '!**/ssr-manifest.json'], resolve(`dist/${serverConfig.resUrlPrefix}/${serverConfig.ssrUrlPrefix}/${projectName}`));
    await deleteAsync([resolve(`dist/${serverConfig.ssrUrlPrefix}/${projectName}/client/**/*`), '!**/*.html', '!**/ssr-manifest.json']);
    await cpy(resolve(`src/${serverConfig.ssrUrlPrefix}/${projectName}/server/**/*.js`), resolve(`dist/${serverConfig.ssrUrlPrefix}/${projectName}/server`));

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
