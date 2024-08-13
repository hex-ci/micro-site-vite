// 全局服务器路由配置
// 开发环境和生产环境共用，请谨慎设置

// 项目路由配置
// 路由匹配顺序为从上到下，匹配到第一条路由则停止匹配，如果都匹配不上，则返回 404。
export const routes = [
  {
    type: 'normal',
    path: /^\/react(?:\/|$)/i,
    name: 'react',
    base: '/react',
  },

  {
    type: 'normal',
    path: /^\/hello\/vue(?:\/|$)/i,
    name: 'hello',
    base: '/hello/vue',
  },

  {
    type: 'ssr',
    path: /^\/vue(?:\/|$)/i,
    name: 'vue',
    base: '/vue',
  },

  {
    type: 'normal',
    path: /^\/vue2(?:\/|$)/i,
    name: 'vue2',
    base: '/vue2',
  },

  // 默认路由
  {
    type: 'ssr',
    path: /^\//i,
    name: 'home',
    base: '',
  },
];
