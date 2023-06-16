import { resolve as pathResolve, join } from 'node:path';
import { accessSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { build, loadConfigFromFile, mergeConfig } from 'vite';
import chalk from 'chalk';
import cpy from 'cpy';
import { deleteAsync } from 'del';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';
import checker from 'vite-plugin-checker';

import renameHtml from './vite-plugin-rename-html.js';
import uploadAlioss from './vite-plugin-upload-alioss.js';
import { getDefineByEnv } from './helper.js';

import serverConfig from '../server/config/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const argv = process.argv;
const currentBuildMode = process.env.MICRO_SITE_BUILD_MODE || 'production';

process.env.NODE_ENV = 'production';

const resolve = (str) => {
  return pathResolve(__dirname, `../${str}`);
}

const main = async () => {
  if (argv.length < 3) {
    console.log(chalk.yellow('\n请输入要构建的项目！\n'));

    process.exit(1);
  }

  const projectName = argv[2];
  const ssrProjectPath = `${serverConfig.ssrFolderPrefix}/${projectName}`;
  const ssrProjectFullPath = resolve(`src/${ssrProjectPath}`);
  const define = getDefineByEnv(currentBuildMode, ssrProjectFullPath);

  try {
    accessSync(ssrProjectFullPath);
  }
  catch (e) {
    console.log(chalk.yellow('\n项目不存在！\n'));

    process.exit(1);
  }

  const devConfig = await (await import('../config/config.dev.js')).default();

  const clientViteConfig = (await loadConfigFromFile()).config;
  const serverViteConfig = (await loadConfigFromFile()).config;

  let clientBuildConfig = mergeConfig(clientViteConfig, {
    plugins: [
      checker({
        vueTsc: true,
        eslint: {
          lintCommand: `eslint "${ssrProjectFullPath}/**/*.{ts,tsx,vue,js}"`
        },
        stylelint: {
          lintCommand: `stylelint ${ssrProjectFullPath}/**/*.{scss,css,vue} --quiet-deprecation-warnings`
        }
      }),
      renameHtml(),
      ViteImageOptimizer({
        png: {
          quality: 80
        },
        jpeg: {
          quality: 80
        },
        jpg: {
          quality: 80
        }
      }),
      process.env.MICRO_SITE_USE_CDN === 'yes' && uploadAlioss({
        oss: {
          ...devConfig.ossOptions
        },
        urlPrefix: devConfig.cdnUrlPrefix,
        asset: 'dist'
      })
    ],
    mode: currentBuildMode,
    base: `${devConfig.cdnUrlPrefix}${ssrProjectPath}/`,
    define,
    resolve: {
      alias: {
        '@current': ssrProjectFullPath
      }
    },
    build: {
      ssrManifest: true,
      outDir: `dist/${ssrProjectPath}`,
      rollupOptions: {
        input: `src/${ssrProjectPath}/index.html`
      }
    },
  });

  let serverBuildConfig = mergeConfig(serverViteConfig, {
    mode: currentBuildMode,
    base: `${devConfig.cdnUrlPrefix}${ssrProjectPath}/`,
    define,
    resolve: {
      alias: {
        '@current': ssrProjectFullPath
      }
    },
    build: {
      ssr: true,
      emptyOutDir: false,
      outDir: `dist/${ssrProjectPath}/server`,
      rollupOptions: {
        input: `src/${ssrProjectPath}/entry-server.js`
      }
    },
  });

  const myViteConfigPath = resolve(join('src', ssrProjectPath, 'my-vite.config.js'));

  if (existsSync(myViteConfigPath)) {
    const myViteConfig = (await import(myViteConfigPath)).default;

    clientBuildConfig = myViteConfig(clientBuildConfig, { mode: 'build', ssrBuild: false });
    serverBuildConfig = myViteConfig(serverBuildConfig, { mode: 'build', ssrBuild: true });
  }

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

    if (process.env.MICRO_SITE_USE_CDN !== 'yes') {
      await cpy([resolve(`dist/${ssrProjectPath}/**/*`), '!**/*.html', '!**/ssr-manifest.json', '!**/server/**'], resolve(`dist/${serverConfig.resUrlPrefix}/${ssrProjectPath}`));
    }
    await deleteAsync([resolve(`dist/${ssrProjectPath}/**/*`), '!**/*.html', '!**/ssr-manifest.json', '!**/server/**']);

    await cpy([resolve(`src/${ssrProjectPath}/*.html`), '!**/index.html'], resolve(`dist/${ssrProjectPath}`));

    await cpy(resolve('public/**'), resolve('dist/public'));
    await cpy(resolve('server/**'), resolve('dist/server'));
    await cpy([
      resolve('package.json'),
      resolve('pnpm-lock.yaml')
    ], resolve('dist'));
  }
  catch (e) {
    console.log(e);
  }
}

main();
