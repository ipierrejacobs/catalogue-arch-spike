/**
 * Application-owned link adapter (`src/components/AppLink.tsx`).
 *
 * Designed to be passed into `<Button render={<AppLink to="/orders" />}>`
 * via Base UI's `render` prop. `Button` in `@platform/ui` knows nothing about
 * routing or `AppLink`; all link target and navigation semantics live here in the app.
 */

import { mergeProps } from "@base-ui/react/merge-props";
import type * as React from "react";

export interface AppLinkProps
	extends Omit<React.ComponentPropsWithRef<"a">, "href"> {
	/**
	 * Application route path (mapped to `href` on the rendered `<a>` element).
	 */
	to: string;
	/**
	 * Optional navigation callback invoked when the link is activated (when not disabled).
	 */
	onNavigate?:
		| ((to: string, event: React.MouseEvent<HTMLAnchorElement>) => void)
		| undefined;
}

export function AppLink(props: AppLinkProps): React.ReactElement {
	const { to, onNavigate, ref, children, ...anchorProps } = props;
	const isDisabled =
		anchorProps["aria-disabled"] === true ||
		anchorProps["aria-disabled"] === "true" ||
		"data-disabled" in anchorProps;

	const mergedProps = mergeProps<"a">(
		{
			onClick(event: React.MouseEvent<HTMLAnchorElement>) {
				if (isDisabled || event.defaultPrevented) {
					event.preventDefault();
					return;
				}
				if (onNavigate) {
					event.preventDefault();
					onNavigate(to, event);
				}
			},
		},
		anchorProps,
	);

	return (
		<a
			{...mergedProps}
			ref={ref}
			href={isDisabled ? undefined : to}
			data-app-link="true"
		>
			{children}
		</a>
	);
}
