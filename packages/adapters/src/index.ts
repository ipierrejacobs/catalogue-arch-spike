/**
 * @platform/adapters — Application-owned adapter implementations for `@platform/ports`.
 *
 * ARCHITECTURAL LAW:
 * - This package (alongside feature containers) is the ONLY place where app-specific
 *   data fetching (TanStack Query), routing (TanStack Router), session/auth rules,
 *   and Zustand view-state persistence are wired to `@platform/ports`.
 */

export const ADAPTERS_LAYER = "@platform/adapters" as const;

export {
	createRouterNavigationAdapter,
	type RouterNavigatePayload,
	type RouterNavigationAdapterOptions,
} from "./navigation.adapter";
export {
	createSessionPermissionAdapter,
	DEFAULT_ADMIN_ROLES,
	DEFAULT_EDIT_ROLES,
	DEFAULT_VIEW_ROLES,
	type PermissionAction,
	type SessionPermissionAdapterOptions,
} from "./permission.adapter";
export {
	createQueryRowMutationAdapter,
	extractProblemDetail,
	formatProblemDetailMessage,
	ProblemDetailError,
	type ProblemDetailPayload,
	type QueryRowMutationAdapterOptions,
	type QueryRowMutationPort,
	type QueryRowMutationSnapshot,
} from "./row-mutation.adapter";
export {
	createQueryRowSourceAdapter,
	type QueryRowSourceAdapterOptions,
	type SpringPageEnvelope,
} from "./row-source.adapter";
export {
	createZustandViewStateAdapter,
	createZustandViewStateStore,
	type ZustandViewStateAdapterOptions,
	type ZustandViewStatePort,
	type ZustandViewStateSlice,
	type ZustandViewStateStore,
} from "./view-state.adapter";
