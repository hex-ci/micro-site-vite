import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import cbT from 'cb-template';
import { createServer as createViteServer } from 'vite';
import getPort from 'get-port';
import { createProxyMiddleware } from 'http-proxy-middleware';

import config from '../../server/config/index.js';

const viteServerCache = {};

const searchFolderFromUrl = (url, rootPath) => {
  const urlArray = url.split('/');
  let subPath = '';

  if (url === '/' || urlArray.length < 2) {
    return '';
  }

  for (let index = 2; index <= urlArray.length; index++) {
    subPath = urlArray.slice(1, index).join('/');

    let stat;

    try {
      stat = fs.statSync(path.join(rootPath, subPath));
    }
    catch (e) {
      stat = false;
    }

    if (stat === false || !stat.isDirectory()) {
      subPath = urlArray.slice(1, index - 1).join('/');
      break;
    }
  }

  return subPath;
}

const createViteServerAndGetHtml = async ({ projectName, ssrPath, url, server, devConfig }) => {
  // 准备 vite server

  let viteServer;

  if (viteServerCache[projectName]) {
    viteServer = viteServerCache[projectName];
  }
  else {
    const port = await getPort();

    const proxy = createProxyMiddleware(`/__micro-site-ssr__/${projectName}/__/__ws__`, {
      target: `ws://127.0.0.1:${port}`,
      // changeOrigin: true
    });
    server.on('upgrade', proxy.upgrade);

    viteServer = await createViteServer({
      base: `/__micro-site-ssr__/${projectName}/__`,
      cacheDir: `node_modules/.vite/micro-site-cache/ssr/${projectName}`,
      server: {
        middlewareMode: true,
        hmr: {
          path: `/__ws__`,
          port,
          clientPort: devConfig.port
        },
        watch: {
          usePolling: true,
          interval: 300
        }
      },
      appType: 'custom',
      resolve: {
        alias: {
          '@current': path.join(devConfig.projectPath, config.ssrUrlPrefix, projectName)
        }
      }
    });

    viteServerCache[projectName] = viteServer;
  }

  // 准备 html

  try {
    const render = (await viteServer.ssrLoadModule(path.join(ssrPath, `${projectName}/entry-server.js`))).render;
    const manifest = {};

    const templateData = await render({ url, manifest });

    let html = await readFile(path.join(ssrPath, `${projectName}/index.html`), 'utf-8');
    html = await viteServer.transformIndexHtml(url, html);
    html = cbT.render(html, templateData);

    let styleTag = '';
    viteServer.moduleGraph.idToModuleMap.forEach((module) => {
      if (module.ssrModule && module.id.endsWith('.css')) {
        styleTag += `<style type="text/css" micro-site-ssr-dev data-vite-dev-id="${module.id}">${module.ssrModule.default}</style>`;
      }
    });
    html = html.replace('</head>', `${styleTag}<script>
    window.onload = () => {
      setTimeout(() => {
        document.querySelectorAll('style[micro-site-ssr-dev]').forEach(item => {
          item.remove();
        });
      }, 500);
    }
    </script></head>`);

    return {
      isSuccess: true,
      viteServer,
      html
    };
  }
  catch (e) {
    viteServer.ssrFixStacktrace(e);
    return {
      isSuccess: false,
      viteServer,
      error: e
    };
  }
}

export default function getMiddleware({ devConfig, server, isHomeProject = false } = {}) {
  const middleware = async (req, res, next) => {
    const url = req.originalUrl;
    const ssrPath = req.app.locals.serverConfig.ssrProjectPath;

    if (url.indexOf(`/${config.ssrUrlPrefix}/`) === 0) {
      const realPath = `/${path.relative(`/${config.ssrUrlPrefix}`, url)}`;
      const projectName = searchFolderFromUrl(realPath, `${devConfig.projectPath}/${config.ssrUrlPrefix}`);

      if (!projectName) {
        return next();
      }

      const {isSuccess, html, error } = await createViteServerAndGetHtml({ projectName, ssrPath, url, server, devConfig });

      if (isSuccess) {
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      }
      else {
        console.log(error);
        next(error);
      }
    }
    else if (url.indexOf(`/__micro-site-ssr__/`) === 0) {
      const match = /\/__micro-site-ssr__\/(.+?)\/__\//i.exec(url);

      if (!match) {
        return next();
      }

      const projectName = match[1];

      if (viteServerCache[projectName]) {
        viteServerCache[projectName].middlewares(req, res, next);
      }
      else {
        next();
      }
    }
    else if (isHomeProject) {
      const ssrUrlPrefix = config.ssrUrlPrefix;
      const normalUrlPrefix = config.normalUrlPrefix;
      const resUrlPrefix = config.resUrlPrefix;
      const reg = new RegExp(`^/(${ssrUrlPrefix}|${normalUrlPrefix}|${resUrlPrefix}|__micro-site-ssr__|__micro-site-normal__)(/|$)`);

      if (reg.test(url)) {
        return next();
      }

      const {isSuccess, html, error } = await createViteServerAndGetHtml({ projectName: config.homeProject, ssrPath, url, server, devConfig });

      if (isSuccess) {
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      }
      else {
        console.log(error);
        next(error);
      }
    }
    else {
      next();
    }
  }

  return middleware;
}
