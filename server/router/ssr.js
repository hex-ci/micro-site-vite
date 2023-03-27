import express from 'express';
import { stat, readFile } from 'node:fs/promises';
import path from 'path';

export default function getRouter({ viteServer, isHomeProject = false }) {
  const router = express.Router();

  const splitPath = (uri) => {
    const uriArr = uri.split('/');
    const path = `/${uriArr.slice(2).join('/')}`;

    return path;
  }

  // 查找文件夹
  const searchFolder = async (rootPath, searchArray, searchIndex = 2) => {
    if (searchIndex > searchArray.length) {
      // 所有目录都存在
      return searchArray.join('/');
    }

    const currentPath = searchArray.slice(0, searchIndex).join('/');

    try {
      const stats = await stat(rootPath + currentPath);

      if (stats.isDirectory()) {
        // 目录存在，继续下一级
        return await searchFolder(rootPath, searchArray, searchIndex + 1);
      }
    }
    catch (e) {
    }

    // 目录不存在，返回
    return searchArray.slice(0, searchIndex - 1).join('/');
  }

  const route = async (req, res, next) => {
    const uri = splitPath(req.baseUrl);
    const ssrPath = req.app.locals.serverConfig.ssrProjectPath;

    let projectName;
    let url;

    if (isHomeProject) {
      projectName = req.app.locals.serverConfig.homeProject;
      url = req.originalUrl === '/' ? `/${projectName}` : req.originalUrl;
    }
    else {
      // 查找 controller 文件夹
      projectName = await searchFolder(ssrPath, uri.split('/'));
      url = req.originalUrl;
    }

    try {
      let render;

      if (process.env.NODE_ENV === 'production' && req.app.locals.rendererCache[projectName]) {
        render = req.app.locals.rendererCache[projectName];
      }
      else {
        const module = await viteServer.ssrLoadModule(path.join(ssrPath, `${projectName}/entry-server.js`));
        render = module.render;
        req.app.locals.rendererCache[projectName] = render;
      }

      let template = await readFile(path.join(ssrPath, `${projectName}/index.html`), 'utf-8');
      template = await viteServer.transformIndexHtml(url, template);

      const manifest = process.env.NODE_ENV === 'production' ? JSON.parse(await readFile(path.join(ssrPath, `${projectName}/client/ssr-manifest.json`), 'utf-8')) : {};

      const [ appHtml, preloadLinks ] = await render(url, manifest);

      // 5. 注入渲染后的应用程序 HTML 到模板中。
      const html = template
        .replace(`<!--preload-links-->`, preloadLinks)
        .replace(`<!--app-html-->`, appHtml);

      // 6. 返回渲染后的 HTML。
      res.end(html);
    }
    catch (e) {
      console.log(e);
      next(e);
    }
  }

  router.get('/', function(req, res, next) {
    route(req, res, next);
  });

  router.post('/', function(req, res, next) {
    route(req, res, next);
  });

  return router;
}
