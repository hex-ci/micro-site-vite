import express from 'express';
import { stat, readFile } from 'node:fs/promises';
import path from 'path';
import cbT from 'cb-template';

export default function getRouter({ isHomeProject = false } = {}) {
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
    const url = req.originalUrl;

    if (isHomeProject) {
      projectName = req.app.locals.serverConfig.homeProject;
    }
    else {
      // 查找 controller 文件夹
      projectName = await searchFolder(ssrPath, uri.split('/').splice(1, 1));
    }

    try {
      const render = (await import(path.join(ssrPath, `${projectName}/server/entry-server.js`))).render;
      const manifest = JSON.parse(await readFile(path.join(ssrPath, `${projectName}/ssr-manifest.json`), 'utf-8'));

      const templateData = await render({ url, manifest });

      let html = await readFile(path.join(req.app.locals.serverConfig.ssrProjectPath, `${projectName}/index.html`), 'utf-8');
      html = cbT.render(html, templateData);

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    }
    catch (e) {
      if (e.code === 'ENOENT') {
        next();
      }
      else {
        console.log(e);
        next(e);
      }
    }
  }

  if (isHomeProject) {
    router.use(function(req, res, next) {
      const ssrUrlPrefix = req.app.locals.serverConfig.ssrUrlPrefix;
      const normalUrlPrefix = req.app.locals.serverConfig.normalUrlPrefix;
      const resUrlPrefix = req.app.locals.serverConfig.resUrlPrefix;
      const reg = new RegExp(`^/(${ssrUrlPrefix}|${normalUrlPrefix}|${resUrlPrefix})(/|$)`);

      if (reg.test(req.originalUrl)) {
        next(new Error('not found'));
      }
      else {
        route(req, res, next);
      }
    });
  }
  else {
    router.get('/', function(req, res, next) {
      route(req, res, next);
    });

    router.post('/', function(req, res, next) {
      route(req, res, next);
    });
  }

  return router;
}
