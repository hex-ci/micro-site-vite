export default function fix502() {
  return {
    name: 'vite-plugin-fix-502',
    apply: 'serve',
    enforce: 'pre',

    transformIndexHtml() {
      return [
        {
          tag: 'script',
          children: `
          const oldFetch = window.fetch;
          window.fetch = async (url, options) => {
            if (options?.headers?.Accept === 'text/x-vite-ping') {
              const result = await oldFetch(url, options);
              if (result.status < 200 || result.status >= 500) {
                throw new Error(result.statusText);
              }
              else {
                return result;
              }
            }
            else {
              return oldFetch(url, options);
            }
          }
          `,
        },
      ]
    },
  }
}
