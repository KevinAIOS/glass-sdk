/**
 * @aios/glass/ui — WebView-side SDK entry point.
 *
 * Imported from a miniapp's `src/ui/main.tsx` (or equivalent) to access
 * the `aios` WebView global, React hooks, and the `AiosProvider`
 * wrapper. This is the **on-demand WebView side** of a two-layer miniapp.
 *
 * What's NOT in this entry point:
 *   - `MiniappSession` — background-only.
 *   - Any `session.*` module classes — background-only.
 *   - `__dispatch` / direct native access — by design, the WebView has
 *     no host-native APIs. All hardware calls go through the background
 *     bus via `aios.send(channel, payload)`.
 *
 * The `aios` global is injected into every UI WebView at mount time
 * by the host's `aiosUiShim` (see `@aios/engine/services/aiosUiShim`).
 * This entry point exports its TypeScript declaration so authors get
 * autocomplete and compile-time errors on channel names + payloads.
 */
export { AiosRpcError, AiosRpcTimeoutError } from "../modules/ui";
// React adapters are re-exported here so authors can import everything
// from a single sub-path. The actual hooks live in src/react/ and are
// already shipped as a separate sub-path for backwards-compat.
export { AiosProvider, } from "../react/AiosProvider";
export { MiniappHeader } from "../react/MiniappHeader";
export { useColorScheme } from "../react/useColorScheme";
export { useCapabilities } from "../react/useCapabilities";
export { useConnected } from "../react/useConnected";
export { useSafeArea } from "../react/useSafeArea";
export { useCapsuleHeaderStyle } from "../react/useCapsuleHeaderStyle";
export { useRpc } from "../react/useRpc";
export * from "./data";
