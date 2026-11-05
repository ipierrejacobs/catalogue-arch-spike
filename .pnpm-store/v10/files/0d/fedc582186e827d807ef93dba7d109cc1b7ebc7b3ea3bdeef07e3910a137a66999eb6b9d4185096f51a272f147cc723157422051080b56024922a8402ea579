import { ENTRY_POINTS, VITE_ENVIRONMENT_NAMES } from "../../constants.js";
import { ensureLatestClientBuild } from "../bundled-dev.js";
import { captureBundledDevStyles, collectBundledDevStyles, collectDevStyles, fetchCssFromModule } from "./dev-styles.js";
import { isRunnableDevEnvironment } from "vite";
import { NodeRequest, sendNodeResponse } from "srvx/node";
//#region src/vite/dev-server-plugin/plugin.ts
function devServerPlugin({ getConfig: _getConfig, devSsrStylesEnabled, installDevServerMiddleware }) {
	let isTest = false;
	let bundledDev = false;
	let bundledStyles;
	return [{
		name: "tanstack-start-core:dev-server",
		perEnvironmentWatchChangeDuringDev: true,
		config(_userConfig, { mode }) {
			isTest = isTest ? isTest : mode === "test";
		},
		configEnvironment(name, _config, { command }) {
			if (command === "serve" && devSsrStylesEnabled && name === VITE_ENVIRONMENT_NAMES.client) return { build: { rolldownOptions: { experimental: { devMode: { lazy: false } } } } };
		},
		configResolved(config) {
			bundledDev = config.command === "serve" && !!config.experimental.bundledDev;
		},
		generateBundle() {
			if (bundledDev && devSsrStylesEnabled && this.environment.name === VITE_ENVIRONMENT_NAMES.client) bundledStyles = captureBundledDevStyles(this, this.environment.config.root);
		},
		watchChange: {
			order: "post",
			sequential: true,
			handler(id) {
				if (bundledDev && this.environment.name === VITE_ENVIRONMENT_NAMES.server && this.environment.mode === "dev") {
					this.environment.moduleGraph.onFileChange(id);
					this.environment.hot.send({
						type: "full-reload",
						triggeredBy: id
					});
				}
			}
		},
		configureServer(viteDevServer) {
			if (isTest) return;
			const clientEnv = viteDevServer.environments[VITE_ENVIRONMENT_NAMES.client];
			if (devSsrStylesEnabled) viteDevServer.middlewares.use(async (req, res, next) => {
				const url = req.url ?? "";
				if (!url.split("?")[0]?.endsWith("/@tanstack-start/styles.css")) return next();
				try {
					const routesParam = new URL(url, "http://localhost").searchParams.get("routes");
					const ids = routesParam ? routesParam.split(",") : [];
					const entries = [];
					const routesManifest = globalThis.TSS_ROUTES_MANIFEST;
					if (routesManifest && ids.length > 0) for (const routeId of ids) {
						const route = routesManifest[routeId];
						if (route?.filePath) entries.push(route.filePath);
					}
					let css = "";
					if (entries.length > 0) {
						if (bundledDev) {
							await ensureLatestClientBuild(clientEnv);
							css = collectBundledDevStyles(bundledStyles, entries) ?? "";
						} else css = await collectDevStyles({
							serverEnvironment: viteDevServer.environments[VITE_ENVIRONMENT_NAMES.server],
							rootDirectory: viteDevServer.config.root,
							entries,
							loadCssContents: (url) => fetchCssFromModule(viteDevServer.environments[VITE_ENVIRONMENT_NAMES.client], url)
						}) ?? "";
					}
					res.setHeader("Content-Type", "text/css");
					res.setHeader("Cache-Control", "no-store");
					res.end(css);
				} catch (e) {
					console.error("[tanstack-start] Error collecting dev styles:", e);
					res.setHeader("Content-Type", "text/css");
					res.setHeader("Cache-Control", "no-store");
					res.end(`/* Error collecting styles: ${e instanceof Error ? e.message : String(e)} */`);
				}
			});
			if (viteDevServer.config.experimental.bundledDev) viteDevServer.watcher.add(viteDevServer.config.root);
			return () => {
				const serverEnv = viteDevServer.environments[VITE_ENVIRONMENT_NAMES.server];
				if (!serverEnv) throw new Error(`Server environment ${VITE_ENVIRONMENT_NAMES.server} not found`);
				const installMiddleware = installDevServerMiddleware;
				if (installMiddleware === false) return;
				if (installMiddleware == void 0) {
					if (viteDevServer.config.server.middlewareMode) return;
					if (!isRunnableDevEnvironment(serverEnv) || "dispatchFetch" in serverEnv) return;
				}
				if (!isRunnableDevEnvironment(serverEnv)) throw new Error("cannot install vite dev server middleware for TanStack Start since the SSR environment is not a RunnableDevEnvironment");
				viteDevServer.middlewares.use(async (req, res) => {
					if (req.originalUrl) req.url = req.originalUrl;
					const webReq = new NodeRequest({
						req,
						res
					});
					try {
						const serverRunner = serverEnv.runner;
						/**
						* export default {
						*  fetch(req: Request): Promise<Response>
						* }
						*/
						if (viteDevServer.config.experimental.bundledDev) await ensureLatestClientBuild(clientEnv);
						const webRes = await (await serverRunner.import(ENTRY_POINTS.server))["default"].fetch(webReq);
						return sendNodeResponse(res, webRes);
					} catch (e) {
						console.error(e);
						try {
							viteDevServer.ssrFixStacktrace(e);
						} catch {}
						if (webReq.headers.get("content-type")?.includes("application/json")) return sendNodeResponse(res, new Response(JSON.stringify({
							status: 500,
							error: "Internal Server Error",
							message: "An unexpected error occurred. Please try again later.",
							timestamp: (/* @__PURE__ */ new Date()).toISOString()
						}, null, 2), {
							status: 500,
							headers: { "Content-Type": "application/json" }
						}));
						return sendNodeResponse(res, new Response(`
              <!DOCTYPE html>
              <html lang="en">
                <head>
                  <meta charset="UTF-8" />
                  <title>Error</title>
                  <script type="module">
                    import { ErrorOverlay } from '/@vite/client'
                    document.body.appendChild(new ErrorOverlay(${JSON.stringify(prepareError(req, e)).replace(/</g, "\\u003c")}))
                  <\/script>
                </head>
                <body>
                </body>
              </html>
            `, {
							status: 500,
							headers: { "Content-Type": "text/html" }
						}));
					}
				});
			};
		}
	}];
}
/**
* Formats error for SSR message in error overlay
* @param req
* @param error
* @returns
*/
function prepareError(req, error) {
	const e = error;
	return {
		message: `An error occurred while server rendering ${req.url}:\n\n\t${typeof e === "string" ? e : e.message} `,
		stack: typeof e === "string" ? "" : e.stack
	};
}
//#endregion
export { devServerPlugin };

//# sourceMappingURL=plugin.js.map