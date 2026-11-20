import type {AiosUiGlobal} from "./index"

/** Handles both early and late native WebView injection without synthetic connections. */
export function onHostReady<T extends object>(callback: (bridge: AiosUiGlobal<T>) => void): () => void {
  if (typeof window === "undefined") return () => {}
  let initialized = false
  const receive = () => {
    const bridge = (window as unknown as {aios?: AiosUiGlobal<T>}).aios
    if (!initialized && bridge) {
      initialized = true
      callback(bridge)
    }
  }
  window.addEventListener("aios:host-ready", receive)
  receive()
  return () => window.removeEventListener("aios:host-ready", receive)
}
