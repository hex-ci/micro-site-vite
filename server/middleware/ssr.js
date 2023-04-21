import { stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import cbT from 'cb-template';
import { fileExists, trimSlash } from '../common/index.js';

import config from '../config/index.js';

// 查找项目文件夹
const searchProjectFolder = async (rootPath, searchArray, searchIndex = 2) => {
  if (searchIndex > searchArray.length) {
    // 所有目录都存在
    return searchArray.join('/');
  }

  const currentPath = searchArray.slice(0, searchIndex).join('/');

  try {
    const stats = await stat(rootPath + currentPath);

    if (stats.isDirectory()) {
      // 目录存在，继续下一级
      return await searchProjectFolder(rootPath, searchArray, searchIndex + 1);
    }
  }
  catch (e) {
  }

  // 目录不存在，返回
  return searchArray.slice(0, searchIndex - 1).join('/');
}

// 获取项目信息，获取不到返回 false
export const getProjectInfo = async (url, projectRootPath, isHomeProject = false) => {
  let projectName;

  if (isHomeProject) {
    projectName = config.homeProject;
  }
  else {
    if (url === '/') {
      // 没有 home 标志，不允许使用根 URL
      return false;
    }

    // 查找项目文件夹
    projectName = trimSlash(await searchProjectFolder(projectRootPath, url.split('/')));

    // 如果从 url 中查找到 home 项目，则直接忽略
    if (projectName === config.homeProject) {
      return false;
    }
  }

  let serverEntryFullFileName;

  if (process.env.NODE_ENV === 'production') {
    serverEntryFullFileName = join(projectRootPath, projectName, 'server', 'entry-server.js');
  }
  else {
    serverEntryFullFileName = join(projectRootPath, projectName, 'entry-server.js');
  }

  const ssrManifestFullFileName = join(projectRootPath, projectName, 'ssr-manifest.json');
  const templateFullFileName = join(projectRootPath, projectName, 'index.html');

  if (
    !(await fileExists(serverEntryFullFileName))
    || !(await fileExists(templateFullFileName))
  ) {
    return false;
  }

  return {
    projectName,
    serverEntry: serverEntryFullFileName,
    ssrManifest: ssrManifestFullFileName,
    template: templateFullFileName
  }
}

export const getMiddleware = () => {
  return async (req, res, next) => {
    const url = req.originalUrl;
    const pathname = req._parsedOriginalUrl.pathname;

    // 如果是 res 资源则忽略
    const re = new RegExp(`^/(${config.resUrlPrefix})(/|$)`);
    if (re.test(pathname)) {
      return next();
    }

    let projectInfo;

    // 先检查非 home 项目
    projectInfo = await getProjectInfo(
      pathname,
      req.app.locals.serverConfig.ssrProjectPath,
      false
    );

    if (!projectInfo) {
      // 再检查 home 项目
      projectInfo = await getProjectInfo(
        pathname,
        req.app.locals.serverConfig.ssrProjectPath,
        true
      );

      if (!projectInfo) {
        return next();
      }
    }

    try {
      const render = (await import(projectInfo.serverEntry)).render;
      const manifest = JSON.parse(await readFile(projectInfo.ssrManifest), 'utf-8');

      const templateData = await render({ url, manifest, request: req, response: res });

      let html = await readFile(projectInfo.template, 'utf-8');
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
}
