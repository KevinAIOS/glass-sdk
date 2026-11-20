/** Handles both early and late native WebView injection without synthetic connections. */
export function onHostReady(callback) {
    if (typeof window === "undefined")
        return () => { };
    let initialized = false;
    const receive = () => {
        const bridge = window.aios;
        if (!initialized && bridge) {
            initialized = true;
            callback(bridge);
        }
    };
    window.addEventListener("aios:host-ready", receive);
    receive();
    return () => window.removeEventListener("aios:host-ready", receive);
}
