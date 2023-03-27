import cbT from 'cb-template';

class BaseController {
  constructor({ req, res, next, projectName, viteServer }) {
    this.$ctx = {
      request: req,
      response: res,
      next
    };
    this.$projectName = projectName;
    this.$viteServer = viteServer;

    cbT.basePath = req.app.locals.serverConfig.normalProjectPath;
  }

  $render(name, data = {}, options = {}) {
    cbT.renderFile(`${this.$projectName}/${name.replace(/\.html$/i, '')}.html`, { ...this.$ctx.response.locals, ...data }, options, async (err, content) => {
      if (err) {
        this.$ctx.next(err);
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
class StaticController extends BaseController {

  // 首页
  main(template) {
    this.$render(template);
  }
}

export {
  BaseController,
  StaticController
};
