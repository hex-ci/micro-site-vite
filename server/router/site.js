import express from 'express';
import fs from 'fs';
import path from 'path';
import { StaticController } from '../common/index.js';

const router = express.Router();

router.get('/', function(req, res, next) {
  route(req, res, next);
});

router.post('/', function(req, res, next) {
  route(req, res, next, true);
});

// 查找 controller 文件夹
const searchControllerFolder = (rootPath, searchArray, searchIndex, callback) => {
  if (searchIndex > searchArray.length) {
    // 所有目录都存在
    callback(searchArray.join('/'), '', []);
    return;
  }

  const currentPath = searchArray.slice(0, searchIndex).join('/');

  fs.access(rootPath + currentPath, (err) => {
    if (err) {
      // 目录不存在，返回
      callback(currentPath, searchArray[searchIndex] || '', searchArray.slice(searchIndex));
    }
    else {
      // 目录存在，继续下一级
      searchControllerFolder(rootPath, searchArray, searchIndex + 1, callback);
    }
  });
}

function route(req, res, next, showError) {
  const pathArr = splitPath(req, res);
  const sitePath = req.app.locals.serverConfig.sitePath;

  // 查找 controller 文件夹
  searchControllerFolder(sitePath, pathArr.full.split('/'), 2, (filePath, method, last) => {
    // 重新设置路径
    pathArr.path = filePath;
    pathArr.method = method || 'main';

    const dir = path.dirname(filePath);
    const filename = path.basename(filePath);

    const controllerPath = sitePath + dir + '/server/' + filename;
    const staticFilename = filename + (last.length > 0 ? `/${last.join('/')}` : '');
    let staticPath = sitePath + dir + '/' + staticFilename;

    const staticArray = [];
    // 在路径中找 .html 位置
    staticPath.split('/').some((item) => {
      staticArray.push(item);

      return /\.html$/i.test(item);
    });
    // 重新设置 staticPath
    staticPath = staticArray.join('/');

    if (/\.html$/i.test(staticPath)) {
      fs.access(staticPath, (err) => {
        if (!err) {
          const staticInstance = new StaticController({ req, res, next, siteName: dir });
          staticInstance.main(staticFilename);
        }
        else {
          next(err);
        }
      });
    }
    else {
      fs.access(controllerPath + '.js', async (err) => {
        if (!err) {
          if (pathArr.method.indexOf('$') === 0) {
            // $ 开头的是隐藏方法，不允许访问
            next();
            return;
          }

          try {
            const controllerClass = (await import(controllerPath + '.js')).default;

            const controller = new controllerClass({ req, res, next, siteName: dir });
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
          catch (err) {
            next(new Error('method or property "' + pathArr.method + '" is not found in ' + pathArr.path + '.js'))
          }
        }
        else {
          next(err);
        }
      });
    }
  });
}

function splitPath(req) {
  const uriArr = req.baseUrl.split('/');
  const path = `/${uriArr.slice(2, -1).join('/')}`;
  const method = uriArr.slice(-1);

  return {
    path,
    method,
    full: path + '/' + method
  };
}

function toCamelCase(str, delimiter) {
  const re = new RegExp(delimiter + '([a-z])', 'g')
  return str.replace(re, function(g) {
    return g[1].toUpperCase();
  });
}

export default router;
