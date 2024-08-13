import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createHttpServer } from 'node:http';

import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import cbT from 'cb-template';

import { getMiddleware } from './middleware/index.js';

import config from './config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function createServer() {
  let host = config.host;
  let port = config.port;

  const app = express();

  // 初始化配置信息
  app.locals.serverConfig = {
    serverPath: __dirname,
    resUrlPrefix: config.resUrlPrefix,
    projectPath: config.projectPath,
    routes: config.routes,
  };

  app.use(morgan(process.env.NODE_ENV !== 'production' ? 'dev' : 'combined', {
    skip: (req, res) => res.statusCode < (process.env.NODE_ENV !== 'production' ? 400 : 0),
  }));
  app.use(bodyParser.json({ limit: '6mb' }));
  app.use(bodyParser.urlencoded({ limit: '6mb', extended: false }));
  app.use(cookieParser());

  const engine = cbT.getInstance();

  // 定义模板引擎
  app.engine('html', function(filePath, options, callback) {
    engine.renderFile(
      filePath,
      { ...options },
      { cache: process.env.NODE_ENV === 'production' },
      (err, content) => {
        if (err) {
          return callback(err);
        }

        return callback(null, content);
      },
    );
  });
  app.set('views', resolve(__dirname, 'views'));
  app.set('view engine', 'html');

  cbT.leftDelimiter = '{{%';
  cbT.rightDelimiter = '%}}';

  const server = createHttpServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const createDevServer = (await import('../utils/dev-server/index.js')).default;

    ({ host, port } = await createDevServer({ app, server }));
  }
  else {
    app.disable('x-powered-by');

    // 设置全局 cbT basePath
    cbT.basePath = config.projectPath;

    app.use(express.static(config.publicPath));
    app.use(`/${config.resUrlPrefix}`, express.static(config.resPath));

    // 主中间件
    app.use(getMiddleware());
  }

  // eslint-disable-next-line no-unused-vars
  app.use(function(err, req, res, next) {
    // treat as 404
    if (err.code === 'ENOENT' || err.status === 404 || (err.message && /not found/i.test(err.message))) {
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
      error: 'Not found',
    };

    if (req.xhr) {
      return res.status(404).json(payload);
    }

    res.status(404).render('404', payload);
  });

  // Listen the server
  server.listen(port, host, () => {
    console.log(`Server listening on http://${host}:${port}`);
  });
}

createServer();
