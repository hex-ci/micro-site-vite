import { BaseController } from '#server/common/index.js';

class Controller extends BaseController {

  // constructor(opts) {
  //   super(opts);

  //   // 你的代码
  //   console.log('code');
  // }

  // 首页
  main() {
    this.$render('index');
  }
}

export default Controller;
