//#region src/inlineCss.ts
/**
* The inline-CSS choice that needs no handler callback: a request override
* wins, then a static handler option, then the default. Undefined when a
* handler callback has to decide.
*/
function getStaticInlineCss(requestInlineCss, handlerInlineCss) {
	if (requestInlineCss !== void 0) return requestInlineCss;
	if (typeof handlerInlineCss === "function") return;
	return handlerInlineCss ?? true;
}
async function resolveInlineCssForRequest(opts) {
	const inlineCss = getStaticInlineCss(opts.requestInlineCss, opts.handlerInlineCss);
	if (inlineCss !== void 0) return inlineCss;
	return await opts.handlerInlineCss({ request: opts.request });
}
//#endregion
export { getStaticInlineCss, resolveInlineCssForRequest };

//# sourceMappingURL=inlineCss.js.map