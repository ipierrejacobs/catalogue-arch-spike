import { splitSetCookieString } from "cookie-es";
//#region src/headers.ts
function getSetCookieValues(headers) {
	const headersWithSetCookie = headers;
	if (typeof headersWithSetCookie.getSetCookie === "function") return headersWithSetCookie.getSetCookie();
	const value = headers.get("set-cookie");
	return value ? splitSetCookieString(value) : [];
}
//#endregion
export { getSetCookieValues };

//# sourceMappingURL=headers.js.map