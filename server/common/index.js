import { stat } from 'node:fs/promises';
import cbT from 'cb-template';

export class BaseController {
  constructor({ req, res, next, projectName, viteServer }) {
    this.$ctx = {
      request: req,
      response: res,
      next
    };
    this.$projectName = projectName;

    // viteServer 只在开发环境下存在
    this.$viteServer = viteServer;
  }

  $render(name, data = {}, options = {}) {
    cbT.renderFile(`${this.$ctx.request.app.locals.serverConfig.normalFolderPrefix}/${this.$projectName}/${name.replace(/\.html$/i, '')}.html`, { ...this.$ctx.response.locals, ...data }, options, async (err, content) => {
      if (err) {
        if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
          this.$ctx.next();
        }
        else {
          console.log(err);
          this.$ctx.next(err);
        }
      }
      else {
        // 开发环境下，需要经过 vite 开发服务器处理 html 文件
        if (process.env.NODE_ENV !== 'production' && this.$viteServer) {
          content = await this.$viteServer.transformIndexHtml(this.$ctx.request.originalUrl, content);
        }

        this.$ctx.response.send(content);
      }
    });
  }
}

// 用于静态输出的控制器
export class StaticController extends BaseController {

  // 首页
  main(template) {
    this.$render(template);
  }
}

export const trimSlash = (str) => {
  return str.replace(/^\/+|\/+$/g, '');
}

export const fileExists = async path => !!(await stat(path).catch(() => false));
