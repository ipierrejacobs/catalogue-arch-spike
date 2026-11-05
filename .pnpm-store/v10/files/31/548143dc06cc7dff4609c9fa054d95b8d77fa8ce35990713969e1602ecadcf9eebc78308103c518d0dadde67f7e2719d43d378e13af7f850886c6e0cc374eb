import { Awaitable } from '@tanstack/router-core';
export type HandlerInlineCssOption = boolean | ((ctx: {
    request: Request;
}) => Awaitable<boolean>);
/**
 * The inline-CSS choice that needs no handler callback: a request override
 * wins, then a static handler option, then the default. Undefined when a
 * handler callback has to decide.
 */
export declare function getStaticInlineCss(requestInlineCss: boolean | undefined, handlerInlineCss: HandlerInlineCssOption | undefined): boolean | undefined;
export declare function resolveInlineCssForRequest(opts: {
    request: Request;
    handlerInlineCss: HandlerInlineCssOption | undefined;
    requestInlineCss: boolean | undefined;
}): Promise<boolean>;
