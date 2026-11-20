import { DispatchTransport } from "./dispatch";
import { LocalSocketTransport } from "./local-socket";
import { MockTransport, isMockExplicitlyRequested } from "./mock";
import { PostMessageTransport } from "./postmessage";
export function createTransport(options = {}) {
    if (options.transport)
        return options.transport;
    if (DispatchTransport.isAvailable())
        return new DispatchTransport();
    if (typeof window !== "undefined" && window.ReactNativeWebView)
        return new PostMessageTransport();
    if (isMockExplicitlyRequested())
        return new MockTransport();
    if (options.localSocketUrl)
        return new LocalSocketTransport({ url: options.localSocketUrl });
    throw new Error("AIOS Host unavailable. Install the app in AIOS, or explicitly select a test transport.");
}
