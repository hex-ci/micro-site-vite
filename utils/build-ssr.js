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
  const ssrPath = `${serverConfig.ssrUrlPrefix}/${projectName}`;

  try {
    fs.accessSync(resolve(`src/${ssrPath}`));
  }
  catch (e) {
    console.log(chalk.yellow('\n项目不存在！\n'));

    process.exit(1);
  }

  const devConfig = await (await import('../config/config.dev.js')).default();

  const clientViteConfig = (await loadConfigFromFile()).config;
  const serverViteConfig = (await loadConfigFromFile()).config;

  const clientBuildConfig = mergeConfig(clientViteConfig, {
    plugins: [renameHtml()],
    base: `${devConfig.cdnUrlPrefix}${ssrPath}/`,
    resolve: {
      alias: {
        '@current': resolve(`src/${ssrPath}`)
      }
    },
    build: {
      ssrManifest: true,
      outDir: `dist/${ssrPath}`,
      rollupOptions: {
        input: `src/${ssrPath}/index.html`
      }
    }
  });

  const serverBuildConfig = mergeConfig(serverViteConfig, {
    base: `${devConfig.cdnUrlPrefix}${ssrPath}/`,
    resolve: {
      alias: {
        '@current': resolve(`src/${ssrPath}`)
      }
    },
    build: {
      ssr: true,
      emptyOutDir: false,
      outDir: `dist/${ssrPath}/server`,
      rollupOptions: {
        input: `src/${ssrPath}/entry-server.js`
      }
    }
  });

  try {
    console.log(chalk.cyanBright('\n构建 Client...\n'));

    await build({
      configFile: false,
      ...clientBuildConfig
    });

    console.log(chalk.cyanBright('\n构建 Server...\n'));

    await build({
      configFile: false,
      ...serverBuildConfig
    });

    await cpy([resolve(`dist/${ssrPath}/**/*`), '!**/*.html', '!**/ssr-manifest.json', '!**/server/**'], resolve(`dist/${serverConfig.resUrlPrefix}/${ssrPath}`));
    await deleteAsync([resolve(`dist/${ssrPath}/**/*`), '!**/*.html', '!**/ssr-manifest.json', '!**/server/**']);

    await cpy([resolve(`src/${ssrPath}/*.html`), '!**/index.html'], resolve(`dist/${ssrPath}`));

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
