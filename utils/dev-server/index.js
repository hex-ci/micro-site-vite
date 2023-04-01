import path from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';
import compress from 'compression';
import express from 'express';
import qs from 'qs';
import cbT from 'cb-template';

import getNormalRouter from './normal.js';
import getSsrRouter  from './ssr.js';

import config from '../../server/config/index.js';

export default async function createServer({ app, server }) {
  const devConfig = await (await import('../../config/config.dev.js')).default();

  app.locals.serverConfig.normalProjectPath = path.join(devConfig.projectPath, config.normalUrlPrefix);
  app.locals.serverConfig.ssrProjectPath = path.join(devConfig.projectPath, config.ssrUrlPrefix);
  app.locals.serverConfig.baseApiUrl = devConfig.baseApiUrl;
  app.locals.serverConfig.projectPath = devConfig.projectPath;

  // 设置全局 cbT basePath
  cbT.basePath = devConfig.projectPath;

  app.use(compress());

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

  app.use('/favicon.ico', (req, res) => {
    res.sendFile(path.join(devConfig.root, 'favicon.ico'));
  });
  app.use(express.static(devConfig.publicPath));

  // 用于非 SSR 的中间件
  app.use(getNormalRouter({ devConfig, server}));

  // 用于 SSR 的中间件
  app.use(getSsrRouter({ devConfig, server }));

  // 用于显示首页
  app.use(getSsrRouter({ isHomeProject: true, devConfig, server }));

  return {
    host: devConfig.host,
    port: devConfig.port
  };
}
