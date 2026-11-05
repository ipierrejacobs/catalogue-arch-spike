import path from "node:path";
//#region src/vite/dev-server-plugin/dev-styles.ts
/**
* CSS collection for dev mode.
* Crawls the Vite module graph to collect CSS from the router entry and all its dependencies.
*/
var CSS_FILE_REGEX = /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/;
var CSS_SIDE_EFFECT_FREE_PARAMS = [
	"url",
	"inline",
	"raw",
	"inline-css"
];
var VITE_CSS_MARKER = "const __vite__css = ";
var ESCAPE_CSS_COMMENT_START_REGEX = /\/\*/g;
var ESCAPE_CSS_COMMENT_END_REGEX = /\*\//g;
var NO_DEPENDENCIES = [];
var cssTransformCache = /* @__PURE__ */ new WeakMap();
function isCssFile(file) {
	return CSS_FILE_REGEX.test(file);
}
function hasCssSideEffectFreeParam(url) {
	const queryString = url.split("?")[1];
	if (!queryString) return false;
	const params = new URLSearchParams(queryString);
	return CSS_SIDE_EFFECT_FREE_PARAMS.some((param) => params.get(param) === "" && !url.includes(`?${param}=`) && !url.includes(`&${param}=`));
}
/**
* Resolve a file path to a Vite dev server URL.
* Files within the root directory use relative paths, files outside use /@fs prefix.
*/
function resolveDevUrl(rootDirectory, filePath) {
	const normalizedPath = filePath.replace(/\\/g, "/");
	const relativePath = path.posix.relative(rootDirectory.replace(/\\/g, "/"), normalizedPath);
	if (!relativePath.startsWith("..") && !path.isAbsolute(relativePath)) return path.posix.join("/", relativePath);
	return path.posix.join("/@fs", normalizedPath);
}
/**
* Collect CSS content from the module graph starting from the given entry points.
*/
async function collectDevStyles(opts) {
	const { serverEnvironment, rootDirectory, entries, loadCssContents } = opts;
	const orderedCssNodes = await collectCssNodes(serverEnvironment, entries.map((entry) => resolveDevUrl(rootDirectory, entry)));
	const cssResults = await Promise.all(orderedCssNodes.map((node) => loadCssContents(node.url)));
	return formatCss(orderedCssNodes.map((node) => node.url), cssResults);
}
/**
* Resolve entry nodes and their dependency graph in parallel, then linearize the
* completed graph synchronously. This keeps I/O concurrent without making
* Promise resolution timing part of the CSS cascade order.
*/
async function collectCssNodes(environment, entryUrls) {
	const entryNodes = await Promise.all(entryUrls.map((entryUrl) => resolveEntry(environment, entryUrl)));
	const dependencies = /* @__PURE__ */ new Map();
	const discovered = /* @__PURE__ */ new Set();
	const dependencyLookups = /* @__PURE__ */ new Map();
	function getDependency(url) {
		let lookup = dependencyLookups.get(url);
		if (!lookup) {
			lookup = environment.moduleGraph.getModuleByUrl(url);
			dependencyLookups.set(url, lookup);
		}
		return lookup;
	}
	async function discover(node) {
		if (discovered.has(node)) return;
		discovered.add(node);
		const nodeDependencies = await resolveModuleDeps(node, getDependency);
		dependencies.set(node, nodeDependencies);
		await Promise.all(nodeDependencies.map(discover));
	}
	await Promise.all(entryNodes.map((node) => node ? discover(node) : Promise.resolve()));
	return orderCssNodes(entryNodes, (node) => node.url, (node) => dependencies.get(node) ?? []);
}
function orderCssNodes(entryNodes, getUrl, getDependencies) {
	const orderedCssNodes = [];
	const ordered = /* @__PURE__ */ new Set();
	const stack = [...entryNodes].reverse();
	while (stack.length > 0) {
		const node = stack.pop();
		if (!node || ordered.has(node)) continue;
		ordered.add(node);
		const url = getUrl(node);
		if (isCssFile(url) && !hasCssSideEffectFreeParam(url)) orderedCssNodes.push(node);
		const nodeDependencies = getDependencies(node);
		for (let i = nodeDependencies.length - 1; i >= 0; i--) stack.push(nodeDependencies[i]);
	}
	return orderedCssNodes;
}
async function resolveEntry(environment, entryUrl) {
	let node = await environment.moduleGraph.getModuleByUrl(entryUrl);
	if (!node?.transformResult) {
		try {
			await environment.transformRequest(entryUrl);
		} catch {}
		node = await environment.moduleGraph.getModuleByUrl(entryUrl);
	}
	return node;
}
/**
* Resolve a module's direct dependencies in graph order.
* Uses transformResult.deps for URL-based lookups and importedModules for
* already-resolved nodes.
*/
async function resolveModuleDeps(node, getDependency) {
	if (isCssFile(node.url)) return NO_DEPENDENCIES;
	const depUrls = node.transformResult?.deps ?? [];
	const importedModules = node.importedModules.size > 0 ? Array.from(node.importedModules) : NO_DEPENDENCIES;
	if (depUrls.length === 0 && importedModules.length === 0) return NO_DEPENDENCIES;
	const resolvedDeps = await Promise.all(depUrls.map(getDependency));
	const orderedDependencies = [];
	const added = /* @__PURE__ */ new Set();
	for (const dependency of resolvedDeps) if (dependency && !added.has(dependency)) {
		added.add(dependency);
		orderedDependencies.push(dependency);
	}
	for (const dependency of importedModules) if (!added.has(dependency)) {
		added.add(dependency);
		orderedDependencies.push(dependency);
	}
	return orderedDependencies;
}
async function fetchCssFromModule(environment, url) {
	const cachedTransform = (await environment.moduleGraph.getModuleByUrl(url))?.transformResult;
	if (cachedTransform?.code) return extractCssFromTransform(cachedTransform);
	try {
		const transformResult = await environment.transformRequest(url);
		if (!transformResult?.code) return;
		return extractCssFromTransform(transformResult);
	} catch {
		return;
	}
}
function extractCssFromTransform(transformResult) {
	const cachedCss = cssTransformCache.get(transformResult);
	if (cachedCss !== void 0) return cachedCss ?? void 0;
	const css = extractCssFromCode(transformResult.code);
	cssTransformCache.set(transformResult, css ?? null);
	return css;
}
/**
* Extract CSS content from Vite's transformed CSS module code.
*
* Vite embeds CSS into the module as a JS string via `JSON.stringify(cssContent)`,
* e.g. `const __vite__css = ${JSON.stringify('...css...')}`.
*
* We locate that JSON string literal and run `JSON.parse` on it to reverse the
* escaping (\\n, \\t, \\", \\\\, \\uXXXX, etc.).
*/
function extractCssFromCode(code) {
	const startIdx = code.indexOf(VITE_CSS_MARKER);
	if (startIdx === -1) return;
	const valueStart = startIdx + 20;
	if (code.charCodeAt(valueStart) !== 34) return;
	const codeLength = code.length;
	let i = valueStart + 1;
	while (i < codeLength) {
		const charCode = code.charCodeAt(i);
		if (charCode === 34) try {
			return JSON.parse(code.slice(valueStart, i + 1));
		} catch {
			return;
		}
		if (charCode === 92) i += 2;
		else i++;
	}
}
/** Join available styles in graph order, labeling each with its source URL. */
function formatCss(urls, cssResults) {
	const parts = [];
	for (let i = 0; i < cssResults.length; i++) {
		const css = cssResults[i];
		if (!css) continue;
		const escapedFileName = urls[i].replace(ESCAPE_CSS_COMMENT_START_REGEX, "/\\*").replace(ESCAPE_CSS_COMMENT_END_REGEX, "*\\/");
		parts.push(`\n/* ${escapedFileName} */\n${css}`);
	}
	return parts.length > 0 ? parts.join("\n") : void 0;
}
/** Snapshot the completed bundle without retaining its plugin context or JS. */
function captureBundledDevStyles(graph, rootDirectory) {
	const css = /* @__PURE__ */ new Map();
	const dependencies = /* @__PURE__ */ new Map();
	for (const id of graph.getModuleIds()) {
		const info = graph.getModuleInfo(id);
		if (!info) continue;
		if (isCssFile(id)) {
			if (!hasCssSideEffectFreeParam(id) && info.code) {
				const contents = extractCssFromCode(info.code);
				if (contents) css.set(id, contents);
			}
		} else dependencies.set(id, [...info.importedIds, ...info.dynamicallyImportedIds]);
	}
	return {
		rootDirectory,
		css,
		dependencies
	};
}
function collectBundledDevStyles(snapshot, entries) {
	if (!snapshot) return;
	const nodes = orderCssNodes(entries.map((entry) => entry.replace(/\\/g, "/")), (id) => id, (id) => snapshot.dependencies.get(id) ?? []);
	return formatCss(nodes.map((id) => resolveDevUrl(snapshot.rootDirectory, id)), nodes.map((id) => snapshot.css.get(id)));
}
//#endregion
export { captureBundledDevStyles, collectBundledDevStyles, collectDevStyles, extractCssFromCode, fetchCssFromModule };

//# sourceMappingURL=dev-styles.js.map