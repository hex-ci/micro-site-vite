import express from 'express';
import fs from 'fs';
import path from 'path';
import { readFile } from '../common/index.js';

const router = express.Router();

router.get('/', function(req, res, next) {
  route(req, res, next);
});

router.post('/', function(req, res, next) {
  route(req, res, next);
});

// 查找文件夹
const searchFolder = (rootPath, searchArray, searchIndex, callback) => {
  if (searchIndex > searchArray.length) {
    // 所有目录都存在
    callback(searchArray.join('/'));
    return;
  }

  const currentPath = searchArray.slice(0, searchIndex).join('/');

  fs.stat(rootPath + currentPath, (err, stat) => {
    if (err || !stat.isDirectory()) {
      // 目录不存在，返回
      callback(searchArray.slice(0, searchIndex - 1).join('/'));
    }
    else {
      // 目录存在，继续下一级
      searchFolder(rootPath, searchArray, searchIndex + 1, callback);
    }
  });
}

function route(req, res, next) {
  const uri = splitPath(req.baseUrl);
  const ssrPath = req.app.locals.serverConfig.ssrPath;

  // 查找 controller 文件夹
  searchFolder(ssrPath, uri.split('/'), 2, async (projectName) => {
    try {
      let render;

      if (process.env.NODE_ENV === 'production' && req.app.locals.rendererCache[projectName]) {
        render = req.app.locals.rendererCache[projectName];
      }
      else {
        const module = await req.app.locals.viteServer.ssrLoadModule(path.join(ssrPath, `${projectName}/entry-server.js`));
        render = module.render;
        req.app.locals.rendererCache[projectName] = render;
      }

      const url = req.originalUrl;

      let template = await readFile(path.join(ssrPath, `${projectName}/index.html`));
      template = await req.app.locals.viteServer.transformIndexHtml(url, template);

      const manifest = process.env.NODE_ENV === 'production' ? JSON.parse(fs.readFileSync(path.join(ssrPath, `${projectName}/client/ssr-manifest.json`), 'utf-8')) : {};

      const [ appHtml, preloadLinks ] = await render(url, manifest);

      // 5. 注入渲染后的应用程序 HTML 到模板中。
      const html = template
        .replace(`<!--preload-links-->`, preloadLinks)
        .replace(`<!--app-html-->`, appHtml);

      // 6. 返回渲染后的 HTML。
      res.end(html);
    }
    catch (err) {
      next(err);
    }
  });
}

function splitPath(uri) {
  const uriArr = uri.split('/');
  const path = `/${uriArr.slice(2).join('/')}`;

  return path;
}

export default router;
