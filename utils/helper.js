import { loadEnv } from 'vite';

// 获取环境变量，并转换成 Vite define 配置的形式
export const getDefineByEnv = (mode, envDir) => {
  const envs = loadEnv(mode, envDir);
  const result = {};

  for (const key in envs) {
    if (key.startsWith('VITE_')) {
      result[`import.meta.env.${key}`] = JSON.stringify(envs[key]);
    }
  }

  return result;
}
