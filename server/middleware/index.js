import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import cbT from 'cb-template';
import parseurl from 'parseurl';
import { fileExists, normalizePathForImport } from '../common/index.js';

const DEFAULT_CONTROLLER_FILE_NAME = 'index';
const DEFAULT_CONTROLLER_METHOD_NAME = 'main';

const toCamelCase = (str, delimiter) => {
  const re = new RegExp(delimiter + '([a-z])', 'g');

  return str.replace(re, (g) => g[1].toUpperCase());
}

const getAction = (controller, methodName) => {
  let action = controller[methodName];

  // 尝试下划线分隔命名转成驼峰命名，以便让 url 使用下划线而 JS 保持驼峰不变。
  if (!action) {
    action = controller[toCamelCase(methodName, '_')];
  }

  // 尝试减号分隔命名转成驼峰命名，以便让 url 使用减号而 JS 保持驼峰不变。
  if (!action) {
    action = controller[toCamelCase(methodName, '-')];
  }

  return action;
}

export const getMatchedRoute = (url, routes) => routes.find((item) => item.path.test(url));

// 获取项目信息，获取不到返回 false
export const getProjectInfo = async (url, serverConfig) => {
  const route = getMatchedRoute(url, serverConfig.routes);

  if (!route) {
    return false;
  }

  // 查找项目文件夹
  const projectName = route.name;
  const projectRoot = join(serverConfig.projectPath, projectName);

  if (route.type === 'ssr') {
    let serverEntryFullFileName;

    if (process.env.NODE_ENV === 'production') {
      serverEntryFullFileName = join(projectRoot, 'server', 'entry-server.js');
    }
    else {
      serverEntryFullFileName = join(projectRoot, 'entry-server.ts');
    }

    const ssrManifestFullFileName = join(projectRoot, '.vite', 'ssr-manifest.json');
    const templateFullFileName = join(projectRoot, 'index.html');

    if (
      !(await fileExists(serverEntryFullFileName))
      || !(await fileExists(templateFullFileName))
    ) {
      return false;
    }

    return {
      route,
      projectName,
      serverEntry: serverEntryFullFileName,
      ssrManifest: ssrManifestFullFileName,
      template: templateFullFileName,
    }
  }
  else if (route.type === 'normal') {
    // 查找项目文件夹
    const isProjectExists = await fileExists(projectRoot);

    if (!isProjectExists) {
      return false;
    }

    // 获取 url 其他部分
    const urlParts = url.replace(route.path, '').split('/');
    // 控制器文件名
    const controllerFileName = urlParts?.[0] || DEFAULT_CONTROLLER_FILE_NAME;
    // 方法名
    const methodName = urlParts?.[1] || DEFAULT_CONTROLLER_METHOD_NAME;
    // 控制器文件全路径
    let controllerFullFileName = join(projectRoot, 'server', `${controllerFileName}.js`);

    if (!await fileExists(controllerFullFileName)) {
      controllerFullFileName = join(projectRoot, 'server', `${DEFAULT_CONTROLLER_FILE_NAME}.js`);
    }

    return {
      route,
      projectName,
      fileName: controllerFullFileName,
      methodName,
    };
  }
  else {
    return false;
  }
}

export const getProcessMiddlewareForSsr = (projectInfo) => async (req, res, next) => {
  try {
    const render = (await import(normalizePathForImport(projectInfo.serverEntry))).render;
    const manifest = JSON.parse(await readFile(projectInfo.ssrManifest), 'utf-8');

    const templateData = await render({ url: req.originalUrl, manifest, request: req, response: res });

    if (templateData === false) {
      return;
    }

    let html = await readFile(projectInfo.template, 'utf-8');
    html = cbT.render(html, templateData);

    res.status(templateData?.httpStatusCode || 200).set({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    }).end(html);
  }
  catch (e) {
    if (e.code === 'ENOENT') {
      next();
    }
    else {
      console.error(e);
      next(e);
    }
  }
};

export const getProcessMiddlewareForNormal = (projectInfo, viteServer = null) => async (req, res, next) => {
  try {
    const ControllerClass = (await import(normalizePathForImport(projectInfo.fileName))).default;
    const controller = new ControllerClass({ projectName: projectInfo.projectName, req, res, next, viteServer });

    let action = getAction(controller, projectInfo.methodName);

    // 如果 url 指定的方法不存在则使用默认值
    if (!action) {
      action = getAction(controller, DEFAULT_CONTROLLER_METHOD_NAME);
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
  catch (e) {
    console.error(e);
    res.status(500).render('500', {
      error: e,
      projectInfo,
    });
  }
};

export const getMiddleware = () => async (req, res, next) => {
  const parsedOriginalUrl = parseurl.original(req);
  const pathname = parsedOriginalUrl.pathname;

  // 获取项目信息
  const projectInfo = await getProjectInfo(
    pathname,
    req.app.locals.serverConfig,
  );

  if (!projectInfo) {
    // 获取失败，继续下一级中间件
    return next();
  }

  // 此处分开写是为了便于外部调用，分别处理不同的项目类型
  if (projectInfo.route.type === 'ssr') {
    const middleware = getProcessMiddlewareForSsr(projectInfo);

    return middleware(req, res, next);
  }
  else if (projectInfo.route.type === 'normal') {
    const middleware = getProcessMiddlewareForNormal(projectInfo);

    return middleware(req, res, next);
  }
  else {
    next();
  }
};
