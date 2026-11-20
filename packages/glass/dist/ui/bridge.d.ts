import type { AiosUiGlobal } from "./index";
/** Handles both early and late native WebView injection without synthetic connections. */
export declare function onHostReady<T extends object>(callback: (bridge: AiosUiGlobal<T>) => void): () => void;
