import { RequestHeaderMap, RequestHeaderName, ResponseHeaderMap, ResponseHeaderName, TypedHeaders } from 'fetchdts';
import { CookieSerializeOptions } from 'cookie-es';
import { RequestHandler } from './request-handler.js';
export interface StartEvent {
    request: Request;
    /** The parsed request URL. Callers must not mutate it. */
    requestUrl: URL;
    /**
     * Lazily created response state. Stays `undefined` until the first
     * response helper write so requests that never use helpers pay nothing.
     */
    responseState?: ResponseState;
    /** The most recently reconciled response, used by response read helpers. */
    currentResponse?: Response;
    /** Applied helper operations belong to this invocation, across runtime copies. */
    responseHeaderAppends?: WeakMap<Response, Map<string, HeaderAppendOperation>>;
}
/**
 * Event-owned mutable response state, recorded by the response helpers.
 *
 * A plain `Headers` object cannot distinguish between "not set" and
 * "explicitly removed", so removals and Set-Cookie intent are tracked
 * alongside the headers. All mutations flow through the helper functions in
 * this module (`setResponseHeader`, `setCookie`, ...), which record that
 * intent directly.
 */
interface ResponseState {
    status?: number;
    statusText?: string;
    headers: Headers;
    removedHeaders?: Set<string>;
    clearHeaders: boolean;
    setCookieBehavior?: 'merge' | 'replace';
    headerAppends?: Map<string, HeaderAppendOperation>;
    /** Outside production: a discarded bodyless status was already reported. */
    bodylessStatusWarned?: boolean;
    /** Identity of each Set-Cookie string seen by this request's merges. */
    setCookieKeys?: Map<string, string>;
}
interface HeaderAppendOperation {
    value: string;
    previous?: HeaderAppendOperation;
}
export type { ResponseHeaderName, RequestHeaderName };
/** A detached view of outgoing headers. Use the response helpers for writes. */
export type ReadonlyResponseHeaders = Omit<TypedHeaders<ResponseHeaderMap>, 'append' | 'delete' | 'set' | 'forEach'> & {
    forEach: (callback: (value: string, name: ResponseHeaderName, headers: ReadonlyResponseHeaders) => void, thisArg?: unknown) => void;
};
type ProtectedHeaders = ReadonlyMap<string, string | null>;
type MaybePromise<T> = T | Promise<T>;
/** Transport requirements belong to the encoded body, not its wrapper. */
export declare function transferResponseProtocol(source: Response, target: Response): void;
/** Preserve metadata when Start reconstructs an existing response. */
export declare function transferResponseMetadata(source: Response, target: Response): void;
export declare function getErrorHeaders(error: unknown): Headers | undefined;
/** Apply helper state to a response that leaves Start. */
export declare function finalizeResponse(response: Response, event: StartEvent): Response;
/**
 * Internal: status and status text for a serialized server-function error.
 * Logs the error and discards a non-error helper status, like any error
 * response Start builds.
 */
export declare function resolveErrorResponseStatus(error: unknown): {
    status: number;
    statusText: string;
};
export declare function handleStartError(error: unknown): Response;
/** Apply helper state to a response inside the request middleware pipeline. */
export declare function reconcileResponse(response: Response, event: StartEvent, disposeBody?: (reason: string) => void): Response;
/**
 * Restore protocol headers that middleware changed directly on the response.
 * Start does this once, when the response leaves the request middleware
 * pipeline; helper writes never override them.
 */
export declare function restoreResponseProtocol(response: Response, event: StartEvent): Response;
/**
 * Build a Start-owned serialized reply with already normalized protocol
 * headers. A bodyless helper status never applies to it; only a HEAD request
 * drops its body.
 */
export declare function createFinalizedResponse(body: string | Uint8Array, headers: Headers, protectedHeaders: ProtectedHeaders, event: StartEvent): Response;
export declare function protectResponseHeaders(response: Response, headers: ProtectedHeaders): void;
/**
 * Set and protect transport headers on a new response. Reuse the body stream
 * without cloning or teeing it; callers transfer ownership to the result.
 */
export declare function setProtectedResponseHeaders(response: Response, headers: ProtectedHeaders): Response;
/** A Start handler that runs in a request scope and receives its event. */
type ScopedRequestHandler = (request: Request, requestOpts: any, event: StartEvent) => MaybePromise<Response>;
/**
 * Keep the complete server entry, including custom error handling, inside one
 * request scope. A custom returned response is used as-is; call handleStartError
 * in a custom catch to preserve Start's response helper state.
 */
export declare function createServerEntry<TRegister = unknown>(entry: {
    fetch: RequestHandler<TRegister>;
}): {
    fetch: RequestHandler<TRegister>;
};
/**
 * Establish request scope; the response pipeline owns reconciliation. A nested
 * handler delegating the same request participates in its scope. Independent
 * fetch invocations and different requests get a fresh event.
 */
