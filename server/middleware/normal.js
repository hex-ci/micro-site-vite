import { stat } from 'node:fs/promises';
import { dirname, basename, join } from 'node:path';
import parseurl from 'parseurl';

import { StaticController, fileExists, trimSlash } from '../common/index.js';

const toCamelCase = (str, delimiter) => {
  const re = new RegExp(delimiter + '([a-z])', 'g')
  return str.replace(re, function(g) {
    return g[1].toUpperCase();
  });
}

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

// 获取项目信息，获取不到返回 false
export const getProjectInfo = async (url, projectRootPath) => {
  if (url === '/') {
    // 根 URL 不可能是 normal 类型的项目
    return false;
  }

  // 查找 controller 文件夹
  const [filePath, method, last] = await searchControllerFolder(projectRootPath, url.split('/'));

  // 项目名
  const projectName = trimSlash(dirname(filePath));
  // 控制器文件名
  const controllerFileName = basename(filePath);
  // 方法名
  const methodName = method || 'main';
  // server 文件夹全路径
  const serverFolderFullPath = join(projectRootPath, projectName, 'server');

  const staticFileName = join(controllerFileName, (last.length > 0 ? `/${last.join('/')}` : ''));
  let staticFullPath = join(projectRootPath, projectName, staticFileName);

  const staticArray = [];
  // 在路径中找 .html 位置
  staticFullPath.split('/').some((item) => {
    staticArray.push(item);

    return /\.html$/i.test(item);
  });
  // 重新设置 staticPath
  staticFullPath = staticArray.join('/');

  const isServerExists = await fileExists(serverFolderFullPath);

  if (staticFullPath.endsWith('.html')) {
    if (isServerExists) {
      return false;
    }

    const isStaticExists = await fileExists(staticFullPath);

    if (!isStaticExists) {
      return false;
    }

    return {
      type: 'static',
      projectName,
      fileName: staticFileName
    }
  }
  else {
    const controllerFullFileName = join(serverFolderFullPath, `${controllerFileName}.js`);
    const isControllerExists = await fileExists(controllerFullFileName);

    if (!isControllerExists) {
      return false;
    }

    if (methodName.startsWith('$')) {
      // $ 开头的是隐藏方法，不允许访问
      return false;
    }

    return {
      type: 'controller',
      projectName,
      fileName: controllerFullFileName,
      methodName
    }
  }
}

export const getMiddleware = ({ viteServer = null } = {}) => {
  return async (req, res, next) => {
    const parsedOriginalUrl = parseurl.original(req);
    const projectInfo = await getProjectInfo(parsedOriginalUrl.pathname, req.app.locals.serverConfig.normalProjectPath);

    if (!projectInfo) {
      return next();
    }

    try {
      if (projectInfo.type === 'static') {
        const staticInstance = new StaticController({ projectName: projectInfo.projectName, req, res, next, viteServer });
        staticInstance.main(projectInfo.fileName);
      }
      else if (projectInfo.type === 'controller') {
        const ControllerClass = (await import(projectInfo.fileName)).default;

        const controller = new ControllerClass({ projectName: projectInfo.projectName, req, res, next, viteServer });
        let action = controller[projectInfo.methodName];

        // 尝试下划线分隔命名转成驼峰命名，以便让 url 使用下划线而 JS 保持驼峰不变。
        if (!action) {
          action = controller[toCamelCase(projectInfo.methodName, '_')];
        }

        // 尝试减号分隔命名转成驼峰命名，以便让 url 使用减号而 JS 保持驼峰不变。
        if (!action) {
          action = controller[toCamelCase(projectInfo.methodName, '-')];
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
          res.status(404).render('404');
        }
      }
      else {
        res.status(404).render('404');
      }
    }
    catch (e) {
      console.error(e);
      res.status(500).render('500', {
        error: e,
        projectInfo,
      });
    }
  }
}
