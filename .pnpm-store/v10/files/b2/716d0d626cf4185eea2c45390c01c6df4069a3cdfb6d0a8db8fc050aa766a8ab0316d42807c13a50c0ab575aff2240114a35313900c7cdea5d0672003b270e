import { Plugin as SerovalPlugin } from 'seroval';
import { StartEvent } from './internal-request-response.js';
/** Completed bytes own no stream until the request pipeline accepts them. */
export declare class DeferredResponse {
    private readonly body;
    constructor(body: Uint8Array);
    createResponse(event: StartEvent): Response;
}
/**
 * Marks a Response thrown during a server-function request so the client
 * rejects the call with it. Redirects keep their own protocol.
 */
export declare function toThrownServerFnResponse(response: Response): Response;
/**
 * Builds the reply for a server-function request that failed outside the
 * function, such as in request middleware. Like a failed call, it carries
 * only the thrown value under an `error` key, so the client rethrows it.
 */
export declare function createServerFnErrorResponse(error: unknown, serovalPlugins?: Array<SerovalPlugin<any, any>>): Promise<Response>;
export declare const handleServerAction: ({ request, serverFnId, }: {
    request: Request;
    serverFnId: string;
}) => Promise<any>;
