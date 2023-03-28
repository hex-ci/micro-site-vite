import express from 'express';
import { stat, readFile } from 'node:fs/promises';
import path from 'path';

const isDev = process.env.NODE_ENV !== 'production';

export default function getRouter({ isHomeProject = false, viteServer = null } = {}) {
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
    let url = req.originalUrl;

    if (isHomeProject) {
      projectName = req.app.locals.serverConfig.homeProject;
    }
    else {
      // 查找 controller 文件夹
      projectName = await searchFolder(ssrPath, uri.split('/'));
    }

    try {
      let render;
      let template;
      let manifest = {};

      if (isDev && viteServer) {
        template = await readFile(path.join(ssrPath, `${projectName}/index.html`), 'utf-8');
        template = await viteServer.transformIndexHtml(url, template);
        render = (await viteServer.ssrLoadModule(path.join(ssrPath, `${projectName}/entry-server.js`))).render;
      }
      else {
        template = await readFile(path.join(ssrPath, `${projectName}/client/index.html`), 'utf-8');
        render = (await import(path.join(ssrPath, `${projectName}/server/entry-server.js`))).render;
        manifest = JSON.parse(await readFile(path.join(ssrPath, `${projectName}/client/ssr-manifest.json`), 'utf-8'));
      }

      const html = await render({template, url, manifest, viteServer});

      res.end(html);
    }
    catch (e) {
      console.log(e);
      next(e);
    }
  }

  if (isHomeProject) {
    router.use(function(req, res, next) {
      const ssrUrlPrefix = req.app.locals.serverConfig.ssrUrlPrefix;
      const normalUrlPrefix = req.app.locals.serverConfig.normalUrlPrefix;
      const resUrlPrefix = req.app.locals.serverConfig.resUrlPrefix;
      const reg = new RegExp(`^\/(${ssrUrlPrefix}|${normalUrlPrefix}|${resUrlPrefix})(\/|$)`);

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
