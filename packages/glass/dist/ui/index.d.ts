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
import type { IsRpc, RpcReq, RpcRes, RpcRequestOptions } from "../modules/ui";
export type { Rpc, IsRpc, RpcReq, RpcRes, RpcRequestOptions, RpcHandlerContext } from "../modules/ui";
export { AiosRpcError, AiosRpcTimeoutError } from "../modules/ui";
export interface AiosUiGlobal<TChannels extends object = Record<string, unknown>> {
    /**
     * Broadcast a typed message to the bound background JSContext.
     * Buffered until `ready()` acks; once acked, fires immediately.
     * Compile-error if `C` is an RPC channel — use `request()` instead.
     */
    send<C extends keyof TChannels & string>(channel: IsRpc<TChannels[C]> extends true ? never : C, payload: TChannels[C]): void;
    /**
     * Subscribe to broadcast messages from the background. Compile-error
     * if `C` is an RPC channel.
     */
    on<C extends keyof TChannels & string>(channel: IsRpc<TChannels[C]> extends true ? never : C, cb: (payload: TChannels[C]) => void): () => void;
    /**
     * Make an RPC call to the background `session.ui.handle(channel, ...)`
     * handler. On failure, throws an `Error` whose `name` is one of:
     *   - `"AiosRpcError"` — the handler threw. `err.cause?.code` may be set.
     *   - `"AiosRpcTimeoutError"` — `options.timeout` elapsed.
     *   - `"AbortError"` — `options.signal` aborted.
     * Distinguish by `err.name`, not `instanceof` — these errors are
     * constructed in the WebView's bare runtime scope. No default timeout.
     */
    request<C extends keyof TChannels & string>(channel: IsRpc<TChannels[C]> extends true ? C : never, payload: RpcReq<TChannels[C]>, options?: RpcRequestOptions): Promise<RpcRes<TChannels[C]>>;
    /**
     * Fires when the bridge is open and `aios.send` is flushable. If
     * subscribed AFTER `ready()` has been called, fires immediately.
     */
    onOpen(cb: () => void): () => void;
    /**
     * Fires when the host is about to destroy the WebView. Handlers
     * should snapshot any session state into background via
     * `aios.send` if they want it to survive.
     */
    onClose(cb: () => void): () => void;
    /**
     * MUST be called once on UI bootstrap. Tells the host the WebView is
     * mounted and ready to receive messages from background. Idempotent
     * — subsequent calls no-op. Background's `session.ui.onOpen` handlers
     * fire after this lands.
     */
    ready(): void;
}
export { AiosProvider, type AiosProviderProps, } from "../react/AiosProvider";
export { MiniappHeader } from "../react/MiniappHeader";
export { useColorScheme } from "../react/useColorScheme";
export { useCapabilities } from "../react/useCapabilities";
export { useConnected } from "../react/useConnected";
export { useSafeArea } from "../react/useSafeArea";
export { useCapsuleHeaderStyle } from "../react/useCapsuleHeaderStyle";
export { useRpc, type RpcCallable } from "../react/useRpc";
/**
 * Type helper for declaring a typed `aios` global inside a miniapp.
 *
 * Every mini app should declare ONE global `aios` typed against its
 * own channel registry. The SDK no longer auto-declares the global so
 * each miniapp's registry doesn't collide with the SDK's default.
 *
 * Usage (in your miniapp's `src/shared/channels.ts`):
 *
 * ```ts
 * import type {AiosTyped} from "@aios/glass/ui"
 *
 * export interface Channels {
 *   "live-transcript": {text: string}
 * }
 *
 * declare global {
 *   // eslint-disable-next-line no-var
 *   var aios: AiosTyped<Channels>
 * }
 * ```
 *
 * Both halves of the miniapp (background + UI) import this same file,
 * so the typed shape is consistent across the bridge.
 */
export type AiosTyped<TChannels extends object> = AiosUiGlobal<TChannels>;
export * from "./data";
