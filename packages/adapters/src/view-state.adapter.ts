/**
 * Real `ViewStatePort` Adapter (`@platform/adapters`)
 *
 * Backed by a Zustand store (`zustand` v5) for app-scoped UI view state:
 * multi-row selection, bulk-action mode, column visibility preferences, and saved views.
 *
 * ARCHITECTURAL LAW (`AGENTS.md` §5 State-Placement Law):
 * - Selection, bulk-action mode, and saved view preferences live here in Zustand (via `ViewStatePort`).
 * - Server row payloads (`IntegrationFlow[]`) NEVER enter this store; they live exclusively
 *   in TanStack Query (via `RowSourcePort`).
 * - `@platform/ui` (`DataTable`) never imports `zustand`; it interacts strictly through `ViewStatePort`.
 */

import type { DataTableViewState, ViewStatePort } from "@platform/ports";
import { create, type StoreApi, type UseBoundStore } from "zustand";

export interface ZustandViewStateSlice<TState = DataTableViewState> {
	/**
	 * Active view states keyed by `viewStateKey` (e.g. `"flows-view-col_8f3"`).
	 */
	readonly viewsByKey: Readonly<Record<string, TState>>;
	/**
	 * Named saved view presets keyed by `viewStateKey` -> `presetName` -> `TState`.
	 */
	readonly savedPresetsByKey: Readonly<
		Record<string, Readonly<Record<string, TState>>>
	>;
	readonly setView: (key: string, state: TState) => void;
	readonly savePreset: (
		key: string,
		presetName: string,
		state: TState,
	) => void;
	readonly loadPreset: (key: string, presetName: string) => TState | undefined;
	readonly clear: () => void;
}

export type ZustandViewStateStore<TState = DataTableViewState> = UseBoundStore<
	StoreApi<ZustandViewStateSlice<TState>>
>;

export interface ZustandViewStateAdapterOptions<TState = DataTableViewState> {
	/**
	 * Initial view state entries keyed by `viewStateKey`.
	 */
	readonly initialEntries?: Readonly<Record<string, TState>> | undefined;
	/**
	 * Optional existing Zustand store instance to share across adapter instances.
	 */
	readonly store?: ZustandViewStateStore<TState> | undefined;
}

export interface ZustandViewStatePort<TState = DataTableViewState>
	extends ViewStatePort<TState> {
	/**
	 * Underlying Zustand store holding `viewsByKey` and `savedPresetsByKey`.
	 */
	readonly store: ZustandViewStateStore<TState>;
	readonly savePreset: (
		key: string,
		presetName: string,
		state: TState,
	) => void;
	readonly loadPreset: (key: string, presetName: string) => TState | undefined;
	readonly clear: () => void;
}

export function createZustandViewStateStore<TState = DataTableViewState>(
	initialEntries?: Readonly<Record<string, TState>>,
): ZustandViewStateStore<TState> {
	const initialViews: Readonly<Record<string, TState>> = initialEntries
		? { ...initialEntries }
		: {};

	return create<ZustandViewStateSlice<TState>>((set, get) => ({
		viewsByKey: initialViews,
		savedPresetsByKey: {},
		setView: (key: string, state: TState) => {
			set((current) => ({
				viewsByKey: {
					...current.viewsByKey,
					[key]: state,
				},
			}));
		},
		savePreset: (key: string, presetName: string, state: TState) => {
			set((current) => ({
				savedPresetsByKey: {
					...current.savedPresetsByKey,
					[key]: {
						...(current.savedPresetsByKey[key] ?? {}),
						[presetName]: state,
					},
				},
			}));
		},
		loadPreset: (key: string, presetName: string) => {
			const preset = get().savedPresetsByKey[key]?.[presetName];
			if (preset !== undefined) {
				get().setView(key, preset);
			}
			return preset;
		},
		clear: () => {
			set({
				viewsByKey: {},
				savedPresetsByKey: {},
			});
		},
	}));
}

export function createZustandViewStateAdapter<TState = DataTableViewState>(
	options?: ZustandViewStateAdapterOptions<TState>,
): ZustandViewStatePort<TState> {
	const store =
		options?.store ?? createZustandViewStateStore<TState>(options?.initialEntries);

	if (options?.store && options.initialEntries) {
		for (const [key, state] of Object.entries(options.initialEntries)) {
			store.getState().setView(key, state);
		}
	}

	return {
		store,
		load(key: string): TState | undefined {
			return store.getState().viewsByKey[key];
		},
		save(key: string, state: TState): void {
			store.getState().setView(key, state);
		},
		subscribe(key: string, listener: () => void): () => void {
			let previous = store.getState().viewsByKey[key];
			return store.subscribe((nextState) => {
				const current = nextState.viewsByKey[key];
				if (current !== previous) {
					previous = current;
					listener();
				}
			});
		},
		savePreset(key: string, presetName: string, state: TState): void {
			store.getState().savePreset(key, presetName, state);
		},
		loadPreset(key: string, presetName: string): TState | undefined {
			return store.getState().loadPreset(key, presetName);
		},
		clear(): void {
			store.getState().clear();
		},
	};
}
