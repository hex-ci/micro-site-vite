import { join } from 'node:path';
import { register } from "node:module";
import { legacyCreateProxyMiddleware } from 'http-proxy-middleware';
import compress from 'compression';
import express from 'express';
import qs from 'qs';
import cbT from 'cb-template';

import { getMiddleware } from './middleware.js';

register('./hooks.js', import.meta.url);

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

    app.use(legacyCreateProxyMiddleware(key, options));
  }

  app.use('/favicon.ico', (req, res) => {
    res.sendFile(join(devConfig.root, 'favicon.ico'));
  });
  app.use(express.static(devConfig.publicPath));

  // 主中间件
  app.use(getMiddleware({ devConfig, server }));

  return {
    host: devConfig.host,
    port: devConfig.port,
  };
}
