import { normalizePath } from 'vite';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { URL, fileURLToPath } from 'node:url';
import OSS from 'ali-oss';
import mime from 'mime';
import dayjs from 'dayjs';
import log from 'fancy-log';
import colors from 'ansi-colors';
import { globSync } from 'glob';
import _ from 'lodash-es';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function sha1(content, isFull = false) {
  const hash = crypto.createHash('md5').update(content).digest('hex');

  return isFull ? hash : hash.substring(6, 13);
}

async function uploadFile({ filePath, filename, ossClient, keyPrefix, cdnCache }) {
  let content = fs.readFileSync(filePath);
  const hash = sha1(content, true);
  const cacheKey = `${filename}?${hash}`;

  if (cdnCache[cacheKey]) {
    return { isSuccess: true };
  }

  const ext = path.extname(filePath);
  let contentType;

  const charsetMimes = {
    '.js': 'utf-8',
    '.css': 'utf-8',
    '.html': 'utf-8',
    '.htm': 'utf-8',
    '.svg': 'utf-8'
  };

  const gzipMimes = {
    '.html': 6,
    '.htm': 6,
    '.js': 6,
    '.css': 6,
    '.svg': 6
  };

  contentType = mime.getType(ext) || 'application/octet-stream';

  if (charsetMimes[ext]) {
    contentType += '; charset=' + charsetMimes[ext];
  }

  const key = `${keyPrefix}${filename}`.replace(/^\/+/, '');

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': contentType,
    'Cache-Control': 'max-age=315360000',
    Expires: dayjs().add(10, 'years').toDate().toUTCString()
  };

  if (gzipMimes[ext]) {
    headers['Content-Encoding'] = 'gzip';
    content = zlib.gzipSync(content, { level: gzipMimes[ext] });
  }

  try {
    await ossClient.put(key, content, { headers });

    cdnCache[cacheKey] = true;
    log('OK:', colors.green(filename + '\tmime: ' + contentType));

    return true;
  } catch (error) {
    log('ERR:', colors.red(filename + '\t' + error));

    return false;
  }
}

export default function uploadAlioss(options) {
  let cdnCache = {};

  const ossClient = new OSS({
    accessKeyId: options.oss.accessKeyId,
    accessKeySecret: options.oss.accessKeySecret,
    bucket: options.oss.bucket,
    endpoint: options.oss.endpoint
  });

  const cdnCacheFileName = `cdn-manifest.${sha1(JSON.stringify({ ...options.oss, urlPrefix: options.urlPrefix }))}.json`;
  const keyPrefix = (new URL(options.urlPrefix)).pathname;
  const asset = options.asset || process.cwd();

  let baseConfig = '/';
  let buildConfig = '';

  return {
    name: 'vite-plugin-upload-alioss',
    enforce: 'post',
    apply: 'build',

    configResolved(config) {
      baseConfig = config.base;
      buildConfig = config.build;
    },

    closeBundle: {
      sequential: true,
      order: 'post',
      async handler() {
        if (!/^http/i.test(baseConfig)) {
          throw Error('[vite-plugin-upload-alioss] base must be a url');
        }

        const outDirPath = normalizePath(path.resolve(normalizePath(buildConfig.outDir)));
        const ssrClient = buildConfig.ssrManifest;

        const files = globSync(
          outDirPath + '/**/*',
          {
            strict: true,
            nodir: true,
            dot: true,
            ignore:
              // custom ignore
              options.ignore ? options.ignore :
              // ssr client ignore
                ssrClient ? ['**/ssr-manifest.json', '**/*.html', '**/server/**'] :
                  // default ignore
                  '**/*.html'
          }
        );

        try {
          cdnCache = _(cdnCache).merge(JSON.parse(fs.readFileSync(path.join(__dirname, cdnCacheFileName)))).value();
        } catch (e) {}

        console.log();
        console.log('============== 开始上传 ==============');
        console.log();

        for (const fileFullPath of files) {
          const cdnName = path.relative(asset, fileFullPath);

          await uploadFile({
            filePath: fileFullPath,
            filename: cdnName,
            ossClient,
            keyPrefix,
            cdnCache
          });
        }

        fs.writeFileSync(path.join(__dirname, cdnCacheFileName), JSON.stringify(cdnCache, null, '  '));

        console.log();
        console.log('============== 上传完成 ==============');
        console.log();
      }
    }
  }
}
