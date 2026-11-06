/**
 * Button Stories & Graduated-Capability Metadata (`@platform/ui`)
 *
 * Tier 1 — Interactive Atom (Negative Proof: L2 Ports layer is ABSENT).
 */

import type * as React from "react";
import type { GraduatedComponentMeta } from "../index";
import { Button } from "./button.parts";
import {
	BUTTON_SIZES,
	BUTTON_VARIANTS,
	type ButtonSize,
	type ButtonVariant,
} from "./button.styles";

export const buttonStoryMeta: GraduatedComponentMeta<1> & {
	readonly title: "Primitives/Button";
	readonly capabilityMatrix: {
		readonly presentation: "●";
		readonly tokens: "●";
		readonly a11yBehavior: "●";
		readonly internalUiState: "◐";
		readonly routingPort: "○";
		readonly serverDataPort: "○";
		readonly appStatePort: "○";
		readonly sessionPermissionPort: "○";
	};
} = {
	title: "Primitives/Button",
	name: "Button",
	tier: 1,
	capabilities: ["presentation", "tokens", "a11y-behavior"],
	layersPopulated: ["behavior", "parts", "styles"],
	capabilityMatrix: {
		presentation: "●",
		tokens: "●",
		a11yBehavior: "●",
		internalUiState: "◐",
		routingPort: "○",
		serverDataPort: "○",
		appStatePort: "○",
		sessionPermissionPort: "○",
	},
};

export default buttonStoryMeta;

/**
 * Variant x Size matrix story: demonstrates all 4 token variants (`solid`, `soft`, `ghost`, `danger`)
 * across all 3 token sizes (`sm`, `md`, `lg`) plus `disabled`.
 */
export function VariantAndSizeMatrixStory(): React.ReactElement {
	return (
		<div className="flex flex-col gap-4 p-4 bg-canvas text-fg-primary">
			{BUTTON_VARIANTS.map((variant: ButtonVariant) => (
				<div key={variant} className="flex items-center gap-3">
					<span className="w-20 font-mono text-fg-secondary">{variant}</span>
					{BUTTON_SIZES.map((size: ButtonSize) => (
						<Button
							key={`${variant}-${size}`}
							variant={variant}
							size={size}
							data-testid={`btn-${variant}-${size}`}
						>
							{variant} ({size})
						</Button>
					))}
					<Button
						variant={variant}
						size="md"
						disabled
						data-testid={`btn-${variant}-disabled`}
					>
						{variant} (disabled)
					</Button>
				</div>
			))}
		</div>
	);
}

export interface AppLinkLikeProps
	extends Omit<React.ComponentPropsWithRef<"a">, "href"> {
	to: string;
}

function DefaultStoryAppLink({
	to,
	children,
	...rest
}: AppLinkLikeProps): React.ReactElement {
	return (
		<a href={to} data-story-link="true" {...rest}>
			{children}
		</a>
	);
}

/**
 * Render-as-link story: demonstrates `<Button render={<AppLink to="/orders" />}>`
 * where `AppLink` is supplied by the caller/application, not imported by `Button`.
 */
export function RenderAsLinkStory({
	LinkComponent = DefaultStoryAppLink,
}: {
	LinkComponent?: React.ComponentType<AppLinkLikeProps>;
} = {}): React.ReactElement {
	return (
		<div className="flex items-center gap-3 p-4 bg-canvas text-fg-primary">
			<Button
				variant="solid"
				size="md"
				render={<LinkComponent to="/orders" />}
				data-testid="btn-render-as-link"
			>
				Go to Orders
			</Button>
			<Button
				variant="soft"
				size="sm"
				render={(props, state) => (
					<LinkComponent
						{...props}
						to="/collaborations/collab-1/flows"
						data-rendered-variant={state.variant}
					/>
				)}
				data-testid="btn-render-fn-link"
			>
				Inspect Flows
			</Button>
			<Button
				variant="ghost"
				size="md"
				disabled
				render={<LinkComponent to="/orders/locked" />}
				data-testid="btn-render-disabled-link"
			>
				Locked Route
			</Button>
		</div>
	);
}
