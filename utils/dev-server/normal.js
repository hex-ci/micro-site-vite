import { createServer as createViteServer } from 'vite';
import getPort from 'get-port';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';

import { getMiddleware as getNormalMiddleware, getProjectName } from '../../server/router/normal.js';
import config from '../../server/config/index.js';

const viteServerCache = {};

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

        const proxy = createProxyMiddleware(`/__micro-site-normal__/${projectName}/__/__ws__`, {
          target: `ws://127.0.0.1:${port}`,
          // changeOrigin: true
        });
        server.on('upgrade', proxy.upgrade);

        viteServer = await createViteServer({
          base: `/__micro-site-normal__/${projectName}/__`,
          cacheDir: `node_modules/.vite/micro-site-cache/normal/${projectName}`,
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
              '@current': path.join(normalPath, projectName)
            }
          }
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

  return middleware;
}
