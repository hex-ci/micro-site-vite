import cbT from 'cb-template';
import fs from 'fs';

const readFile = (file, options = { encoding: 'utf-8' }) => {
  return new Promise(function(resolve, reject) {
    fs.readFile(file, options, (err, data) => {
      if (err) {
        reject(err);
      }
      else {
        resolve(data);
      }
    });
  });
};

class BaseController {
  constructor({ req, res, next, siteName }) {
    this.$ctx = {
      request: req,
      response: res,
      next
    };
    this.$siteName = siteName;

    cbT.basePath = req.app.locals.serverConfig.sitePath;
  }

  $render(name, data = {}, options = {}) {
    cbT.renderFile(`${this.$siteName}/${name.replace(/\.html$/i, '')}.html`, { ...this.$ctx.response.locals, ...data }, options, async (err, content) => {
      if (err) {
        this.$ctx.next(err);
      }
      else {
        if (process.env.NODE_ENV !== 'production') {
          content = await this.$ctx.request.app.locals.viteServer.transformIndexHtml(this.$ctx.request.originalUrl, content);
        }

        this.$ctx.response.send(content);
      }
    });
  }
}

// 用于静态输出的控制器
class StaticController extends BaseController {

  // 首页
  main(template) {
    this.$render(template);
  }
}

export {
  readFile,
  BaseController,
  StaticController
};
