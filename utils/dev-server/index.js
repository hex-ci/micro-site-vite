import { join } from 'node:path';

import { createProxyMiddleware } from 'http-proxy-middleware';
import compress from 'compression';
import express from 'express';
import qs from 'qs';
import cbT from 'cb-template';

import getNormalMiddleware from './normal.js';
import getSsrMiddleware  from './ssr.js';

import config from '../../server/config/index.js';

// 处理 http-proxy-middleware 和 body-parser 冲突的问题
const onProxyReq = (proxyReq, req) => {
  if (!req.body) {
    return;
  }

  const contentType = proxyReq.getHeader('Content-Type') || '';

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

export default async function createServer({ app, server }) {
  const devConfig = await (await import('../../config/config.dev.js')).default();

  app.locals.serverConfig.normalProjectPath = join(devConfig.projectPath, config.normalFolderPrefix);
  app.locals.serverConfig.ssrProjectPath = join(devConfig.projectPath, config.ssrFolderPrefix);
  app.locals.serverConfig.projectPath = devConfig.projectPath;

  // 设置全局 cbT basePath
  cbT.basePath = devConfig.projectPath;

  app.use(compress());

  // api 接口代理中间件
  for (const [key, value] of Object.entries(devConfig.proxy)) {
    let options = value;

    if (typeof value === 'object') {
      options = {
        ...value,
        onProxyReq,
      };
    }

    app.use(createProxyMiddleware(key, options));
  }

  app.use('/favicon.ico', (req, res) => {
    res.sendFile(join(devConfig.root, 'favicon.ico'));
  });
  app.use(express.static(devConfig.publicPath));

  // 用于非 SSR 的中间件
  app.use(getNormalMiddleware({ devConfig, server }));

  // 用于 SSR 的中间件
  app.use(getSsrMiddleware({ devConfig, server }));

  return {
    host: devConfig.host,
    port: devConfig.port
  };
}
