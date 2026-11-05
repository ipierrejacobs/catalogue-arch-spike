import { DevEnvironment, Rollup } from 'vite';
export type DevStylesEnvironment = Pick<DevEnvironment, 'transformRequest'> & {
    moduleGraph: Pick<DevEnvironment['moduleGraph'], 'getModuleByUrl'>;
};
export interface CollectDevStylesOptions {
    serverEnvironment: DevStylesEnvironment;
    rootDirectory: string;
    entries: Array<string>;
    loadCssContents: (url: string) => Promise<string | undefined>;
}
/**
 * Collect CSS content from the module graph starting from the given entry points.
 */
export declare function collectDevStyles(opts: CollectDevStylesOptions): Promise<string | undefined>;
export declare function fetchCssFromModule(environment: DevStylesEnvironment, url: string): Promise<string | undefined>;
/**
 * Extract CSS content from Vite's transformed CSS module code.
 *
 * Vite embeds CSS into the module as a JS string via `JSON.stringify(cssContent)`,
 * e.g. `const __vite__css = ${JSON.stringify('...css...')}`.
 *
 * We locate that JSON string literal and run `JSON.parse` on it to reverse the
 * escaping (\\n, \\t, \\", \\\\, \\uXXXX, etc.).
 */
export declare function extractCssFromCode(code: string): string | undefined;
/** Snapshot the completed bundle without retaining its plugin context or JS. */
export declare function captureBundledDevStyles(graph: Pick<Rollup.PluginContext, 'getModuleIds' | 'getModuleInfo'>, rootDirectory: string): {
    rootDirectory: string;
    css: Map<string, string>;
    dependencies: Map<string, readonly string[]>;
};
export declare function collectBundledDevStyles(snapshot: ReturnType<typeof captureBundledDevStyles> | undefined, entries: Array<string>): string | undefined;
