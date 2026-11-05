import { create } from "zustand";

export const TOKEN_STORAGE_KEY = "catalogue.dev.token";

function readInitialToken(): string | null {
	if (typeof window === "undefined") {
		return null;
	}
	try {
		return window.localStorage.getItem(TOKEN_STORAGE_KEY);
	} catch {
		return null;
	}
}

export interface DevTokenStore {
	token: string | null;
	setToken: (token: string | null) => void;
}

export const useDevTokenStore = create<DevTokenStore>((set) => ({
	token: readInitialToken(),
	setToken: (token) => {
		if (typeof window !== "undefined") {
			try {
				if (token) {
					window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
				} else {
					window.localStorage.removeItem(TOKEN_STORAGE_KEY);
				}
			} catch {
				// Ignore storage access errors
			}
		}
		set({ token });
	},
}));

export function getDevToken(): string | null {
	const storeToken = useDevTokenStore.getState().token;
	if (storeToken !== null) {
		return storeToken;
	}
	const storageToken = readInitialToken();
	if (storageToken !== null) {
		useDevTokenStore.setState({ token: storageToken });
	}
	return storageToken;
}

export function setDevToken(token: string | null): void {
	useDevTokenStore.getState().setToken(token);
}
