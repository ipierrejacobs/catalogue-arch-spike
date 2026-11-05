import { expect, test } from "@playwright/test";

test.describe("P1 routing shell & client auth guard smoke", () => {
	test("cold-loads /collaborations/col_8f3/consumers unauthed -> redirects to /login?redirect=.../consumers -> picks editor -> returns to .../consumers", async ({
		page,
	}) => {
		// Ensure unauthenticated cold load
		await page.goto("/collaborations/col_8f3/consumers");

		// Guard redirects to /login?redirect=%2Fcollaborations%2Fcol_8f3%2Fconsumers
		await expect(page).toHaveURL(/\/login\?redirect=%2Fcollaborations%2Fcol_8f3%2Fconsumers/);
		await expect(page.getByTestId("login-redirect-target")).toHaveText(
			"/collaborations/col_8f3/consumers",
		);

		// Pick Editor fixture
		await page.getByTestId("login-as-editor").click();

		// Restores the original deep link intact
		await expect(page).toHaveURL(/\/collaborations\/col_8f3\/consumers$/);
		await expect(page.getByTestId("tab-panel-consumers")).toBeVisible();
		await expect(page.getByTestId("edit-collaboration-button")).toBeEnabled();

		// Switch role to Viewer -> Edit button becomes disabled with reason
		await page.getByTestId("role-switch-viewer").click();
		await expect(page.getByTestId("edit-collaboration-button")).toBeDisabled();
		await expect(page.getByTestId("edit-disabled-reason")).toContainText(
			"Requires CATALOGUE_EDITOR",
		);

		// Verify all four tabs and edit drawer are deep-linkable and back/forward-correct
		await page.getByTestId("tab-flows").click();
		await expect(page).toHaveURL(/\/collaborations\/col_8f3\/flows$/);
		await expect(page.getByTestId("tab-panel-flows")).toBeVisible();

		await page.getByTestId("tab-lineage").click();
		await expect(page).toHaveURL(/\/collaborations\/col_8f3\/lineage$/);
		await expect(page.getByTestId("tab-panel-lineage")).toBeVisible();

		await page.goBack();
		await expect(page).toHaveURL(/\/collaborations\/col_8f3\/flows$/);

		await page.getByTestId("tab-overview").click();
		await expect(page).toHaveURL(/\/collaborations\/col_8f3\/overview$/);
		await expect(page.getByTestId("tab-panel-overview")).toBeVisible();

		await page.getByTestId("tab-consumers").click();
		await expect(page).toHaveURL(/\/collaborations\/col_8f3\/consumers$/);

		// Switch role to Expired -> silent refresh -> redirect back to login preserving return path, no white screen
		await page.getByTestId("role-switch-expired").click();
		await expect(page).toHaveURL(/\/login\?redirect=%2Fcollaborations%2Fcol_8f3%2Fconsumers/);
		await expect(page.getByTestId("login-screen")).toBeVisible();
	});

	test("blocks an unhandled /api/* request from escaping to the network", async ({
		page,
	}) => {
		await page.goto("/login");
		await expect(page.getByTestId("login-as-editor")).toBeEnabled();

		const result = await page.evaluate(async () => {
			try {
				await fetch("/api/__unhandled_probe__");
				return "performed";
			} catch {
				return "blocked";
			}
		});
		expect(result).toBe("blocked");
	});
});
