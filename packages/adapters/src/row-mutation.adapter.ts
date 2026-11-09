/**
 * Real `RowMutationPort` Adapter (`@platform/adapters`)
 *
 * Wraps TanStack Query `useMutation` with optimistic updates via the **cache approach**:
 * - `onMutate`: cancels matching list/detail queries, snapshots cached `SpringPageEnvelope<TRow>`
 *   pages AND any single-row detail cache entry (`"multiple places on screen"`), writes the
 *   patched row into the cache, and returns the snapshot context.
 * - `onError`: rolls back all snapshotted list and detail cache entries from the snapshot,
 *   and maps RFC 7807 `application/problem+json` (422) `errors{}` back to field/row error state.
 * - `onSettled`: clears `id` from `pendingIds` and invalidates affected queries.
 */

import type { RowMutationHandle, RowMutationPort } from "@platform/ports";
import {
	type QueryKey,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import * as React from "react";
import type { SpringPageEnvelope } from "./row-source.adapter";

/**
 * RFC 7807 `application/problem+json` payload (Spring Boot 3 `ProblemDetail`).
 */
export interface ProblemDetailPayload {
	readonly type?: string | undefined;
	readonly title?: string | undefined;
	readonly status?: number | undefined;
	readonly detail?: string | undefined;
	/**
	 * Field -> validation message map returned on 422 validation failures.
	 */
	readonly errors?: Readonly<Record<string, string>> | undefined;
}

/**
 * Error carrying an RFC 7807 `application/problem+json` body.
 */
export class ProblemDetailError extends Error {
	readonly status: number;
	readonly problem: ProblemDetailPayload;

	constructor(problem: ProblemDetailPayload, fallbackMessage?: string) {
		const message =
			fallbackMessage ??
			formatProblemDetailMessage(problem) ??
			problem.detail ??
			problem.title ??
			`Request failed (${problem.status ?? 422})`;
		super(message);
		this.name = "ProblemDetailError";
		this.status = problem.status ?? 422;
		this.problem = problem;
	}
}

/**
 * Extracts an RFC 7807 `ProblemDetailPayload` from an unknown thrown value
 * (supports `ProblemDetailError`, `ApiError` with `.problem`, or raw `ProblemDetail` objects).
 */
export function extractProblemDetail(
	error: unknown,
): ProblemDetailPayload | null {
	if (!error || typeof error !== "object") {
		return null;
	}
	const candidate = error as {
		readonly problem?: unknown;
		readonly status?: unknown;
		readonly title?: unknown;
		readonly detail?: unknown;
		readonly errors?: unknown;
		readonly type?: unknown;
	};
	if (candidate.problem && typeof candidate.problem === "object") {
		return candidate.problem as ProblemDetailPayload;
	}
	if (
		typeof candidate.status === "number" &&
		(typeof candidate.title === "string" ||
			typeof candidate.detail === "string" ||
			(candidate.errors && typeof candidate.errors === "object"))
	) {
		return {
			type: typeof candidate.type === "string" ? candidate.type : undefined,
			title: typeof candidate.title === "string" ? candidate.title : undefined,
			status: candidate.status,
			detail:
				typeof candidate.detail === "string" ? candidate.detail : undefined,
			errors:
				candidate.errors && typeof candidate.errors === "object"
					? (candidate.errors as Readonly<Record<string, string>>)
					: undefined,
		};
	}
	return null;
}

/**
 * Formats a concise human-readable field/row validation message from an RFC 7807 `ProblemDetailPayload`.
 */
export function formatProblemDetailMessage(
	problem: ProblemDetailPayload,
	patch?: unknown,
): string {
	const fieldErrors = problem.errors;
	if (fieldErrors && Object.keys(fieldErrors).length > 0) {
		if (patch && typeof patch === "object") {
			for (const patchedKey of Object.keys(patch as Record<string, unknown>)) {
				const fieldMsg = fieldErrors[patchedKey];
				if (fieldMsg) {
					return `${patchedKey}: ${fieldMsg}`;
				}
			}
		}
		const formattedEntries = Object.entries(fieldErrors).map(
			([field, msg]) => `${field}: ${msg}`,
		);
		return formattedEntries.join("; ");
	}
	return problem.detail ?? problem.title ?? "Validation failed";
}

function isSpringPageEnvelope<TRow>(
	data: unknown,
): data is SpringPageEnvelope<TRow> {
	return (
		Boolean(data) &&
		typeof data === "object" &&
		Array.isArray((data as SpringPageEnvelope<TRow>).content) &&
		typeof (data as SpringPageEnvelope<TRow>).totalElements === "number"
	);
}

export interface QueryRowMutationSnapshot<TRow> {
	readonly previousListQueries: ReadonlyArray<
		readonly [QueryKey, SpringPageEnvelope<TRow> | undefined]
	>;
	readonly previousDetailQuery: TRow | undefined;
	readonly hasDetailSnapshot: boolean;
}

export interface QueryRowMutationAdapterOptions<
	TRow extends { readonly id: string },
	TPatch = Partial<TRow>,
> {
	/**
	 * Query key prefix matching all cached `SpringPageEnvelope<TRow>` list queries
	 * (e.g. `['flows', collabId]`).
	 */
	readonly queryKeyPrefix: QueryKey;
	/**
	 * Optional query key factory for a detail panel / single-row cache entry that
	 * mirrors the edited row (`"multiple places on screen"`).
	 * e.g. `(id) => ['flow-detail', collabId, id]`
	 */
	readonly detailQueryKey?: ((id: string) => QueryKey) | undefined;
	/**
	 * Executes the row update against the backend / mock API.
	 */
	readonly mutationFn: (id: string, patch: TPatch) => Promise<TRow>;
	/**
	 * Merges `patch` onto an existing `TRow` for optimistic cache updates.
	 */
	readonly applyPatch?: ((row: TRow, patch: TPatch) => TRow) | undefined;
	/**
	 * Extracts the stable row identifier.
	 * @default (row) => row.id
	 */
	readonly getRowId?: ((row: TRow) => string) | undefined;
	/**
	 * Whether `onSettled` invalidates `queryKeyPrefix` (and `detailQueryKey(id)`).
	 * @default true
	 */
	readonly invalidateOnSettled?: boolean | undefined;
}

export interface QueryRowMutationPort<
	TRow extends { readonly id: string },
	TPatch = Partial<TRow>,
> extends RowMutationPort<TRow, TPatch> {
	/**
	 * Returns the mapped RFC 7807 `problem+json` `errors{}` field map for a given row ID,
	 * if the most recent mutation for that row failed with field validation errors.
	 */
	getFieldErrors(rowId: string): Readonly<Record<string, string>> | undefined;
	/**
	 * Returns the most recent row-level error message for a given row ID.
	 */
	getRowError(rowId: string): string | undefined;
}

interface ExternalMutationState {
	readonly pendingIds: ReadonlySet<string>;
	readonly errorsById: Readonly<Record<string, string>>;
	readonly fieldErrorsById: Readonly<
		Record<string, Readonly<Record<string, string>>>
	>;
}

export function createQueryRowMutationAdapter<
	TRow extends { readonly id: string },
	TPatch = Partial<TRow>,
>(
	options: QueryRowMutationAdapterOptions<TRow, TPatch>,
): QueryRowMutationPort<TRow, TPatch> {
	const {
		queryKeyPrefix,
		detailQueryKey,
		mutationFn,
		applyPatch = (row: TRow, patch: TPatch): TRow => ({
			...row,
			...(patch as unknown as Partial<TRow>),
		}),
		getRowId = (row: TRow): string => row.id,
		invalidateOnSettled = true,
	} = options;

	let externalState: ExternalMutationState = {
		pendingIds: new Set<string>(),
		errorsById: {},
		fieldErrorsById: {},
	};
	const listeners = new Set<() => void>();

	const notify = () => {
		for (const listener of listeners) {
			listener();
		}
	};

	const subscribe = (listener: () => void) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	};

	const getSnapshot = () => externalState;

	const markPending = (id: string) => {
		const nextPending = new Set(externalState.pendingIds);
		nextPending.add(id);
		const nextErrors = { ...externalState.errorsById };
		delete nextErrors[id];
		const nextFieldErrors = { ...externalState.fieldErrorsById };
		delete nextFieldErrors[id];
		externalState = {
			pendingIds: nextPending,
			errorsById: nextErrors,
			fieldErrorsById: nextFieldErrors,
		};
		notify();
	};

	const recordError = (
		id: string,
		message: string,
		fieldErrors?: Readonly<Record<string, string>>,
	) => {
		const nextPending = new Set(externalState.pendingIds);
		nextPending.delete(id);
		const nextFieldErrors = { ...externalState.fieldErrorsById };
		if (fieldErrors && Object.keys(fieldErrors).length > 0) {
			nextFieldErrors[id] = { ...fieldErrors };
		} else {
			delete nextFieldErrors[id];
		}
		externalState = {
			pendingIds: nextPending,
			errorsById: { ...externalState.errorsById, [id]: message },
			fieldErrorsById: nextFieldErrors,
		};
		notify();
	};

	const clearPending = (id: string) => {
		if (!externalState.pendingIds.has(id)) {
			return;
		}
		const nextPending = new Set(externalState.pendingIds);
		nextPending.delete(id);
		externalState = {
			...externalState,
			pendingIds: nextPending,
		};
		notify();
	};

	return {
		getFieldErrors(rowId: string) {
			return externalState.fieldErrorsById[rowId];
		},
		getRowError(rowId: string) {
			return externalState.errorsById[rowId];
		},
		useUpdateRow(): RowMutationHandle<TRow, TPatch> {
			const queryClient = useQueryClient();
			const snapshotState = React.useSyncExternalStore(
				subscribe,
				getSnapshot,
				getSnapshot,
			);

			const mutation = useMutation<
				TRow,
				unknown,
				{ readonly id: string; readonly patch: TPatch },
				QueryRowMutationSnapshot<TRow>
			>({
				mutationFn: ({ id, patch }) => mutationFn(id, patch),
				onMutate: async ({ id, patch }) => {
					markPending(id);

					// 1. Snapshot all matching list queries + optional detail query BEFORE writing
					const matchingEntries = queryClient.getQueriesData<
						SpringPageEnvelope<TRow>
					>({
						queryKey: queryKeyPrefix,
					});
					const previousListQueries: Array<
						readonly [QueryKey, SpringPageEnvelope<TRow> | undefined]
					> = matchingEntries.map(([key, page]) => [key, page]);

					const detailKey = detailQueryKey?.(id);
					const hasDetailSnapshot = detailKey !== undefined;
					const previousDetailQuery = detailKey
						? queryClient.getQueryData<TRow>(detailKey)
						: undefined;

					// 2. Cancel any in-flight queries so stale responses cannot overwrite the optimistic cache write
					const cancelPromises: Promise<void>[] = [
						queryClient.cancelQueries({ queryKey: queryKeyPrefix }),
					];
					if (detailKey) {
						cancelPromises.push(
							queryClient.cancelQueries({ queryKey: detailKey }),
						);
					}

					// 3. Optimistically write the patched row into every cached SpringPageEnvelope<TRow>
					for (const [key, page] of previousListQueries) {
						if (!isSpringPageEnvelope<TRow>(page)) {
							continue;
						}
						let touched = false;
						const nextContent = page.content.map((row) => {
							if (getRowId(row) === id) {
								touched = true;
								return applyPatch(row, patch);
							}
							return row;
						});
						if (touched) {
							queryClient.setQueryData<SpringPageEnvelope<TRow>>(key, {
								...page,
								content: nextContent,
							});
						}
					}

					// 4. Optimistically write the patched row into the detail panel query cache ("multiple places on screen")
					if (detailKey && previousDetailQuery !== undefined) {
						queryClient.setQueryData<TRow>(
							detailKey,
							applyPatch(previousDetailQuery, patch),
						);
					}

					await Promise.all(cancelPromises);

					return {
						previousListQueries,
						previousDetailQuery,
						hasDetailSnapshot,
					};
				},
				onSuccess: (updatedRow, { id }) => {
					// Keep cached pages + detail cache aligned with the authoritative response
					const matchingEntries = queryClient.getQueriesData<
						SpringPageEnvelope<TRow>
					>({
						queryKey: queryKeyPrefix,
					});
					for (const [key, page] of matchingEntries) {
						if (!isSpringPageEnvelope<TRow>(page)) {
							continue;
						}
						let touched = false;
						const nextContent = page.content.map((row) => {
							if (getRowId(row) === id) {
								touched = true;
								return updatedRow;
							}
							return row;
						});
						if (touched) {
							queryClient.setQueryData<SpringPageEnvelope<TRow>>(key, {
								...page,
								content: nextContent,
							});
						}
					}
					const detailKey = detailQueryKey?.(id);
					if (
						detailKey &&
						queryClient.getQueryData<TRow>(detailKey) !== undefined
					) {
						queryClient.setQueryData<TRow>(detailKey, updatedRow);
					}
				},
				onError: (err, { id, patch }, context) => {
					// 1. Roll back all snapshotted list queries
					if (context?.previousListQueries) {
						for (const [key, prevPage] of context.previousListQueries) {
							queryClient.setQueryData(key, prevPage);
						}
					}
					// 2. Roll back the snapshotted detail query
					const detailKey = detailQueryKey?.(id);
					if (detailKey && context?.hasDetailSnapshot) {
						queryClient.setQueryData(detailKey, context.previousDetailQuery);
					}

					// 3. Map RFC 7807 application/problem+json (422) errors{} back to field/row state
					const problem = extractProblemDetail(err);
					const message = problem
						? formatProblemDetailMessage(problem, patch)
						: err instanceof Error
							? err.message
							: "Mutation failed";
					recordError(id, message, problem?.errors);
				},
				onSettled: (_data, _error, { id }) => {
					clearPending(id);
					if (invalidateOnSettled) {
						void queryClient.invalidateQueries({ queryKey: queryKeyPrefix });
						const detailKey = detailQueryKey?.(id);
						if (detailKey) {
							void queryClient.invalidateQueries({ queryKey: detailKey });
						}
					}
				},
			});

			const mutate = async (id: string, patch: TPatch): Promise<TRow> => {
				try {
					return await mutation.mutateAsync({ id, patch });
				} catch (err) {
					const problem = extractProblemDetail(err);
					if (problem) {
						const mappedMessage = formatProblemDetailMessage(problem, patch);
						if (err instanceof Error && err.message === mappedMessage) {
							throw err;
						}
						throw new ProblemDetailError(problem, mappedMessage);
					}
					throw err instanceof Error ? err : new Error(String(err));
				}
			};

			return {
				mutate,
				pendingIds: snapshotState.pendingIds,
				errorsById: snapshotState.errorsById,
			};
		},
	};
}
