import { loadEnv, transformWithEsbuild } from 'vite';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { normalizePathForImport } from '#server/common/index.js';

export const DEFAULT_CONFIG_FILES = [
  'project.vite.config.ts',
  'project.vite.config.js',
];

// 获取环境变量，并转换成 Vite define 配置的形式
export const getDefineByEnv = (mode, envDir, keyPrefix = 'import.meta.env.', isStringify = true) => {
  const envs = loadEnv(mode, envDir);
  const result = {};

  for (const key in envs) {
    if (key.startsWith('VITE_')) {
      result[`${keyPrefix}${key}`] = isStringify ? JSON.stringify(envs[key]) : envs[key];
    }
  }

  return result;
}

// 把任意路径转换成 posix 类型的路径
export const toPosixPath = (path) => {
  const isExtendedLengthPath = path.startsWith('\\\\?\\');

  if (isExtendedLengthPath) {
    return path;
  }

  return path.replace(/\\/g, '/');
}

export const importProjectViteConfig = async (basePath) => {
  let configPath;

  for (const filename of DEFAULT_CONFIG_FILES) {
    const filePath = join(basePath, filename);

    if (!existsSync(filePath)) {
      continue;
    }

    configPath = filePath;

    break;
  }

  if (!configPath) {
    return null;
  }

  const filename = basename(configPath);
  const code = await readFile(configPath, 'utf-8');
  const result = await transformWithEsbuild(code, filename);
  const fileBase = `${filename}.timestamp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const fileNameTmp = join(basePath, `${fileBase}.mjs`);

  await writeFile(fileNameTmp, result.code);

  try {
    return (await import(normalizePathForImport(fileNameTmp))).default;
  }
  finally {
    // Ignore errors
    unlink(fileNameTmp, () => {});
  }
}
