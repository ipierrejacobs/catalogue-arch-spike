import { stripMethodCall } from "./utils.js";
//#region src/start-compiler/handleCreateMiddleware.ts
/**
* Handles createMiddleware transformations for a batch of candidates.
*
* @param candidates - All Middleware candidates to process
* @param context - The compilation context
*/
function handleCreateMiddleware(candidates, context) {
	if (context.env === "server") throw new Error("handleCreateMiddleware should not be called on the server");
	for (const candidate of candidates) {
		const { validator, server } = candidate.methodChain;
		if (validator) {
			if (!validator.callPath.node.arguments[0]) throw new Error("createMiddleware().validator() must be called with a validator!");
			stripMethodCall(validator.callPath);
		}
		if (server) stripMethodCall(server.callPath);
	}
}
//#endregion
export { handleCreateMiddleware };

//# sourceMappingURL=handleCreateMiddleware.js.map