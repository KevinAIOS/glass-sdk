/**
 * @fileoverview Transport abstraction for @aios/glass.
 *
 * Two v1 implementations:
 *   - PostMessageTransport — inside AIOSGlass WebView, uses window.ReactNativeWebView
 *   - LocalSocketTransport — in external Safari/Chrome fallback, uses ws://127.0.0.1
 *
 * createTransport() in auto.ts picks the right one based on environment.
 */
export {};
