/**
 * @fileoverview Shape of window.AIOSGlass, injected by the host AIOSGlass app
 * before the miniapp's content loads. Miniapp authors generally won't read
 * this directly — use the typed React hooks (useSafeArea, etc.) instead.
 */
/** Reads window.AIOSGlass safely — returns an empty object if not set. */
export function getAIOSGlassGlobals() {
    if (typeof window === "undefined")
        return {};
    return window.AIOSGlass ?? {};
}
