/**
 * Real `PermissionPort` Adapter (`@platform/adapters`)
 *
 * Evaluates `can(action, resource)` against the active session roles resolved
 * from `GET /api/session` (`CATALOGUE_VIEWER`, `CATALOGUE_EDITOR`, `CATALOGUE_ADMIN`),
 * with optional per-resource / per-row / per-column rules.
 *
 * ARCHITECTURAL BOUNDARY:
 * - `PermissionPort` lives at Tier 4 (`DataTable`), driving per-row and per-column editability.
 * - Leaf Tier-1 components (`Button`) NEVER read `PermissionPort`; they receive `disabled` / `title`
 *   as plain props computed by the feature container.
 */

import type {
	PermissionPort,
	PermissionResource,
} from "@platform/ports";

export type PermissionAction =
	| "view"
	| "edit"
	| "create"
	| "delete"
	| (string & {});

export const DEFAULT_VIEW_ROLES = [
	"CATALOGUE_VIEWER",
	"CATALOGUE_EDITOR",
	"CATALOGUE_ADMIN",
] as const;

export const DEFAULT_EDIT_ROLES = [
	"CATALOGUE_EDITOR",
	"CATALOGUE_ADMIN",
] as const;

export const DEFAULT_ADMIN_ROLES = ["CATALOGUE_ADMIN"] as const;

export interface SessionPermissionAdapterOptions {
	/**
	 * Active session roles from `GET /api/session` (array or getter function).
	 */
	readonly roles: readonly string[] | (() => readonly string[]);
	/**
	 * Roles allowed to perform `"view"` actions.
	 * @default DEFAULT_VIEW_ROLES
	 */
	readonly viewRoles?: readonly string[] | undefined;
	/**
	 * Roles allowed to perform `"edit"` or `"create"` actions.
	 * @default DEFAULT_EDIT_ROLES
	 */
	readonly editRoles?: readonly string[] | undefined;
	/**
	 * Roles allowed to perform `"delete"` or administrative actions.
	 * @default DEFAULT_ADMIN_ROLES
	 */
	readonly adminRoles?: readonly string[] | undefined;
	/**
	 * Optional fine-grained rule evaluated after role membership succeeds
	 * (e.g. locking retired rows or read-only columns).
	 */
	readonly canAccessResource?:
		| ((
				action: PermissionAction,
				resource: PermissionResource,
				roles: readonly string[],
		  ) => boolean)
		| undefined;
}

function normalizeResource(
	resource: string | PermissionResource,
): PermissionResource {
	return typeof resource === "string" ? { type: resource } : resource;
}

function hasAnyRole(
	userRoles: readonly string[],
	requiredRoles: readonly string[],
): boolean {
	for (const role of requiredRoles) {
		if (userRoles.includes(role)) {
			return true;
		}
	}
	return false;
}

export function createSessionPermissionAdapter(
	options: SessionPermissionAdapterOptions,
): PermissionPort {
	const {
		roles,
		viewRoles = DEFAULT_VIEW_ROLES,
		editRoles = DEFAULT_EDIT_ROLES,
		adminRoles = DEFAULT_ADMIN_ROLES,
		canAccessResource,
	} = options;

	const resolveRoles = (): readonly string[] =>
		typeof roles === "function" ? roles() : roles;

	return {
		can(
			action: PermissionAction,
			resource: string | PermissionResource,
		): boolean {
			const activeRoles = resolveRoles();
			if (activeRoles.length === 0) {
				return false;
			}

			let roleAllowed = false;
			if (action === "view") {
				roleAllowed = hasAnyRole(activeRoles, viewRoles);
			} else if (action === "edit" || action === "create") {
				roleAllowed = hasAnyRole(activeRoles, editRoles);
			} else if (action === "delete") {
				roleAllowed = hasAnyRole(activeRoles, adminRoles);
			} else {
				roleAllowed = hasAnyRole(activeRoles, editRoles);
			}

			if (!roleAllowed) {
				return false;
			}

			if (canAccessResource) {
				return canAccessResource(
					action,
					normalizeResource(resource),
					activeRoles,
				);
			}

			return true;
		},
	};
}
