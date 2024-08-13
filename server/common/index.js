import { stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import cbT from 'cb-template';

export class BaseController {
  constructor({ req, res, next, projectName, viteServer }) {
    this.$ctx = {
      request: req,
      response: res,
      next,
    };
    this.$projectName = projectName;

    // viteServer 只在开发环境下存在
    this.$viteServer = viteServer;
  }

  $render(name, data = {}, options = {}) {
    const fullname = extname(name) ? name : `${name}.html`;
    const realExtname = extname(fullname);

    cbT.renderFile(
      `${this.$projectName}/${fullname}`,
      { ...this.$ctx.response.locals, ...data },
      { cache: process.env.NODE_ENV === 'production', ...options },
      async (err, content) => {
        if (err) {
          if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
            this.$ctx.next();
          }
          else {
            console.error(err);
            this.$ctx.next(err);
          }
        }
        else {
          // 开发环境下，需要经过 vite 开发服务器处理 html 文件
          if (process.env.NODE_ENV !== 'production' && this.$viteServer && realExtname === '.html') {
            content = await this.$viteServer.transformIndexHtml(this.$ctx.request.originalUrl, content);
          }

          this.$ctx.response.send(content);
        }
      },
    );
  }

  $renderToString(name, data = {}, options = {}) {
    const fullname = extname(name) ? name : `${name}.html`;
    const realExtname = extname(fullname);

    return new Promise((resolve, reject) => {
      cbT.renderFile(
        `${this.$projectName}/${fullname}`,
        { ...this.$ctx.response.locals, ...data },
        { cache: process.env.NODE_ENV === 'production', ...options },
        async (err, content) => {
          if (err) {
            console.error(err);
            reject(err);
          }
          else {
            // 开发环境下，需要经过 vite 开发服务器处理 html 文件
            if (process.env.NODE_ENV !== 'production' && this.$viteServer && realExtname === '.html') {
              content = await this.$viteServer.transformIndexHtml(this.$ctx.request.originalUrl, content);
            }

            resolve(content);
          }
        },
      );
    })
  }
}

export const trimSlash = (str) => {
  return str.replace(/^\/+|\/+$/g, '');
}

export const fileExists = async path => !!(await stat(path).catch(() => false));

// 规范化 import 的 path，防止在 windows 下报错
export const normalizePathForImport = (path) => {
  return process.platform === 'win32' ? join('file://', path) : path;
}
