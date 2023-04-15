import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { createServer as createViteServer, loadConfigFromFile, mergeConfig } from 'vite';
import getPort from 'get-port';
import { WebSocket, WebSocketServer } from 'ws';
import checker from 'vite-plugin-checker';

import { getMiddleware as getNormalMiddleware, getProjectInfo } from '../../server/middleware/normal.js';

const viteServerCache = {};
const webSocketServerCache = {};
const webSocketClientCache = {};
const processedRequests = new Set();

export default function getMiddleware({ devConfig, server } = {}) {
  const middleware = async (req, res, next) => {
    const url = req.originalUrl;
    const projectRootPath = req.app.locals.serverConfig.normalProjectPath;

    if (url.startsWith('/__micro-site-normal__/')) {
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
    else if (url.startsWith('/__micro-site-ssr__/')) {
      // SSR 项目跳过
      next();
    }
    else {
      const projectInfo = await getProjectInfo(req._parsedOriginalUrl.pathname, projectRootPath);

      if (!projectInfo) {
        return next();
      }

      // 准备 vite server

      let viteServer;

      if (viteServerCache[projectInfo.projectName]) {
        viteServer = viteServerCache[projectInfo.projectName];
      }
      else {
        const port = await getPort();
        const defaultViteConfig = (await loadConfigFromFile()).config;

        let clientPort;

        if (devConfig.clientPort) {
          clientPort = devConfig.clientPort;
        }
        else if (req.headers['x-forwarded-port']) {
          clientPort = req.headers['x-forwarded-port'];
        }
        else if (req.headers['x-forwarded-scheme'] == 'http') {
          clientPort = 80;
        }
        else if (req.headers['x-forwarded-scheme'] == 'https') {
          clientPort = 443;
        }
        else {
          clientPort = devConfig.port;
        }

        const projectFullPath = join(projectRootPath, projectInfo.projectName);

        let viteConfig = mergeConfig(defaultViteConfig, {
          plugins: [
            checker({
              // vueTsc: true,
              eslint: {
                lintCommand: `eslint "${projectFullPath}/**/*.{ts,tsx,vue,js}"`
              },
              stylelint: {
                lintCommand: `stylelint ${projectFullPath}/**/*.{scss,css,vue} --quiet-deprecation-warnings`
              }
            })
          ],
          base: `/__micro-site-normal__/${projectInfo.projectName}/__`,
          cacheDir: `node_modules/.vite/micro-site-cache/normal/${projectInfo.projectName}`,
          server: {
            middlewareMode: true,
            hmr: {
              path: `/__ws__`,
              port,
              clientPort
            },
            watch: {
              usePolling: true,
              interval: 300
            }
          },
          appType: 'custom',
          resolve: {
            alias: {
              '@current': projectFullPath
            }
          }
        });

        const myViteConfigPath = join(projectRootPath, `${projectInfo.projectName}/my-vite.config.js`);

        if (existsSync(myViteConfigPath)) {
          viteConfig = (await import(myViteConfigPath)).default(viteConfig, { mode: 'development', ssrBuild: false });
        }

        viteServer = await createViteServer({
          configFile: false,
          ...viteConfig
        });

        viteServerCache[projectInfo.projectName] = viteServer;
      }

      // 准备 html

      const middleware = getNormalMiddleware({ viteServer });

      middleware(req, res, next);
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
