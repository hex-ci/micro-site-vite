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
  const normalProjectPath = `${serverConfig.normalFolderPrefix}/${projectName}`;
  const normalProjectFullPath = resolve(`src/${normalProjectPath}`);
  const define = getDefineByEnv('production', normalProjectFullPath);

  try {
    accessSync(normalProjectFullPath);
  }
  catch (e) {
    console.log(chalk.yellow('\n项目不存在！\n'));

    process.exit(1);
  }

  const devConfig = await (await import('../config/config.dev.js')).default();
  const defaultConfig = (await loadConfigFromFile()).config;

  let buildConfig = mergeConfig(defaultConfig, {
    plugins: [
      checker({
        vueTsc: true,
        eslint: {
          lintCommand: `eslint "${normalProjectFullPath}/**/*.{ts,tsx,vue,js}"`
        },
        stylelint: {
          lintCommand: `stylelint ${normalProjectFullPath}/**/*.{scss,css,vue} --quiet-deprecation-warnings`
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
    base: `${devConfig.cdnUrlPrefix}${normalProjectPath}/`,
    define,
    resolve: {
      alias: {
        '@current': normalProjectFullPath
      }
    },
    build: {
      outDir: `dist/${normalProjectPath}`,
      rollupOptions: {
        input: `src/${normalProjectPath}/index.html`
      }
    },
  });

  const myViteConfigPath = resolve(join('src', normalProjectPath, 'my-vite.config.js'));

  if (existsSync(myViteConfigPath)) {
    buildConfig = (await import(myViteConfigPath)).default(buildConfig, { mode: 'build', ssrBuild: false });
  }

  try {
    await build({
      configFile: false,
      ...buildConfig
    });

    if (process.env.MICRO_SITE_USE_CDN !== 'yes') {
      await cpy([resolve(`dist/${normalProjectPath}/**/*`), '!**/*.html'], resolve(`dist/${serverConfig.resUrlPrefix}/${normalProjectPath}`));
    }
    await deleteAsync([resolve(`dist/${normalProjectPath}/**/*`), '!**/*.html']);
    await cpy(resolve(`src/${normalProjectPath}/server/**/*.js`), resolve(`dist/${normalProjectPath}/server`));

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
