import { createServer as createViteServer, loadConfigFromFile, mergeConfig } from 'vite';
import fs from 'node:fs';
import getPort from 'get-port';
import path from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';

import { getMiddleware as getNormalMiddleware, getProjectName } from '../../server/router/normal.js';
import config from '../../server/config/index.js';

const viteServerCache = {};
const webSocketServerCache = {};
const webSocketClientCache = {};
const processedRequests = new Set();

export default function getMiddleware({ devConfig, server } = {}) {
  const middleware = async (req, res, next) => {
    const url = req.originalUrl;
    const normalPath = req.app.locals.serverConfig.normalProjectPath;

    if (url.indexOf(`/${config.normalUrlPrefix}/`) === 0) {
      const projectName = await getProjectName(url, normalPath);

      if (!projectName) {
        return next();
      }

      // 准备 vite server

      let viteServer;

      if (viteServerCache[projectName]) {
        viteServer = viteServerCache[projectName];
      }
      else {
        const port = await getPort();
        const defaultViteConfig = (await loadConfigFromFile()).config;

        let viteConfig = mergeConfig(defaultViteConfig, {
          base: `/__micro-site-normal__/${projectName}/__`,
          cacheDir: `node_modules/.vite/micro-site-cache/normal/${projectName}`,
          server: {
            middlewareMode: true,
            hmr: {
              path: `/__ws__`,
              port,
              clientPort: devConfig.clientPort
            },
            watch: {
              usePolling: true,
              interval: 300
            }
          },
          appType: 'custom',
          resolve: {
            alias: {
              '@current': path.join(normalPath, projectName)
            }
          }
        });

        const myViteConfigPath = path.join(normalPath, `${projectName}/my-vite.config.js`);

        if (fs.existsSync(myViteConfigPath)) {
          viteConfig = (await import(myViteConfigPath)).default(viteConfig, { mode: 'development', ssrBuild: false });
        }

        viteServer = await createViteServer({
          configFile: false,
          ...viteConfig
        });

        viteServerCache[projectName] = viteServer;
      }

      // 准备 html

      const middleware = getNormalMiddleware({ viteServer });

      middleware(req, res, next);
    }
    else if (url.indexOf(`/__micro-site-normal__/`) === 0) {
      const match = /\/__micro-site-normal__\/(.+?)\/__\//i.exec(url);

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
    else {
      next();
    }
  }

  // 处理 WebSocket 转发
  server.on('upgrade', function upgrade(request, socket, head) {
    const match = /\/__micro-site-normal__\/(.+?)\/__\/__ws__/i.exec(request.url);

    // 不是我的请求，忽略
    if (!match) {
      return;
    }

    const projectName = match[1];

    if (!viteServerCache[projectName]) {
      return;
    }

    const key = request.headers['sec-websocket-key'];

    if (processedRequests.has(key)) {
      socket.destroy();
      return;
    }

    processedRequests.add(key);

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
        const wsProxy = new WebSocket(`ws://127.0.0.1:${port}/__micro-site-normal__/${projectName}/__/__ws__`);

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

  return middleware;
}
