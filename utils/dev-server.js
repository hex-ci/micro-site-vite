import path from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';
import compress from 'compression';
import express from 'express';
import qs from 'qs';
import { createServer as createViteServer } from 'vite';

import getNormalRouter from '../server/router/normal.js';
import getSsrRouter  from '../server/router/ssr.js';

import config from '../server/config/index.js';

export default async function createServer({ app, server }) {
  const devConfig = await (await import('../config/config.dev.js')).default();

  app.locals.serverConfig.normalProjectPath = path.join(devConfig.projectPath, config.normalUrlPrefix);
  app.locals.serverConfig.ssrProjectPath = path.join(devConfig.projectPath, config.ssrUrlPrefix);
  app.locals.serverConfig.baseApiUrl = devConfig.baseApiUrl;

  // 开发环境创建开发服务器
  const viteServer = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: {
        server
      }
    },
    appType: 'custom'
  });

  app.use(compress());
  app.use(viteServer.middlewares);
  app.use(express.static(devConfig.publicPath));
  app.use('/favicon.ico', (req, res) => {
    res.sendFile(path.join(devConfig.root, 'favicon.ico'));
  });

  // api 接口代理中间件
  app.use(createProxyMiddleware('/api/', {
    target: devConfig.baseApiUrl,
    changeOrigin: true,
    onProxyReq(proxyReq, req) {
      // 处理 http-proxy-middleware 和 body-parser 冲突的问题

      if (!req.body || !Object.keys(req.body).length) {
        return;
      }

      const contentType = proxyReq.getHeader('Content-Type');

      const writeBody = (bodyData) => {
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      };

      if (contentType.includes('application/json')) {
        writeBody(JSON.stringify(req.body));
      }
      else if (contentType === 'application/x-www-form-urlencoded') {
        writeBody(qs.stringify(req.body));
      }
    }
  }));

  // 用于非 SSR 的中间件
  app.use(`/${config.normalUrlPrefix}/*`, getNormalRouter({ viteServer }));

  // 用于 SSR 的中间件
  app.use(`/${config.ssrUrlPrefix}/*`, getSsrRouter({ viteServer }));

  // 用于显示首页
  app.use(new RegExp(`^(\/|\/${config.homeProject}\/.*)$`, 'i'), getSsrRouter({ isHomeProject: true, viteServer }));

  return {
    host: devConfig.host,
    port: devConfig.port
  };
}
