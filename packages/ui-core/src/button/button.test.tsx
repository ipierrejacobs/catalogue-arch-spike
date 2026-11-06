// @vitest-environment jsdom
/**
 * Button Zero-Provider Unit & Architectural Contract Tests (`@platform/ui`)
 *
 * Proves the Stage 1 negative proof:
 * 1. `button.ports.ts` does NOT exist; `buttonStoryMeta` declares Tier 1 with all ports `○`.
 * 2. `<Button>` renders and passes all behavior/interaction tests with ZERO providers
 *    (no QueryClient, no Router, no SessionProvider, no port contexts).
 * 3. Render-as-link works via Base UI's `render` prop with the app-owned `AppLink`
 *    (`src/components/AppLink.tsx`), keeping link targets and routing out of `@platform/ui`.
 * 4. `button.styles.ts` contains zero raw hex, rgb, or px/rem literals.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppLink } from "../../../../src/components/AppLink";
import {
	BUTTON_SIZES,
	BUTTON_VARIANTS,
	Button,
	buttonStoryMeta,
	RenderAsLinkStory,
	VariantAndSizeMatrixStory,
} from "./index";

afterEach(() => {
	cleanup();
});

describe("Stage 1 — Button (Tier 1, Negative Proof)", () => {
	it("has NO button.ports.ts file and declares Tier 1 with zero capability ports in Storybook metadata", () => {
		const portsFilePath = resolve(
			process.cwd(),
			"packages/ui-core/src/button/button.ports.ts",
		);
		const portsTsxFilePath = resolve(
			process.cwd(),
			"packages/ui-core/src/button/button.ports.tsx",
		);

		expect(existsSync(portsFilePath)).toBe(false);
		expect(existsSync(portsTsxFilePath)).toBe(false);

		expect(buttonStoryMeta.tier).toBe(1);
		expect(buttonStoryMeta.layersPopulated).toEqual([
			"behavior",
			"parts",
			"styles",
		]);
		expect(buttonStoryMeta.capabilityMatrix).toEqual({
			presentation: "●",
			tokens: "●",
			a11yBehavior: "●",
			internalUiState: "◐",
			routingPort: "○",
			serverDataPort: "○",
			appStatePort: "○",
			sessionPermissionPort: "○",
		});
	});

	it("renders and handles press, disabled, and focusableWhenDisabled semantics with ZERO providers", () => {
		const onClick = vi.fn();
		const buttonRef = React.createRef<HTMLElement>();

		const { rerender } = render(
			<Button ref={buttonRef} onClick={onClick} data-testid="plain-btn">
				Save Collaboration
			</Button>,
		);

		const btn = screen.getByTestId("plain-btn");
		expect(btn.tagName).toBe("BUTTON");
		expect(btn.getAttribute("type")).toBe("button");
		expect(btn.getAttribute("data-variant")).toBe("solid");
		expect(btn.getAttribute("data-size")).toBe("md");
		expect(buttonRef.current).toBe(btn);

		fireEvent.click(btn);
		expect(onClick).toHaveBeenCalledTimes(1);

		// Disabled via prop (computed by caller, not read from session)
		rerender(
			<Button disabled onClick={onClick} data-testid="plain-btn">
				Save Collaboration
			</Button>,
		);
		expect(btn.hasAttribute("disabled")).toBe(true);
		expect(btn.hasAttribute("data-disabled")).toBe(true);
		fireEvent.click(btn);
		expect(onClick).toHaveBeenCalledTimes(1);

		// Focusable when disabled (e.g. viewer role button with tooltip reason)
		rerender(
			<Button
				disabled
				focusableWhenDisabled
				onClick={onClick}
				data-testid="plain-btn"
			>
				Save Collaboration
			</Button>,
		);
		expect(btn.getAttribute("aria-disabled")).toBe("true");
		expect(btn.getAttribute("tabindex")).toBe("0");
		fireEvent.click(btn);
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("substitutes element via Base UI render prop (render-as-link with app-supplied AppLink) with ZERO providers", () => {
		const onNavigate = vi.fn();

		render(
			<Button
				variant="solid"
				size="lg"
				render={<AppLink to="/orders" onNavigate={onNavigate} />}
				data-testid="link-btn"
			>
				View Orders
			</Button>,
		);

		const linkEl = screen.getByTestId("link-btn");
		expect(linkEl.tagName).toBe("A");
		expect(linkEl.getAttribute("href")).toBe("/orders");
		expect(linkEl.getAttribute("data-app-link")).toBe("true");
		expect(linkEl.getAttribute("role")).toBe("button");
		expect(linkEl.getAttribute("data-variant")).toBe("solid");
		expect(linkEl.getAttribute("data-size")).toBe("lg");
		expect(linkEl.className).toContain("bg-btn-primary");
		expect(linkEl.className).toContain("h-btn-h-lg");

		fireEvent.click(linkEl);
		expect(onNavigate).toHaveBeenCalledTimes(1);
		expect(onNavigate.mock.calls[0]?.[0]).toBe("/orders");
	});

	it("supports render callback substitution and blocks disabled link activation", () => {
		const onNavigate = vi.fn();

		render(<RenderAsLinkStory LinkComponent={(props) => <AppLink {...props} onNavigate={onNavigate} />} />);

		const fnLink = screen.getByTestId("btn-render-fn-link");
		expect(fnLink.tagName).toBe("A");
		expect(fnLink.getAttribute("href")).toBe("/collaborations/collab-1/flows");
		expect(fnLink.getAttribute("data-rendered-variant")).toBe("soft");

		fireEvent.click(fnLink);
		expect(onNavigate).toHaveBeenCalledWith(
			"/collaborations/collab-1/flows",
			expect.any(Object),
		);

		const disabledLink = screen.getByTestId("btn-render-disabled-link");
		expect(disabledLink.getAttribute("aria-disabled")).toBe("true");
		expect(disabledLink.hasAttribute("data-disabled")).toBe(true);
		fireEvent.click(disabledLink);
		expect(onNavigate).toHaveBeenCalledTimes(1);
	});

	it("renders all variants and sizes from @platform/tokens and has zero raw hex or pixel values in button.styles.ts", () => {
		render(<VariantAndSizeMatrixStory />);

		for (const variant of BUTTON_VARIANTS) {
			for (const size of BUTTON_SIZES) {
				const el = screen.getByTestId(`btn-${variant}-${size}`);
				expect(el.getAttribute("data-variant")).toBe(variant);
				expect(el.getAttribute("data-size")).toBe(size);
			}
			const disabledEl = screen.getByTestId(`btn-${variant}-disabled`);
			expect(disabledEl.hasAttribute("disabled")).toBe(true);
		}

		const stylesSource = readFileSync(
			resolve(process.cwd(), "packages/ui-core/src/button/button.styles.ts"),
			"utf8",
		);
		expect(stylesSource).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
		expect(stylesSource).not.toMatch(/\b(rgb|rgba|hsl|hsla|oklch)\s*\(/);
		expect(stylesSource).not.toMatch(/\b\d+(\.\d+)?(px|rem|em)\b/);
	});
});
