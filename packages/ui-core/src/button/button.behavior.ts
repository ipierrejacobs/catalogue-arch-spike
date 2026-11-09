/**
 * L1 — Button Behavior (`@platform/ui`)
 *
 * Thin headless behavior wrapper around `@base-ui/react/button`.
 * Owns press, focus, keyboard activation (Enter/Space), and disabled semantics.
 *
 * NEGATIVE PROOF (Tier 1):
 * - No `button.ports.ts` exists in this folder.
 * - Authorization arrives strictly via `disabled` / `hidden` props computed by the caller.
 */

import { Button as BaseButton } from "@base-ui/react/button";
import type { ButtonProps as BaseButtonProps, ButtonState as BaseButtonState } from "@base-ui/react/button";

export { BaseButton };
export type { BaseButtonProps, BaseButtonState };

export interface ButtonBehaviorOptions {
	/**
	 * Whether the button ignores user interaction.
	 * Authorization rules must be resolved by the caller and passed here as a boolean.
	 * @default false
	 */
	disabled?: boolean | undefined;
	/**
	 * Whether the button remains focusable via keyboard when disabled (e.g. to surface a tooltip/reason).
	 * @default false
	 */
	focusableWhenDisabled?: boolean | undefined;
	/**
	 * Whether the rendered element is a native `<button>`.
	 * Defaults to `true` when rendering the default element, or `false` when a custom `render` element is supplied.
	 */
	nativeButton?: boolean | undefined;
}

/**
 * Resolves the Base UI `Button` behavior props for `<Button>`.
 */
export function resolveButtonBehaviorProps(
	options: ButtonBehaviorOptions & { hasCustomRender: boolean },
) {
	const disabled = Boolean(options.disabled);
	const focusableWhenDisabled = Boolean(options.focusableWhenDisabled);
	const nativeButton = options.nativeButton ?? !options.hasCustomRender;

	return {
		disabled,
		focusableWhenDisabled,
		nativeButton,
	};
}
