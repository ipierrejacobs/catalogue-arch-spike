import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";

async function enableMocking() {
	if (!import.meta.env.DEV) {
		return;
	}
	const { worker } = await import("./mocks/browser");
	await worker.start({
		onUnhandledFrame: "error",
	});
}

enableMocking().then(() => {
	startTransition(() => {
		hydrateRoot(
			document,
			<StrictMode>
				<StartClient />
			</StrictMode>,
		);
	});
});
