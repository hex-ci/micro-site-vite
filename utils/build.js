import { resolve as pathResolve, join } from 'node:path';
import { accessSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

import { build, loadConfigFromFile, mergeConfig } from 'vite';
import chalk from 'chalk';
import cpy from 'cpy';
import { deleteAsync } from 'del';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';
import * as esbuild from 'esbuild';
import { globSync } from 'glob';

import renameHtml from './vite-plugin-rename-html.js';
import uploadAlioss from './vite-plugin-upload-alioss.js';
import { getDefineByEnv, importProjectViteConfig } from './helper.js';

import serverConfig from '../server/config/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const argv = process.argv;
const currentBuildMode = process.env.MICRO_SITE_BUILD_MODE || 'production';

process.env.NODE_ENV = 'production';

const resolve = (str) => {
  return pathResolve(__dirname, `../${str}`);
}

const run = async ({ type, name, base }) => {
  const projectType = type;
  const projectName = name;
  const projectFullPath = resolve(`src/${projectName}`);
  const define = getDefineByEnv(currentBuildMode, projectFullPath);

  console.log(chalk.yellowBright(`\n\n开始构建 ${name} 项目...`));

  try {
    accessSync(projectFullPath);
  }
  catch (e) {
    console.log(chalk.yellow('\n项目不存在！\n'));

    process.exit(1);
  }

  const devConfig = await (await import('../config/config.dev.js')).default();
  const defaultConfig = (await loadConfigFromFile()).config;

  let buildConfig = mergeConfig(defaultConfig, {
    plugins: [
      renameHtml(),
      ViteImageOptimizer({
        png: {
          quality: 80,
        },
        jpeg: {
          quality: 80,
        },
        jpg: {
          quality: 80,
        },
        cache: true,
        cacheLocation: join(homedir(), '.cache', 'vite-plugin-image-optimizer', 'micro-site', projectName),
      }),
      process.env.MICRO_SITE_USE_CDN === 'yes' && uploadAlioss({
        oss: {
          ...devConfig.ossOptions,
        },
        urlPrefix: devConfig.cdnUrlPrefix,
        asset: 'dist/project',
      }),
    ],
    mode: currentBuildMode,
    base: `${devConfig.cdnUrlPrefix}${projectName}/`,
    define: {
      'import.meta.env.MICRO_SITE_BASE_PATH': JSON.stringify(`/src/${name}`),
      'import.meta.env.MICRO_SITE_BASE_URL': JSON.stringify(base ?? ''),
      'import.meta.env.MICRO_SITE_NAME': JSON.stringify(name ?? ''),
      ...define,
    },
    esbuild: {
      drop: ['console', 'debugger'],
    },
    build: {
      ssrManifest: projectType === 'ssr',
      outDir: `dist/project/${projectName}`,
      rollupOptions: {
        input: resolve(`src/${projectName}/index.html`),
      },
    },
  });

  const projectConfig = await importProjectViteConfig(resolve(join('src', projectName)));

  if (projectConfig) {
    buildConfig = projectConfig(buildConfig, { mode: 'build', ssrBuild: false });
  }

  try {
    if (existsSync(resolve(join('src', projectName, 'index.html'))) || existsSync(resolve(join('src', projectName, 'index.template.js')))) {
      console.log(chalk.cyanBright('\n构建 Client...\n'));

      await build({
        configFile: false,
        ...buildConfig,
      });
    }

    if (projectType === 'ssr') {
      console.log(chalk.cyanBright('\n构建 Server...\n'));

      const defaultConfigForServer = (await loadConfigFromFile()).config;

      let buildConfigForServer = mergeConfig(defaultConfigForServer, {
        mode: currentBuildMode,
        base: `${devConfig.cdnUrlPrefix}${projectName}/`,
        define: {
          'import.meta.env.MICRO_SITE_BASE_PATH': JSON.stringify(`/src/${name}`),
          'import.meta.env.MICRO_SITE_BASE_URL': JSON.stringify(base ?? ''),
          'import.meta.env.MICRO_SITE_NAME': JSON.stringify(name ?? ''),
          ...define,
        },
        build: {
          ssr: true,
          sourcemap: false,
          outDir: `dist/project/${projectName}/server`,
          rollupOptions: {
            input: resolve(`src/${projectName}/entry-server.ts`),
          },
        },
      });

      if (projectConfig) {
        buildConfigForServer = projectConfig(buildConfigForServer, { mode: 'build', ssrBuild: true });
      }

      await build({
        configFile: false,
        ...buildConfigForServer,
      });
    }
    else if (projectType === 'normal') {
      const files = globSync(resolve(`src/${projectName}/server/**/*.js`), {
        strict: true,
        nodir: true,
        dot: false,
      });

      await esbuild.build({
        entryPoints: files,
        outdir: `dist/project/${projectName}/server`,
        bundle: false,
        minifyWhitespace: false,
        minifyIdentifiers: false,
        minifySyntax: true,
        sourcemap: false,
        treeShaking: true,
        format: 'esm',
        define: {
          'process.env.NODE_ENV': '"production"',
          'import.meta.env': JSON.stringify({
            MICRO_SITE_BASE_PATH: `/src/${name}`,
            MICRO_SITE_BASE_URL: base ?? '',
            MICRO_SITE_NAME: name ?? '',
            ...getDefineByEnv(currentBuildMode, resolve(''), '', false),
          }),
        },
      });
    }

    if (process.env.MICRO_SITE_USE_CDN !== 'yes') {
      await cpy([resolve(`dist/project/${projectName}/**/*`), '!**/*.html', '!**/.vite', '!**/server/**'], resolve(`dist/${serverConfig.resUrlPrefix}/${projectName}`));
    }

    await deleteAsync([resolve(`dist/project/${projectName}/**/*`), '!**/*.html', '!**/server/**', '!**/*.template.js', '!**/.vite'], { dot: true });

    if (projectType === 'normal') {
      await cpy([resolve(`src/${projectName}/server/**/*`), '!**/*.js'], resolve(`dist/project/${projectName}/server`));
    }
  }
  catch (e) {
    console.error(e);
  }
}

const finallyProcess = async () => {
  await cpy(resolve('public/**'), resolve('dist/public'));
  await cpy(resolve('server/**'), resolve('dist/server'));

  // 优化 server/index.js
  await esbuild.build({
    entryPoints: [resolve('server/index.js')],
    outdir: `dist/server`,
    bundle: false,
    minifyWhitespace: false,
    minifyIdentifiers: false,
    minifySyntax: true,
    sourcemap: false,
    treeShaking: true,
    format: 'esm',
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  await cpy([
    resolve('package.json'),
    resolve('pnpm-lock.yaml'),
    resolve('.npmrc'),
  ], resolve('dist'));

  console.log();
}

const main = async () => {
  if (argv.length < 3) {
    // 构建所有项目
    for (const item of serverConfig.routes) {
      await run(item);
    }

    await finallyProcess();
  }
  else {
    const route = serverConfig.routes.find((item) => item.name === argv[2]);

    if (!route) {
      console.log(chalk.yellow('\n请输入正确的项目名称！\n'));

      process.exit(1);
    }

    await run(route);

    await finallyProcess();
  }
}

main();
