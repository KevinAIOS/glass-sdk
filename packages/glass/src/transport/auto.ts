import {DispatchTransport} from "./dispatch"
import {LocalSocketTransport} from "./local-socket"
import {MockTransport, isMockExplicitlyRequested} from "./mock"
import {PostMessageTransport} from "./postmessage"
import type {Transport} from "./types"

export interface CreateTransportOptions {
  transport?: Transport
  /** Explicit development connection; never falls back to simulated success. */
  localSocketUrl?: string
}

export function createTransport(options: CreateTransportOptions = {}): Transport {
  if (options.transport) return options.transport
  if (DispatchTransport.isAvailable()) return new DispatchTransport()
  if (typeof window !== "undefined" && window.ReactNativeWebView) return new PostMessageTransport()
  if (isMockExplicitlyRequested()) return new MockTransport()
  if (options.localSocketUrl) return new LocalSocketTransport({url: options.localSocketUrl})
  throw new Error("AIOS Host unavailable. Install the app in AIOS, or explicitly select a test transport.")
}
