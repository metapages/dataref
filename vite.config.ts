/// <reference types="vitest" />
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import tsconfigPaths from 'vite-tsconfig-paths';

// Get the github pages path e.g. if served from https://<name>.github.io/<repo>/
// then we need to pull out "<repo>"
const packageName = JSON.parse(
  fs.readFileSync("./package.json", { encoding: "utf8", flag: "r" })
)["name"];

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => ({
  test: {
    globals: true,
    // root: './src/lib',
  },
  plugins: [tsconfigPaths(), dts({exclude: "**/*.test.ts"})],
  resolve: {
    alias: {
      "/@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/lib/index.ts'),
      name: packageName,
      formats: ['es'],
      // fileName: 'my-lib'
    },
    sourcemap: true,
    minify: mode === "development" ? false : "esbuild",
    emptyOutDir: false,
    target: 'modules',
  },
}));
