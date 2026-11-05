import { createFinalizedResponse, getErrorHeaders, getParsedRequestUrl, getSerializedResponseState, protectResponseHeaders, resolveErrorResponseStatus, setProtectedResponseHeaders } from "./internal-request-response.js";
import { getServerFnById } from "./getServerFnById.js";
import { createMultiplexedStream } from "./frame-protocol.js";
import { TSS_CONTENT_TYPE_FRAMED_VERSIONED, TSS_FORMDATA_CONTEXT, X_TSS_RAW_RESPONSE, X_TSS_SERIALIZED, getSerovalPlugins } from "@tanstack/start-client-core";
import { invariant, isNotFound, isRedirect } from "@tanstack/router-core";
import { createRawStreamRPCPlugin, defaultSerovalDeserializerPlugins } from "@tanstack/router-core/ssr/server";
import { MAX_FRAMED_STREAMS, MAX_FRAME_PAYLOAD_SIZE } from "@tanstack/start-client-core/client-rpc";
import { fromJSON, toCrossJSONAsync, toCrossJSONStream } from "seroval";
//#region src/server-functions-handler.ts
var SERIALIZED_JSON_HEADERS = /* @__PURE__ */ new Map([
	["content-type", "application/json"],
	[X_TSS_SERIALIZED, "true"],
	[X_TSS_RAW_RESPONSE, null],
	["location", null]
]);
var SERIALIZED_JSON_HEADER_INIT = new Headers({
	"content-type": "application/json",
	[X_TSS_SERIALIZED]: "true"
});
/** Completed bytes own no stream until the request pipeline accepts them. */
var DeferredResponse = class {
	constructor(body) {
		this.body = body;
	}
	createResponse(event) {
		return createFinalizedResponse(this.body, SERIALIZED_JSON_HEADER_INIT, SERIALIZED_JSON_HEADERS, event);
	}
};
var SERIALIZED_FRAMED_HEADERS = /* @__PURE__ */ new Map([
	["content-type", TSS_CONTENT_TYPE_FRAMED_VERSIONED],
	[X_TSS_SERIALIZED, "true"],
	[X_TSS_RAW_RESPONSE, null],
	["location", null]
]);
var NOT_FOUND_HEADERS = /* @__PURE__ */ new Map([
	["content-type", "application/json"],
	[X_TSS_SERIALIZED, null],
	[X_TSS_RAW_RESPONSE, null],
	["location", null]
]);
var RAW_RESPONSE_HEADERS = /* @__PURE__ */ new Map([[X_TSS_RAW_RESPONSE, "true"]]);
var THROWN_RESPONSE_HEADERS = /* @__PURE__ */ new Map([[X_TSS_RAW_RESPONSE, "thrown"]]);
var MAX_PAYLOAD_SIZE = 1e6;
var MAX_PENDING_SERIALIZATION_RECORDS = 1024;
var MAX_PENDING_SERIALIZATION_BYTES = 33554432;
var textEncoder = new TextEncoder();
function encodeSerializationRecord(value) {
	return textEncoder.encode(JSON.stringify(value));
}
function exceedsPendingSerializationLimit(record, recordCount, pendingBytes) {
	return recordCount >= MAX_PENDING_SERIALIZATION_RECORDS || pendingBytes + record.byteLength > MAX_PENDING_SERIALIZATION_BYTES;
}
function runSerializationCleanup(dispose) {
	try {
		dispose();
	} catch {}
}
function cancelRawStream(stream, reason) {
	stream.cancel(reason).catch(() => {});
}
/**
* Marks a Response thrown during a server-function request so the client
* rejects the call with it. Redirects keep their own protocol.
*/
function toThrownServerFnResponse(response) {
	return isRedirect(response) ? response : setProtectedResponseHeaders(response, THROWN_RESPONSE_HEADERS);
}
/**
* Builds the reply for a server-function request that failed outside the
* function, such as in request middleware. Like a failed call, it carries
* only the thrown value under an `error` key, so the client rethrows it.
*/
async function createServerFnErrorResponse(error, serovalPlugins) {
	if (isNotFound(error)) return isNotFoundResponse(error);
	const headers = getErrorHeaders(error) ?? new Headers();
	const { status, statusText } = resolveErrorResponseStatus(error);
	headers.set("Content-Type", "application/json");
	headers.set(X_TSS_SERIALIZED, "true");
	headers.delete(X_TSS_RAW_RESPONSE);
	headers.delete("location");
	const plugins = serovalPlugins ?? getSerovalPlugins(defaultSerovalDeserializerPlugins);
	let serializedError;
	try {
		serializedError = JSON.stringify(await toCrossJSONAsync({ error }, {
			refs: /* @__PURE__ */ new Map(),
			plugins
		}));
	} catch (serializationError) {
		serializedError = JSON.stringify(await toCrossJSONAsync({ error: serializationError }, {
			refs: /* @__PURE__ */ new Map(),
			plugins
		}));
	}
	const errorResponse = new Response(serializedError, {
		status,
		statusText,
		headers
	});
	protectResponseHeaders(errorResponse, SERIALIZED_JSON_HEADERS);
	return errorResponse;
}
var handleServerAction = async ({ request, serverFnId }) => {
	const methodUpper = request.method.toUpperCase();
	const action = await getServerFnById(serverFnId, { origin: "client" });
	if (action.method && methodUpper !== action.method) return new Response(`expected ${action.method} method. Got ${methodUpper}`, {
		status: 405,
		headers: { Allow: action.method }
	});
	const headers = request.headers;
	const isServerFn = headers.get("x-tsr-serverfn") === "true";
	let serovalPlugins;
	const getRequestSerovalPlugins = () => {
		return serovalPlugins ??= getSerovalPlugins(defaultSerovalDeserializerPlugins);
	};
	const contentType = headers.get("content-type");
	try {
		let res;
		if (contentType && (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded"))) {
			if (methodUpper === "GET") {
				if (process.env.NODE_ENV !== "production") throw new Error("Invariant failed: GET requests with FormData payloads are not supported");
				invariant();
			}
			const formData = await request.formData();
			const serializedContext = formData.get(TSS_FORMDATA_CONTEXT);
			formData.delete(TSS_FORMDATA_CONTEXT);
			const params = {
				data: formData,
				method: methodUpper
			};
			if (typeof serializedContext === "string") try {
				const parsedContext = JSON.parse(serializedContext);
				const deserializedContext = fromJSON(parsedContext, { plugins: getRequestSerovalPlugins() });
				if (typeof deserializedContext === "object" && deserializedContext) params.context = deserializedContext;
			} catch (e) {
				if (process.env.NODE_ENV === "development") console.warn("Failed to parse FormData context:", e);
			}
			res = await action(params);
		} else {
			let json;
			if (methodUpper === "GET") {
				const payloadParam = getParsedRequestUrl(request).searchParams.get("payload");
				if (payloadParam && payloadParam.length > MAX_PAYLOAD_SIZE) throw new Error("Payload too large");
				json = payloadParam ? JSON.parse(payloadParam) : void 0;
			} else if (contentType?.includes("application/json")) json = await request.json();
			const payload = json === void 0 ? void 0 : fromJSON(json, { plugins: getRequestSerovalPlugins() });
			res = await action({
				data: payload?.data,
				context: payload?.context,
				method: methodUpper
			});
		}
		const failed = "error" in res;
		const unwrapped = failed ? res.error : res.result;
		if (!isServerFn && (unwrapped instanceof Response || unwrapped === null || typeof unwrapped !== "object")) return unwrapped;
		if (unwrapped instanceof Response) {
			if (failed) return toThrownServerFnResponse(unwrapped);
			if (isRedirect(unwrapped)) return unwrapped;
			return setProtectedResponseHeaders(unwrapped, RAW_RESPONSE_HEADERS);
		}
		return serializeResult(res, request, getRequestSerovalPlugins());
	} catch (error) {
		if (error instanceof Response) return error;
		return createServerFnErrorResponse(error, serovalPlugins);
	}
};
/**
* Serializes a server-function result. A result that Seroval completes
* synchronously without RawStreams becomes plain JSON; everything else is a
* framed response whose records and raw streams are multiplexed in order.
*/
function serializeResult(res, request, plugins) {
	const initialRecords = [];
	let initialBytes = 0;
	const pendingRawStreams = [];
	let done = false;
	let initialParsed = false;
	let serializationFailure;
	let disposeSerialization;
	let onParse = (value, initial) => {
		if (serializationFailure) return;
		initialParsed ||= initial;
		const record = encodeSerializationRecord(value);
		if (exceedsPendingSerializationLimit(record, initialRecords.length, initialBytes)) {
			serializationFailure = [/* @__PURE__ */ new Error("Server function serialization exceeded its pending output limit")];
			return;
		}
		initialRecords.push(record);
		initialBytes += record.byteLength;
	};
	let onDone = () => {
		if (initialParsed) done = true;
	};
	let onError = (error) => {
		serializationFailure ??= [error];
	};
	const rawStreamPlugin = createRawStreamRPCPlugin((id, stream) => {
		if (serializationFailure) {
			cancelRawStream(stream, serializationFailure[0]);
			return;
		}
		if (id > MAX_FRAMED_STREAMS) {
			const error = /* @__PURE__ */ new Error(`Too many raw streams in framed response (max ${MAX_FRAMED_STREAMS})`);
			cancelRawStream(stream, error);
			onError(error);
			return;
		}
		pendingRawStreams.push({
			id,
			stream
		});
	});
	const dispose = toCrossJSONStream(res, {
		refs: /* @__PURE__ */ new Map(),
		plugins: [rawStreamPlugin, ...plugins],
		onParse(value, initial) {
			onParse(value, initial);
		},
		onDone() {
			onDone();
		},
		onError: (error) => {
			onError(error);
		}
	});
	if (serializationFailure) {
		runSerializationCleanup(dispose);
		for (const registration of pendingRawStreams) cancelRawStream(registration.stream, serializationFailure[0]);
		throw serializationFailure[0];
	}
	if (!done) disposeSerialization = dispose;
	if (done && pendingRawStreams.length === 0 && initialRecords.length === 1) return new DeferredResponse(initialRecords[0]);
	if (done && initialRecords.length === 1) {
		const json = initialRecords[0];
		if (json.byteLength > MAX_FRAME_PAYLOAD_SIZE) {
			const error = /* @__PURE__ */ new Error("Server function serialization exceeded its pending output limit");
			for (const registration of pendingRawStreams) cancelRawStream(registration.stream, error);
			throw error;
		}
		const rawStreams = pendingRawStreams.splice(0);
		initialRecords.length = 0;
		return createFramedResponse(new ReadableStream({
			start(controller) {
				controller.enqueue({
					json,
					rawStreams
				});
				controller.close();
			},
			cancel(reason) {
				for (const registration of rawStreams) cancelRawStream(registration.stream, reason);
			}
		}), { signal: request.signal });
	}
	const { readable, writable } = new TransformStream();
	const writer = writable.getWriter();
	const recordAbortController = new AbortController();
	let pendingBytes = 0;
	const pendingRecords = /* @__PURE__ */ new Set();
	const abortRecordStream = (error) => {
		if (serializationFailure) return;
		serializationFailure = [error];
		const disposeCurrentSerialization = disposeSerialization;
		disposeSerialization = void 0;
		for (const registration of pendingRawStreams.splice(0)) cancelRawStream(registration.stream, error);
		for (const record of pendingRecords) for (const registration of record.rawStreams) cancelRawStream(registration.stream, error);
		pendingRecords.clear();
		recordAbortController.abort(error);
		writer.abort(error).catch(() => {});
		if (disposeCurrentSerialization) runSerializationCleanup(disposeCurrentSerialization);
	};
	const writeRecord = (json, rawStreams) => {
		if (serializationFailure) {
			for (const registration of rawStreams) cancelRawStream(registration.stream, serializationFailure[0]);
			return false;
		}
		if (json.byteLength > MAX_FRAME_PAYLOAD_SIZE || exceedsPendingSerializationLimit(json, pendingRecords.size, pendingBytes)) {
			const error = /* @__PURE__ */ new Error("Server function serialization exceeded its pending output limit");
			for (const registration of rawStreams) cancelRawStream(registration.stream, error);
			onError(error);
			return false;
		}
		pendingBytes += json.byteLength;
		const record = {
			json,
			rawStreams
		};
		pendingRecords.add(record);
		writer.write(record).then(() => {
			pendingRecords.delete(record);
			pendingBytes -= json.byteLength;
		}, (error) => {
			const stillOwned = pendingRecords.delete(record);
			pendingBytes -= json.byteLength;
			if (stillOwned) for (const registration of rawStreams) cancelRawStream(registration.stream, error);
		});
		return true;
	};
	onParse = (value) => {
		if (serializationFailure) return;
		writeRecord(encodeSerializationRecord(value), pendingRawStreams.splice(0));
	};
	onDone = () => {
		if (serializationFailure) return;
		disposeSerialization = void 0;
		writer.close().catch(() => {});
	};
	onError = (error) => {
		abortRecordStream(error);
	};
	const initialRawStreams = pendingRawStreams.splice(0);
	for (let index = 0; index < initialRecords.length; index++) {
		const isLast = index === initialRecords.length - 1;
		if (!writeRecord(initialRecords[index], isLast ? initialRawStreams : [])) {
			if (!isLast) for (const registration of initialRawStreams) cancelRawStream(registration.stream, serializationFailure[0]);
			initialRecords.length = 0;
			throw serializationFailure[0];
		}
	}
	initialRecords.length = 0;
	if (done) onDone();
	writer.closed.catch((error) => {
		abortRecordStream(error);
	});
	return createFramedResponse(readable, {
		signal: AbortSignal.any([recordAbortController.signal, request.signal]),
		onCancel: abortRecordStream
	});
}
function createFramedResponse(records, options) {
	const multiplexedStream = createMultiplexedStream(records, options);
	const { status, statusText } = getSerializedResponseState();
	try {
		const response = new Response(multiplexedStream, {
			status,
			statusText,
			headers: {
				"Content-Type": TSS_CONTENT_TYPE_FRAMED_VERSIONED,
				[X_TSS_SERIALIZED]: "true"
			}
		});
		protectResponseHeaders(response, SERIALIZED_FRAMED_HEADERS);
		return response;
	} catch (error) {
		cancelRawStream(multiplexedStream, error);
		throw error;
	}
}
function isNotFoundResponse(error) {
	const { headers, ...rest } = error;
	let responseHeaders;
	if (headers) {
		const copiedHeaders = new Headers(headers);
		copiedHeaders.set("Content-Type", "application/json");
		copiedHeaders.delete(X_TSS_SERIALIZED);
		copiedHeaders.delete(X_TSS_RAW_RESPONSE);
		copiedHeaders.delete("location");
		responseHeaders = copiedHeaders;
	} else responseHeaders = { "Content-Type": "application/json" };
	const response = new Response(JSON.stringify(rest), {
		status: 404,
		headers: responseHeaders
	});
	protectResponseHeaders(response, NOT_FOUND_HEADERS);
	return response;
}
//#endregion
export { DeferredResponse, createServerFnErrorResponse, handleServerAction, toThrownServerFnResponse };

//# sourceMappingURL=server-functions-handler.js.map