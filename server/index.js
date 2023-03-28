import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import path from 'path';
import cbT from 'cb-template';
import { fileURLToPath } from 'url';
import http from 'http';

import getNormalRouter from './router/normal.js';
import getSsrRouter  from './router/ssr.js';

import config from './config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== 'production';

async function createServer() {
  let host = config.host;
  let port = config.port;

  const app = express();

  // 初始化配置信息
  app.locals.serverConfig = {
    serverPath: __dirname,
    baseApiUrl: config.baseApiUrl,
    ssrUrlPrefix: config.ssrUrlPrefix,
    normalUrlPrefix: config.normalUrlPrefix,
    normalProjectPath: path.join(config.projectPath, config.normalUrlPrefix),
    ssrProjectPath: path.join(config.projectPath, config.ssrUrlPrefix),
    homeProject: config.homeProject
  };
  app.locals.rendererCache = {};

  app.use(morgan('dev'));
  app.use(bodyParser.json({ limit: '6mb' }));
  app.use(bodyParser.urlencoded({ limit: '6mb', extended: false }));
  app.use(cookieParser());

  const engine = cbT.getInstance();

  // 定义模板引擎
  app.engine('html', function(filePath, options, callback) {
    engine.renderFile(filePath, { ...options }, {}, (err, content) => {
      if (err) {
        return callback(err);
      }

      return callback(null, content);
    });
  });
  app.set('views', path.resolve(__dirname, 'views'));
  app.set('view engine', 'html');

  const server = http.createServer(app);

  if (isDev) {
    const createDevServer = (await import('../utils/dev-server.js')).default;

    ({ host, port } = await createDevServer({ app, server }));
  }
  else {
    app.disable('x-powered-by');

    app.use(express.static(config.publicPath));
    app.use('/assets', express.static(config.assetsPath));

    // 用于非 SSR 的中间件
    app.use(`/${config.normalUrlPrefix}/*`, getNormalRouter());

    // 用于 SSR 的中间件
    app.use(`/${config.ssrUrlPrefix}/*`, getSsrRouter());

    // 用于显示首页
    app.use(new RegExp(`^(\/|\/${config.homeProject}\/.*)$`, 'i'), getSsrRouter({ isHomeProject: true }));
  }

  // eslint-disable-next-line no-unused-vars
  app.use(function(err, req, res, next) {
    // treat as 404
    if (err.code === 404 || (err.message && /not found/i.test(err.message))) {
      return next();
    }

    console.error(err);

    if (err.stack && err.stack.includes('ValidationError')) {
      res.status(422).render('422', { error: err.stack });
      return;
    }

    // error page
    res.status(500).render('500', { error: err.stack });
  });

  app.use(function(req, res) {
    const payload = {
      url: req.originalUrl,
      error: 'Not found'
    };

    if (req.xhr) {
      return res.status(404).json(payload);
    }

    res.status(404).render('404', payload);
  });

  // Listen the server
  server.listen(port, host);

  console.log(`Server listening on http://${host}:${port}`);
}

createServer();
