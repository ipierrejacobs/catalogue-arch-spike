/**
 * L3 — Button Parts & Composition (`@platform/ui`)
 *
 * Wraps L1 Base UI Button behavior + L4 token-driven styles, exposing the
 * Base UI `render` prop contract (`ReactElement | (props, state) => ReactElement`)
 * powered by `@base-ui/react/use-render` and `@base-ui/react/merge-props`.
 *
 * RULE: NO `asChild` / `Slot`. Element substitution (such as rendering `<Button>`
 * as an app-supplied `<AppLink to="/orders" />`) goes strictly through `render`.
 */

import { mergeProps } from "@base-ui/react/merge-props";
import type { useRender } from "@base-ui/react/use-render";
import type * as React from "react";
import {
	BaseButton,
	type BaseButtonProps,
	type BaseButtonState,
	type ButtonBehaviorOptions,
	resolveButtonBehaviorProps,
} from "./button.behavior";
import {
	type ButtonSize,
	type ButtonVariant,
	getButtonClassName,
} from "./button.styles";

export interface ButtonRenderState
	extends BaseButtonState,
		Record<string, unknown> {
	readonly variant: ButtonVariant;
	readonly size: ButtonSize;
}

export type ButtonRenderProp = useRender.RenderProp<ButtonRenderState>;

export interface ButtonProps
	extends ButtonBehaviorOptions,
		Omit<
			useRender.ComponentProps<"button", ButtonRenderState>,
			"className" | "disabled" | "render" | "ref"
		> {
	/**
	 * Visual token variant.
	 * @default "solid"
	 */
	variant?: ButtonVariant | undefined;
	/**
	 * Control size token.
	 * @default "md"
	 */
	size?: ButtonSize | undefined;
	/**
	 * Base UI composition prop: replaces the default `<button>` element with
	 * another element (e.g. `<Button render={<AppLink to="/orders" />}>`) or
	 * a render callback `(props, state) => ReactElement`.
	 */
	render?: ButtonRenderProp | undefined;
	/**
	 * Optional caller className merged with token classes.
	 */
	className?: string | undefined;
	/**
	 * React 19 ref as a regular prop.
	 */
	ref?: React.Ref<HTMLElement> | undefined;
}

export function Button(props: ButtonProps): React.ReactElement {
	const {
		variant = "solid",
		size = "md",
		disabled = false,
		focusableWhenDisabled = false,
		nativeButton,
		render,
		className,
		ref,
		...elementProps
	} = props;

	const behaviorProps = resolveButtonBehaviorProps({
		disabled,
		focusableWhenDisabled,
		nativeButton,
		hasCustomRender: render !== undefined,
	});

	const resolvedClassName = getButtonClassName({
		variant,
		size,
		className,
	});

	const mergedElementProps = mergeProps<"button">(elementProps, {
		className: resolvedClassName,
		"data-variant": variant,
		"data-size": size,
	} as React.ComponentPropsWithRef<"button">);

	const adaptedRender: BaseButtonProps["render"] =
		typeof render === "function"
			? (htmlProps, baseState) =>
					render(htmlProps, {
						...baseState,
						variant,
						size,
					})
			: render;

	return (
		<BaseButton
			{...mergedElementProps}
			{...behaviorProps}
			ref={ref}
			render={adaptedRender}
		/>
	);
}
