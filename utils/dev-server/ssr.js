import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import cbT from 'cb-template';
import { createServer as createViteServer, loadConfigFromFile, mergeConfig } from 'vite';
import getPort from 'get-port';
import { WebSocket, WebSocketServer } from 'ws';

import config from '../../server/config/index.js';

const viteServerCache = {};
const webSocketServerCache = {};
const webSocketClientCache = {};
const processedRequests = new Set();

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

const createViteServerAndGetHtml = async ({ projectName, ssrPath, url, devConfig }) => {
  // 准备 vite server

  let viteServer;

  if (viteServerCache[projectName]) {
    viteServer = viteServerCache[projectName];
  }
  else {
    const port = await getPort();
    const defaultViteConfig = (await loadConfigFromFile()).config;

    let viteConfig = mergeConfig(defaultViteConfig, {
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

    const myViteConfigPath = path.join(ssrPath, `${projectName}/my-vite.config.js`);

    if (fs.existsSync(myViteConfigPath)) {
      viteConfig = (await import(myViteConfigPath)).default(viteConfig);
    }

    viteServer = await createViteServer({
      configFile: false,
      ...viteConfig
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

      const { isSuccess, html, error } = await createViteServerAndGetHtml({ projectName, ssrPath, url, devConfig });

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

      const { isSuccess, html, error } = await createViteServerAndGetHtml({ projectName: config.homeProject, ssrPath, url, devConfig });

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

  // 只需要在 ssr 路由监听一次即可，否则会导致多次监听 upgrade 事件，导致异常
  if (!isHomeProject) {
    // 处理 WebSocket 转发
    server.on('upgrade', function upgrade(request, socket, head) {
      const match = /\/__micro-site-ssr__\/(.+?)\/__\/__ws__/i.exec(request.url);

      // 不是我的请求，忽略
      if (!match) {
        return;
      }

      const key = request.headers['sec-websocket-key'];

      if (processedRequests.has(key)) {
        socket.destroy();
        return;
      }

      processedRequests.add(key);

      const projectName = match[1];

      let wss;

      if (webSocketServerCache[projectName]) {
        wss = webSocketServerCache[projectName];
      }
      else {
        wss = new WebSocketServer({ noServer: true });

        webSocketServerCache[projectName] = wss;

        wss.on('connection', function connection(ws) {
          if (webSocketClientCache[projectName]) {
            webSocketClientCache[projectName].close();
            webSocketClientCache[projectName] = null;
          }

          const port = viteServerCache[projectName].config.server.hmr.port;
          const wsProxy = new WebSocket(`ws://127.0.0.1:${port}/__micro-site-ssr__/${projectName}/__/__ws__`);

          webSocketClientCache[projectName] = wsProxy;

          // 将 WebSocket 代理客户端的消息转发到客户端
          wsProxy.on('message', (message) => {
            ws.send(message.toString());
          });

          // 将客户端的消息转发到 WebSocket 代理客户端
          ws.on('message', (message) => {
            wsProxy.send(message.toString());
          });

          ws.on('error', console.error);
        });
      }

      wss.handleUpgrade(request, socket, head, (ws, request) => {
        wss.emit('connection', ws, request);
      });
    });
  }

  return middleware;
}
