import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

//引用本地配置文件
import config from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fileExists = (filepath) => {
  try {
    return fs.statSync(filepath).isFile();
  } catch (e) {
    return false;
  }
};

const rootPath = path.resolve(__dirname, '..');

// 检查用于开发的配置文件是否存在，不存在自动用默认配置创建一个
const siteConfig = path.join(rootPath, 'config', 'config.js');

if (!fileExists(siteConfig)) {
  fs.writeFileSync(siteConfig, fs.readFileSync(path.join(rootPath, 'config', 'config.example.js')));
}

export default {
  port: config.port || 5173,
  host: config.host || '127.0.0.1',
  baseApiUrl: config.baseApiUrl,

  // CDN URL 前缀，结尾需要斜杠
  // cdnUrlPrefix: 'https://domain.com/cdn/',
  cdnUrlPrefix: '/assets/',

  // 项目文件位置
  projectPath: path.resolve(__dirname, '../src'),

  // public 文件位置
  publicPath: path.resolve(__dirname, '../public'),

  ossOptions: {
    accessKeyId: '',
    secretAccessKey: '',
    endpoint: 'http://oss-cn-beijing.aliyuncs.com',
    apiVersion: '2013-10-15',
    bucket: ''
  }
};
