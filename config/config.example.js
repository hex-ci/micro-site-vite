export default {
  // dev server 端口
  port: 5173,

  host: '127.0.0.1',

  // 为开发服务器配置自定义代理规则，用于代理浏览器发起的请求
  proxy: {
    '/api': {
      target: 'http://domain.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api/': '/',
      },
    },
  },
};
