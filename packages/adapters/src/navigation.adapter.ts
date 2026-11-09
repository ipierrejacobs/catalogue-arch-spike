/**
 * Real `NavigationPort` Adapter (`@platform/adapters`)
 *
 * Backs `@platform/ports`'s `NavigationPort` (`navigate(to, opts?)`, `useHref(to)`)
 * with TanStack Router navigation and href resolution.
 *
 * PORTABILITY NOTE (Phase 2 §4):
 * Only this adapter file touches TanStack Router. If Next.js wins the Phase 1 gate,
 * this file swaps `router.navigate` / `buildLocation` for Next's `useRouter().push/replace`
 * + `useSearchParams()`, while `@platform/ui` and `@platform/ports` remain 100% unchanged.
 */

import type {
	NavigationOptions,
	NavigationPort,
	NavigationRecord,
} from "@platform/ports";

export interface RouterNavigatePayload {
	readonly to: string;
	readonly replace?: boolean | undefined;
	readonly search?: Record<string, unknown> | undefined;
}

export interface RouterNavigationAdapterOptions {
	/**
	 * Delegate that invokes TanStack Router's `navigate({ to, replace, search })`.
	 */
	readonly onNavigate: (payload: RouterNavigatePayload) => void;
	/**
	 * Optional href builder (e.g. `(to) => router.buildLocation({ to }).href`).
	 * Defaults to returning `to` (prefixed with `basePath` when provided).
	 */
	readonly resolveHref?: ((to: string) => string) | undefined;
	/**
	 * Optional base path prefix for href resolution.
	 */
	readonly basePath?: string | undefined;
}

export function createRouterNavigationAdapter(
	options: RouterNavigationAdapterOptions,
): NavigationPort & { readonly history: NavigationRecord[] } {
	const history: NavigationRecord[] = [];
	const basePath = options.basePath ?? "";

	return {
		history,
		navigate(to: string, opts?: NavigationOptions): void {
			history.push({ to, opts });
			options.onNavigate({
				to,
				replace: opts?.replace,
				search: opts?.search,
			});
		},
		useHref(to: string): string {
			if (options.resolveHref) {
				return options.resolveHref(to);
			}
			if (!to) {
				return basePath || "/";
			}
			return `${basePath}${to}`;
		},
	};
}
