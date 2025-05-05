// svelte.config.js
import adapter from "@sveltejs/adapter-auto";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import sveltePreprocess from "svelte-preprocess";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [
    vitePreprocess(),
    sveltePreprocess({
      scss: { includePaths: ["src"] },
      typescript: true,
    }),
  ],
  kit: {
    adapter: adapter(),
  },
  vite: {
    resolve: {
      alias: {
        "xmlhttprequest-ssl": "./node_modules/engine.io-client/lib/xmlhttprequest.js",
      },
    },
  },
};

export default config;
