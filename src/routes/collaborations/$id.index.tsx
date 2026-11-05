import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/collaborations/$id/")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/collaborations/$id/overview",
			params: { id: params.id },
		});
	},
});
