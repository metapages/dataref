// Reference: https://miyauchi.dev/posts/vite-preact-typescript/

import fs from "fs";
import { resolve } from "path";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// values acted on: [glitch]
const DEPLOY_TARGET: string | undefined = process.env.DEPLOY_TARGET;
const HOST: string = process.env.HOST || "metaframe1.localhost";
const PORT: string = process.env.PORT || "4440";
const CERT_FILE: string | undefined = process.env.CERT_FILE;
const CERT_KEY_FILE: string | undefined = process.env.CERT_KEY_FILE;
const BASE: string | undefined = process.env.BASE;
const OUTDIR: string | undefined = process.env.OUTDIR;
const INSIDE_CONTAINER: boolean = fs.existsSync("/.dockerenv");

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => ({
  // For serving NOT at the base path e.g. with github pages: https://<user_or_org>.github.io/<repo>/
  base: BASE,
  resolve: {
    alias: {
      react: "preact/compat",
      "react-dom": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime",
      "react-dom/test-utils": "preact/test-utils",
      "/@": resolve(__dirname, "./src"),
    },
  },
  jsx: {
    factory: "h",
    fragment: "Fragment",
  },
  // this is really stupid this should not be necessary
  plugins: [preact()],
  build: {
    outDir: OUTDIR,
    // outDir:
    //   DEPLOY_TARGET === DeployTarget.Glitch
    //     ? "dist"
    //     : `docs/${GithubPages_BUILD_SUB_DIR}`,
    target: "esnext",
    sourcemap: true,
    minify: mode === "development" ? false : "esbuild",
    // emptyOutDir: DEPLOY_TARGET === DeployTarget.Glitch,
  },
  esbuild: {
    // https://github.com/vitejs/vite/issues/8644
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  },
  server:
    DEPLOY_TARGET === "glitch"
      ? {
          strictPort: true,
          hmr: {
            port: 443, // Run the websocket server on the SSL port
          },
        }
      : {
          open: false,
          host: INSIDE_CONTAINER ? "0.0.0.0" : HOST,
          port: parseInt(
            CERT_KEY_FILE && fs.existsSync(CERT_KEY_FILE) ? PORT : "8000"
          ),
          https:
            CERT_KEY_FILE &&
            fs.existsSync(CERT_KEY_FILE) &&
            CERT_FILE &&
            fs.existsSync(CERT_FILE)
              ? {
                  key: fs.readFileSync(CERT_KEY_FILE),
                  cert: fs.readFileSync(CERT_FILE),
                }
              : undefined,
        },
}));
