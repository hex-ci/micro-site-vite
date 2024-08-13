# 基于 Vite 的微站点脚手架项目

## 架构

我们采用一种与 Monorepo 或微服务架构有一点类似的架构，整体上采用以文件夹为单位，支持多种技术栈的多项目架构。其中每个文件夹都可以是一个独立的项目，各个项目之间可以采用不同的技术栈，项目之间完全隔离。

此架构原生支持两种渲染方式，即 CSR 和 SSR，基于此整体目录结构分为（在 `./src` 目录下）：

* CSR 项目集(normal)，即客户端渲染项目集，此类项目都走 CSR 逻辑，支持 nodejs 类型的项目。
* SSR 项目集(ssr)，即服务端渲染项目集，此类项目都走 SSR 逻辑，目前只支持 Vue SSR，并且是原生 Vue SSR。

具体某个文件夹下的项目是哪种类型的项目，通过 `./server/config/router.js` 的路由配置来决定。

## 全局路由

路由定义在 `./server/config/router.js` 中，详情请参考 [config/router.js](./server/config/router.js)

具体路由结构如下：

```javascript
{
  type: 'ssr',
  path: /^\/demo(?:\/|$)/i,
  name: 'demo',
  base: '/demo',
},
```

* `type` 是项目类型，目前支持 `ssr` 和 `normal` 两种类型，`normal` 代表 CSR 项目，`ssr` 代表 SSR 项目。
* `path` 是一个正则，用于匹配从 / 开始的 URL，不包括问号后面的参数等内容。
* `name` 是字符串，表示 src 下的文件夹名，多级文件夹可以是 `test1/test2` 的形式。
* `base` 是字符串，表示路由的 base，一般用于 router history 的 base，默认为空字符串，在代码里使用 `import.meta.env.MICRO_SITE_BASE_URL` 获取。

## 路径别名

* `@`: 表示所有项目根目录，在本仓库中指向 `./src`
