import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import cbT from 'cb-template';
import { createServer as createViteServer, loadConfigFromFile, mergeConfig } from 'vite';
import getPort from 'get-port';
import { WebSocket, WebSocketServer } from 'ws';
import checker from 'vite-plugin-checker';
import parseurl from 'parseurl';

import { getProjectInfo, getProcessMiddlewareForNormal } from '../../server/middleware/index.js';
import { getDefineByEnv, toPosixPath, importProjectViteConfig } from '../helper.js';
import fix502 from '../vite-plugin-fix-502.js';

const viteServerCache = {};
const webSocketServerCache = {};
const webSocketClientCache = {};
const processedRequests = new Set();

export const getMiddleware = ({ devConfig, server } = {}) => {
  const middleware = async (req, res, next) => {
    const url = req.originalUrl;

    if (url.startsWith(`/__micro-site__/`)) {
      const match = /^\/__micro-site__\/(.+?)\/__\//i.exec(url);

      if (!match) {
        return next();
      }

      const projectName = match[1];

      if (viteServerCache[projectName]) {
        viteServerCache[projectName].middlewares.handle(req, res, next);
      }
      else {
        next();
      }
    }
    else {
      const parsedOriginalUrl = parseurl.original(req);

      // 获取项目信息
      const projectInfo = await getProjectInfo(
        parsedOriginalUrl.pathname,
        req.app.locals.serverConfig,
      );

      if (!projectInfo) {
        // 获取失败，继续下一级中间件
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

        const projectFullPath = join(devConfig.projectPath, projectInfo.projectName);
        const define = getDefineByEnv('development', projectFullPath);

        let viteConfig = mergeConfig(defaultViteConfig, {
          plugins: [
            fix502(),
            checker({
              // vueTsc: true,
              eslint: {
                lintCommand: `eslint "${projectFullPath}/**/*.{ts,tsx,vue,js}"`,
              },
              stylelint: {
                lintCommand: `stylelint "${toPosixPath(projectFullPath)}/**/*.{scss,css,vue}" --allow-empty-input`,
              },
            }),
          ],
          base: `/__micro-site__/${projectInfo.projectName}/__`,
          cacheDir: `node_modules/.vite/micro-site-cache/${projectInfo.projectName}`,
          define: {
            'import.meta.env.MICRO_SITE_BASE_PATH': JSON.stringify(`/src/${projectInfo.route.name}`),
            'import.meta.env.MICRO_SITE_BASE_URL': JSON.stringify(projectInfo.route.base ?? ''),
            'import.meta.env.MICRO_SITE_NAME': JSON.stringify(projectInfo.route.name ?? ''),
            ...define,
          },
          server: {
            middlewareMode: true,
            hmr: {
              path: '/__ws__',
              port,
              clientPort,
            },
            watch: {
              usePolling: true,
              interval: 300,
            },
          },
          appType: 'custom',
        });

        const projectConfig = await importProjectViteConfig(projectFullPath);

        if (projectConfig) {
          viteConfig = projectConfig(viteConfig, { mode: 'development', ssrBuild: false });
        }

        viteServer = await createViteServer({
          configFile: false,
          ...viteConfig,
        });

        viteServerCache[projectInfo.projectName] = viteServer;
      }

      // 准备 html

      if (projectInfo.route.type === 'ssr') {
        try {
          const render = (await viteServer.ssrLoadModule(projectInfo.serverEntry)).render;
          const manifest = {};

          const templateData = await render({ url, manifest, request: req, response: res });

          if (templateData === false) {
            return;
          }

          let html = await readFile(projectInfo.template, 'utf-8');
          html = await viteServer.transformIndexHtml(url, html);
          html = cbT.render(html, templateData);

          let styleTag = '';
          viteServer.moduleGraph.idToModuleMap.forEach((module) => {
            if (module.ssrModule && /\.(css|scss|sass|less|styl)$/i.test(module.id)) {
              styleTag += `<style type="text/css" data-micro-site-dev-id="${module.id}">${module.ssrModule.default}</style>`;
            }
          });
          html = html.replace('</head>', `${styleTag}<script>
            window.onload = () => {
              setTimeout(() => {
                document.querySelectorAll('style[data-micro-site-dev-id]').forEach(item => {
                  item.remove();
                });
              }, 1000);
            }
            </script></head>`);

          res.status(templateData?.httpStatusCode || 200).set({
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          }).end(html);
        }
        catch (e) {
          viteServer.ssrFixStacktrace(e);
          console.error(e);
          next(e);
        }
      }
      else if (projectInfo.route.type === 'normal') {
        const middleware = getProcessMiddlewareForNormal(projectInfo, viteServer);

        middleware(req, res, next);
      }
      else {
        next();
      }
    }
  }

  // 处理 WebSocket 转发
  server.on('upgrade', function upgrade(request, socket, head) {
    const match = /^\/__micro-site__\/(.+?)\/__\/__ws__/i.exec(request.url);

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
        const wsProxy = new WebSocket(`ws://127.0.0.1:${port}/__micro-site__/${projectName}/__/__ws__`);

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

      wss.on('error', console.error);
    }

    wss.handleUpgrade(request, socket, head, (ws, request) => {
      wss.emit('connection', ws, request);
    });
  });

  return middleware;
}
