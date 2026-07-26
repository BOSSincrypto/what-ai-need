import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    // Inlining below 4 KB trades a request for bytes; the only small asset here
    // is the favicon, and it is already referenced by URL from the HTML.
    assetsInlineLimit: 0,
    // esbuild's CSS minifier rather than lightningcss: the latter is a ~10 MB
    // native binary to install on every CI run, for a few hundred bytes.
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        entryFileNames: 'a/[hash].js',
        chunkFileNames: 'a/[hash].js',
        assetFileNames: 'a/[hash][extname]',
      },
    },
  },
  // `public/data/*.json` is written by scripts/collect.mjs and copied verbatim,
  // so the JSON keeps stable URLs the HTML can preload.
  json: { stringify: true },
});