export declare function withStartRequest(handler: ScopedRequestHandler): (request: Request, requestOpts: any) => MaybePromise<Response>;
export declare function getStartEvent(): StartEvent;
/**
 * Internal: returns the per-request parsed URL for `request`, memoized on the
 * Start event so the framework parses each request URL only once. Falls back
 * to parsing when called outside a Start event (e.g. in unit tests) or for a
 * foreign request. Callers MUST NOT mutate the returned URL.
 */
export declare function getParsedRequestUrl(request: Request): URL;
export declare function getRequest(): Request;
export declare function getRequestHeaders(): TypedHeaders<RequestHeaderMap>;
export declare function getRequestHeader(name: RequestHeaderName): string | undefined;
export declare function getRequestIP(opts?: {
    /**
     * Use the X-Forwarded-For HTTP header set by proxies.
     *
     * Note: Make sure that this header can be trusted (your application running behind a CDN or reverse proxy) before enabling.
     */
    xForwardedFor?: boolean;
}): string | undefined;
/**
 * Get the request hostname.
 *
 * If `xForwardedHost` is `true`, it will use the `x-forwarded-host` header if it exists.
 *
 * If no host header is found, it uses the request URL's host.
 */
export declare function getRequestHost(opts?: {
    xForwardedHost?: boolean;
}): string;
/**
 * Get the full incoming request URL.
 *
 * If `xForwardedHost` is `true`, it will use the `x-forwarded-host` header if it exists.
 *
 * If `xForwardedProto` is `false`, it will not use the `x-forwarded-proto` header.
 */
export declare function getRequestUrl(opts?: {
    xForwardedHost?: boolean;
    xForwardedProto?: boolean;
}): URL;
/**
 * Get the request protocol.
 *
 * If `x-forwarded-proto` header is set to "https", it will return "https". You can disable this behavior by setting `xForwardedProto` to `false`.
 *
 * If protocol cannot be determined, it will default to "http".
 */
export declare function getRequestProtocol(opts?: {
    xForwardedProto?: boolean;
}): 'http' | 'https' | (string & {});
export declare function setResponseHeaders(headers: TypedHeaders<ResponseHeaderMap> | ReadonlyResponseHeaders): void;
/**
 * Read a detached snapshot of the effective response headers.
 * Use response header and cookie helpers to change the outgoing response.
 */
export declare function getResponseHeaders(): ReadonlyResponseHeaders;
export declare function getResponseHeader(name: ResponseHeaderName): string | undefined;
export declare function setResponseHeader(name: ResponseHeaderName, value: string | Array<string>): void;
/**
 * Append a response header value without replacing existing values.
 *
 * Ordinary values are appended once per returned response. Start transfers
 * that application state when it reconstructs a response. A new response
 * created by application code is fresh input: copying already-reconciled
 * headers into it also copies their appended values, and helper appends apply
 * again. Mutate the current response or pass its middleware result through
 * when preserving an existing response's headers.
 *
 * For `set-cookie`, values must be fully serialized cookie strings; they are
 * merged into the outgoing cookies and deduped by cookie identity
 * (name + domain + path), exactly like `setCookie`. A value that cannot be
 * parsed is identified by its exact string. This is the primitive to
 * use when bridging external session/auth libraries that produce raw
 * `Set-Cookie` strings.
 *
 * ```ts
 * appendResponseHeader('set-cookie', await externalLib.commitSession(session))
 * ```
 */
export declare function appendResponseHeader(name: ResponseHeaderName, value: string | Array<string>): void;
export declare function removeResponseHeader(name: ResponseHeaderName): void;
export declare function clearResponseHeaders(headerNames?: Array<ResponseHeaderName>): void;
export declare function getResponseStatus(): number;
export declare function setResponseStatus(code?: number, text?: string): void;
/**
 * Parse the request to get HTTP Cookie header string and return an object of all cookie name-value pairs.
 * @returns Object of cookie name-value pairs
 * ```ts
 * const cookies = getCookies()
 * ```
 */
export declare function getCookies(): Record<string, string>;
/**
 * Get a cookie value by name.
 * @param name Name of the cookie to get
 * @returns {*} Value of the cookie (String or undefined)
 * ```ts
 * const authorization = getCookie('Authorization')
 * ```
 */
export declare function getCookie(name: string): string | undefined;
/**
 * Set a cookie value by name.
 * @param name Name of the cookie to set
 * @param value Value of the cookie to set
 * @param options {CookieSerializeOptions} Options for serializing the cookie
 * ```ts
 * setCookie('Authorization', '1234567')
 * ```
 */
export declare function setCookie(name: string, value: string, options?: CookieSerializeOptions): void;
/**
 * Remove a cookie by name.
 * @param name Name of the cookie to delete
 * @param serializeOptions {CookieSerializeOptions} Cookie options
 * ```ts
 * deleteCookie('SessionId')
 * ```
 */
export declare function deleteCookie(name: string, options?: CookieSerializeOptions): void;
/**
 * Internal: helper status state for a serialized server-function reply.
 * Bodyless statuses never apply to it and are omitted with their status text.
 */
export declare function getSerializedResponseState(): {
    status: number | undefined;
    statusText: string | undefined;
};
