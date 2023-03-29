import express from 'express';
import { stat, access } from 'node:fs/promises';
import path from 'path';
import { StaticController } from '../common/index.js';

export default function getRouter({ viteServer = null } = {}) {
  const router = express.Router();

  const splitPath = (req) => {
    const uriArr = req.baseUrl.split('/');
    const path = `/${uriArr.slice(2, -1).join('/')}`;
    const method = uriArr.slice(-1);

    return {
      path,
      method,
      full: path + '/' + method
    };
  }

  const toCamelCase = (str, delimiter) => {
    const re = new RegExp(delimiter + '([a-z])', 'g')
    return str.replace(re, function(g) {
      return g[1].toUpperCase();
    });
  }

  const fileExists = async path => !!(await stat(path).catch(() => false));

  // 查找 controller 文件夹
  const searchControllerFolder = async (rootPath, searchArray, searchIndex = 2) => {
    if (searchIndex > searchArray.length) {
      // 所有目录都存在
      return [searchArray.join('/'), '', []];
    }

    const currentPath = searchArray.slice(0, searchIndex).join('/');

    try {
      const stats = await stat(rootPath + currentPath);

      if (stats.isDirectory()) {
        // 目录存在，继续下一级
        return await searchControllerFolder(rootPath, searchArray, searchIndex + 1);
      }
    }
    catch (e) {
    }

    return [currentPath, searchArray[searchIndex] || '', searchArray.slice(searchIndex)];
  }

  const route = async (req, res, next, showError) => {
    const pathArr = splitPath(req, res);
    const normalPath = req.app.locals.serverConfig.normalProjectPath;

    // 查找 controller 文件夹
    const [filePath, method, last] = await searchControllerFolder(normalPath, pathArr.full.split('/'));

    // 重新设置路径
    pathArr.path = filePath;
    pathArr.method = method || 'main';

    const dir = path.dirname(filePath);
    const filename = path.basename(filePath);

    const controllerPath = normalPath + dir + '/server/' + filename;
    const staticFilename = filename + (last.length > 0 ? `/${last.join('/')}` : '');
    let staticPath = normalPath + dir + '/' + staticFilename;

    const staticArray = [];
    // 在路径中找 .html 位置
    staticPath.split('/').some((item) => {
      staticArray.push(item);

      return /\.html$/i.test(item);
    });
    // 重新设置 staticPath
    staticPath = staticArray.join('/');

    try {
      const isServerExists = await fileExists(`${normalPath}${dir}/server`);

      if (/\.html$/i.test(staticPath)) {
        if (isServerExists) {
          return next(new Error('not found'));
        }

        await access(staticPath);

        const staticInstance = new StaticController({ req, res, next, projectName: dir.slice(1), viteServer });
        staticInstance.main(staticFilename);
      }
      else {
        await access(`${controllerPath}.js`);

        if (pathArr.method.indexOf('$') === 0) {
          // $ 开头的是隐藏方法，不允许访问
          return next();
        }

        try {
          const controllerClass = (await import(`${controllerPath}.js`)).default;

          const controller = new controllerClass({ req, res, next, projectName: dir.slice(1), viteServer });
          let action = controller[pathArr.method];

          // 尝试下划线分隔命名转成驼峰命名，以便让 url 使用下划线而 JS 保持驼峰不变。
          if (!action) {
            action = controller[toCamelCase(pathArr.method, '_')];
          }

          // 尝试减号分隔命名转成驼峰命名，以便让 url 使用减号而 JS 保持驼峰不变。
          if (!action) {
            action = controller[toCamelCase(pathArr.method, '-')];
          }

          if (action) {
            if (typeof action === 'function') {
              action.call(controller, { req, res, next });
            }
            else {
              res.send(action);
            }
          }
          else {
            showError ? next(new Error('method or property "' + pathArr.method + '" is not found in ' + pathArr.path + '.js')) : next();
          }
        }
        catch (e) {
          console.log(e)
          next(new Error('method or property "' + pathArr.method + '" is not found in ' + pathArr.path + '.js'));
        }
      }
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

  router.get('/', function(req, res, next) {
    route(req, res, next);
  });

  router.post('/', function(req, res, next) {
    route(req, res, next, true);
  });

  return router;
}
