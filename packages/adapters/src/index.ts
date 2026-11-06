/**
 * @platform/adapters — Application-owned adapter implementations for `@platform/ports`.
 *
 * ARCHITECTURAL LAW:
 * - This package (alongside feature containers) is the ONLY place where app-specific
 *   data fetching (TanStack Query), routing (TanStack Router), session/auth rules,
 *   and Zustand view-state persistence are wired to `@platform/ports`.
 * - Stage 0 stands up the package boundary; Stage 3 implements the real adapters.
 */

export const ADAPTERS_LAYER = "@platform/adapters" as const;
