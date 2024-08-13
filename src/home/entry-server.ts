import { basename } from 'node:path';
import { renderToString } from 'vue/server-renderer';
import { createApp } from './main';

export interface AppContext {
  redirect?: string,
  title?: string,
  keywords?: string,
  description?: string,
  modules?: string[],
  httpStatusCode?: number,
}

export interface RenderContext {
  url: string,
  manifest: Record<string, string[]>,
  request: Request,
  response: Response,
}

export async function render({ url, manifest }: RenderContext) {
  const { app, router } = createApp();

  await router.push(url);
  await router.isReady();

  const ctx: AppContext = {};
  const appHtml = await renderToString(app, ctx);

  const preloadLinks = renderPreloadLinks(ctx.modules ?? [], manifest);

  return { preload: preloadLinks, app: appHtml };
}

function renderPreloadLinks(modules: string[], manifest: Record<string, string[]>) {
  let links = ''
  const seen = new Set()
  modules.forEach((id) => {
    const files = manifest[id]
    if (files) {
      files.forEach((file) => {
        if (!seen.has(file)) {
          seen.add(file)
          const filename = basename(file)
          if (manifest[filename]) {
            for (const depFile of manifest[filename]) {
              links += renderPreloadLink(depFile)
              seen.add(depFile)
            }
          }
          links += renderPreloadLink(file)
        }
      })
    }
  })
  return links
}

function renderPreloadLink(file: string) {
  if (file.endsWith('.js')) {
    return `<link rel="modulepreload" crossorigin href="${file}">`
  } else if (file.endsWith('.css')) {
    return `<link rel="stylesheet" href="${file}">`
  } else if (file.endsWith('.woff')) {
    return ` <link rel="preload" href="${file}" as="font" type="font/woff" crossorigin>`
  } else if (file.endsWith('.woff2')) {
    return ` <link rel="preload" href="${file}" as="font" type="font/woff2" crossorigin>`
  } else if (file.endsWith('.gif')) {
    return ` <link rel="preload" href="${file}" as="image" type="image/gif">`
  } else if (file.endsWith('.jpg') || file.endsWith('.jpeg')) {
    return ` <link rel="preload" href="${file}" as="image" type="image/jpeg">`
  } else if (file.endsWith('.png')) {
    return ` <link rel="preload" href="${file}" as="image" type="image/png">`
  } else {
    // TODO
    return ''
  }
}
