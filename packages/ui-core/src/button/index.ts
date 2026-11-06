/**
 * Button Public API (`@platform/ui`)
 *
 * Four-layer folder template with L2 (`button.ports.ts`) intentionally ABSENT:
 * - L1: `./button.behavior.ts`
 * - L2: (none — Tier 1 leaf carries zero capability ports)
 * - L3: `./button.parts.tsx`
 * - L4: `./button.styles.ts`
 */

export {
	type BaseButtonProps,
	type BaseButtonState,
	type ButtonBehaviorOptions,
	resolveButtonBehaviorProps,
} from "./button.behavior";
export {
	Button,
	type ButtonProps,
	type ButtonRenderProp,
	type ButtonRenderState,
} from "./button.parts";
export {
	type AppLinkLikeProps,
	buttonStoryMeta,
	RenderAsLinkStory,
	VariantAndSizeMatrixStory,
} from "./button.stories";
export {
	BUTTON_SIZES,
	BUTTON_VARIANTS,
	type ButtonSize,
	type ButtonStyleOptions,
	type ButtonVariant,
	getButtonClassName,
} from "./button.styles";
