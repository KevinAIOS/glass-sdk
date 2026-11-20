/**
 * registerMiniapp — entry hook for the background JSContext.
 *
 * The AiosJS host loads the polyfill (which installs __dispatch /
 * __deliver / timers / fetch / etc.), then evaluates the miniapp's
 * background bundle. After both scripts have evaluated successfully,
 * the host delivers a single `{kind: "init", sessionId}` envelope.
 * The polyfill turns that into a call to `__aiosInitCallback(sessionId)`.
 *
 * This module wires that callback to:
 *   1. Construct a `MiniappSession` (DispatchTransport picks itself
 *      automatically because `__dispatch` is on globalThis).
 *   2. Call the user-supplied handler synchronously so subscriptions
 *      are registered before any host events fan out.
 *   3. Call `session.connect()` so the host receives CONNECT and the
 *      first CONNECT_ACK populates `userId`, `capabilities`, etc.
 *
 * The handler runs once per spawn. If the host kills + respawns the
 * JSContext (crash recovery, dev reload), the polyfill + bundle are
 * re-evaluated and the handler fires again with a fresh session.
 */
import { MiniappSession } from "../session";
import { bindExperience, isExperienceDefinition } from "../experience";
export function registerMiniapp(handlerOrExperience, options = {}) {
    // SDK 0.5: a code Experience passes its `defineExperience(...)` default export;
    // the Host then dispatches events and tool calls to its handlers.
    const handler = isExperienceDefinition(handlerOrExperience)
        ? session => {
            bindExperience(session, handlerOrExperience).ready.catch((err) => {
                // eslint-disable-next-line no-console
                console.error("[aios-experience] host did not accept the Experience:", err);
            });
        }
        : handlerOrExperience;
    const g = globalThis;
    g.__aiosInitCallback = (_sessionId) => {
        const session = new MiniappSession(options);
        // Fire the user handler first so any session.* subscriptions get
        // registered before the CONNECT_ACK fan-out lands.
        try {
            const result = handler(session);
            if (result && typeof result.then === "function") {
                ;
                result.catch((err) => {
                    // eslint-disable-next-line no-console
                    console.error("[aios-miniapp] registerMiniapp handler rejected:", err);
                });
            }
        }
        catch (err) {
            // eslint-disable-next-line no-console
            console.error("[aios-miniapp] registerMiniapp handler threw:", err);
        }
        session.connect().catch((err) => {
            // eslint-disable-next-line no-console
            console.error("[aios-miniapp] session.connect() rejected:", err);
            // Surface to the host's crash controller as a structured uncaught
            // error so the existing backoff + crashloop machinery handles it.
            // Repeated connect failures eventually flip the miniapp to
            // CRASHLOOP_DISABLED, which the host turns into a user-facing
            // alert + automatic incident report.
            try {
                const message = err instanceof Error ? err.message : String(err);
                const stack = err instanceof Error && err.stack ? err.stack : "";
                g.__hostError?.(JSON.stringify({ message: `session.connect() failed: ${message}`, stack }));
            }
            catch {
                /* host bridge missing in tests — ignore */
            }
        });
    };
}
