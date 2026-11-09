/**
 * Real `RowSourcePort` Adapter (`@platform/adapters`)
 *
 * Wraps TanStack Query `useQuery` with `placeholderData: keepPreviousData` and
 * maps a Spring Data `Page<TRow>` envelope (`{ content, totalElements, number, size, totalPages }`)
 * into `@platform/ports`'s `RowSourceResult<TRow>` (`{ rows, rowCount, status, error, isPlaceholderData }`).
 */

import type {
	DataTableQuery,
	RowSourcePort,
	RowSourceResult,
} from "@platform/ports";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export interface SpringPageEnvelope<TRow> {
	readonly content: readonly TRow[];
	readonly totalElements: number;
	readonly number: number;
	readonly size: number;
	readonly totalPages: number;
}

export interface QueryRowSourceAdapterOptions<
	TRow,
	TQuery = DataTableQuery,
> {
	/**
	 * Builds the TanStack Query key for a given table query.
	 * e.g. `(params) => ['flows', collabId, params]`
	 */
	readonly getQueryKey: (query: TQuery) => readonly unknown[];
	/**
	 * Fetches a Spring Data `Page<TRow>` for the given table query.
	 */
	readonly queryFn: (
		query: TQuery,
		context: { readonly signal: AbortSignal },
	) => Promise<SpringPageEnvelope<TRow>>;
	/**
	 * Cache stale time in milliseconds.
	 * @default 30_000
	 */
	readonly staleTime?: number | undefined;
	/**
	 * Retry policy for `useQuery`.
	 * @default false
	 */
	readonly retry?: boolean | number | undefined;
}

const EMPTY_ROWS: readonly never[] = [];

export function createQueryRowSourceAdapter<
	TRow,
	TQuery = DataTableQuery,
>(
	options: QueryRowSourceAdapterOptions<TRow, TQuery>,
): RowSourcePort<TRow, TQuery> {
	const { getQueryKey, queryFn, staleTime = 30_000, retry = false } = options;

	return {
		useRows(query: TQuery): RowSourceResult<TRow> {
			const result = useQuery({
				queryKey: getQueryKey(query),
				queryFn: ({ signal }) => queryFn(query, { signal }),
				placeholderData: keepPreviousData,
				staleTime,
				retry,
			});

			if (result.isError) {
				const message =
					result.error instanceof Error
						? result.error.message
						: "Failed to load rows";
				return {
					rows: EMPTY_ROWS as readonly TRow[],
					rowCount: 0,
					status: "error",
					error: message,
					isPlaceholderData: false,
				};
			}

			if (result.isPending && !result.data) {
				return {
					rows: EMPTY_ROWS as readonly TRow[],
					rowCount: 0,
					status: "loading",
					error: null,
					isPlaceholderData: false,
				};
			}

			return {
				rows: result.data?.content ?? (EMPTY_ROWS as readonly TRow[]),
				rowCount: result.data?.totalElements ?? 0,
				status: "success",
				error: null,
				isPlaceholderData: result.isPlaceholderData,
			};
		},
	};
}
