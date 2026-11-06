/**
 * L4 — Button Presentation & Token Styles (`@platform/ui`)
 *
 * Maps `variant` (`solid | soft | ghost | danger`) and `size` (`sm | md | lg`)
 * strictly to token-backed Tailwind v4 `@theme inline` classes defined in
 * `@platform/tokens/tokens.css`.
 *
 * RULE: Zero raw hex, rgb, or pixel values.
 */

export const BUTTON_VARIANTS = ["solid", "soft", "ghost", "danger"] as const;
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

export const BUTTON_SIZES = ["sm", "md", "lg"] as const;
export type ButtonSize = (typeof BUTTON_SIZES)[number];

const BASE_BUTTON_CLASSES = [
	"inline-flex items-center justify-center select-none",
	"rounded-btn font-sans font-btn transition-colors",
	"focus-visible:outline focus-visible:outline-border-focus",
	"data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed",
].join(" ");

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
	solid:
		"bg-btn-primary text-btn-primary-fg hover:bg-btn-primary-hover active:bg-btn-primary-active",
	soft: "bg-btn-soft text-btn-soft-fg border border-btn-soft-border hover:bg-btn-soft-hover",
	ghost: "bg-btn-ghost text-btn-ghost-fg hover:bg-btn-ghost-hover",
	danger: "bg-btn-danger text-btn-danger-fg hover:bg-btn-danger-hover",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
	sm: "h-btn-h-sm px-btn-px-sm text-btn-sm",
	md: "h-btn-h-md px-btn-px-md text-btn-md",
	lg: "h-btn-h-lg px-btn-px-lg text-btn-lg",
};

export interface ButtonStyleOptions {
	variant?: ButtonVariant | undefined;
	size?: ButtonSize | undefined;
	className?: string | undefined;
}

export function getButtonClassName(options: ButtonStyleOptions = {}): string {
	const variant = options.variant ?? "solid";
	const size = options.size ?? "md";
	return [
		BASE_BUTTON_CLASSES,
		VARIANT_CLASSES[variant],
		SIZE_CLASSES[size],
		options.className,
	]
		.filter(Boolean)
		.join(" ");
}
