import { handlers } from "@shared/mocks/handlers";
import { HttpResponse, http, passthrough } from "msw";
import { setupWorker } from "msw/browser";

// Allow TanStack Devtools Vite internal console-pipe endpoint to pass through
// so `onUnhandledRequest: "error"` does not enter a recursive console.error loop.
// Catch-all for `/api/*` aborts any unregistered API request with `HttpResponse.error()`
// so no unhandled `/api/*` request ever escapes to the network.
const devInternalPassthrough = [
	http.post("/__tsd/*", () => passthrough()),
	http.get("/__tsd/*", () => passthrough()),
];

const unhandledApiCatchAll = [
	http.all("/api/*", () => HttpResponse.error()),
];

export const worker = setupWorker(
	...devInternalPassthrough,
	...handlers,
	...unhandledApiCatchAll,
);

