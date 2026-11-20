/**
 * @fileoverview EventManager — internal subscription registry + escape hatch.
 *
 * Most miniapp authors should NOT touch this directly. Use the typed methods
 * on domain modules instead:
 *   - session.transcription.on(...)
 *   - session.mic.onAudioChunk(...) / onVoiceActivity(...)
 *   - session.input.onButtonPress(...)
 *   - session.imu.onHeadPosition(...)
 *   - session.location.onUpdate(...)
 *   - session.glasses.onBattery(...) / onConnection(...)
 *   - session.phone.notifications.on(...) / session.phone.onBattery(...)
 *
 * This module's only public method is `subscribe(rawStreamType, handler)` —
 * a forward-compat escape hatch for new event types not yet wrapped on a
 * domain module. Officially undocumented; the typed methods on domain
 * modules are the canonical surface.
 *
 * Internally, EventManager owns:
 *   1. The ref-count map. Outbound SUBSCRIBE is only sent when a stream's
 *      ref count transitions 0↔1, so multiple components listening for the
 *      same stream issue one wire-level subscribe.
 *   2. Inbound event fan-out via `_forwardEvent(streamType, data)`, called
 *      by MiniappSession.handleIncoming when an EVENT envelope arrives.
 *
 * Domain modules call back into the session via session._subscribe(...) which
 * in turn delegates to this class — the session is the integration point;
 * domain modules don't see this class directly.
 */
import { EventEmitter } from "eventemitter3";
import { MiniappRequestType, MiniappStreamType } from "../protocol";
// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
export class EventManager {
    constructor(session) {
        this.session = session;
        this.emitter = new EventEmitter();
        /** Stream -> ref count. Outbound SUBSCRIBE tracks active streams and routing changes. */
        this.refCounts = new Map();
        /** Transcription stream -> refs that require on-device-only processing. */
        this.forceLocalRefCounts = new Map();
    }
    /**
     * Generic subscribe. `stream` is the raw wire value, including any language
     * suffix like `"transcription:en-US"`. Forward-compat escape hatch for new
     * event types not yet wrapped on a domain module. Most authors should use
     * typed methods on domain modules instead.
     *
     * Stream names beginning with `_` (e.g. `_ui` for the session.ui bus) are
     * INTERNAL — they ride the local _forwardEvent fan-out and never appear in
     * the outbound SUBSCRIBE list. Native already knows to deliver UI envelopes
     * via a separate envelope `type`; the EventManager only routes them
     * locally.
     */
    subscribe(stream, handler, options = {}) {
        const isInternal = stream.startsWith("_");
        const forceLocal = options.forceLocal === true && stream.startsWith(`${MiniappStreamType.TRANSCRIPTION}:`);
        const listener = (data, route) => {
            if (stream.startsWith(`${MiniappStreamType.TRANSCRIPTION}:`)) {
                // Hosts that predate routed transcription events omit `route`. Treat
                // those events as the default/cloud path so a forceLocal listener can
                // never accidentally receive cloud text.
                if (forceLocal ? route !== "forceLocal" && route !== "all" : route === "forceLocal")
                    return;
            }
            handler(data);
        };
        this.emitter.on(stream, listener);
        if (!isInternal) {
            const before = this.refCounts.get(stream) ?? 0;
            this.refCounts.set(stream, before + 1);
            const forceLocalBefore = this.forceLocalRefCounts.get(stream) ?? 0;
            const defaultBefore = before - forceLocalBefore;
            if (forceLocal)
                this.forceLocalRefCounts.set(stream, forceLocalBefore + 1);
            if (before === 0 || (forceLocal && forceLocalBefore === 0) || (!forceLocal && defaultBefore === 0)) {
                this.sendSubscriptionUpdate();
            }
        }
        return () => {
            this.emitter.off(stream, listener);
            if (isInternal)
                return;
            const current = this.refCounts.get(stream) ?? 0;
            const forceLocalCurrent = this.forceLocalRefCounts.get(stream) ?? 0;
            let subscriptionChanged = current <= 1;
            if (current <= 1) {
                this.refCounts.delete(stream);
            }
            else {
                this.refCounts.set(stream, current - 1);
            }
            if (forceLocal) {
                if (forceLocalCurrent <= 1) {
                    this.forceLocalRefCounts.delete(stream);
                    subscriptionChanged = true;
                }
                else {
                    this.forceLocalRefCounts.set(stream, forceLocalCurrent - 1);
                }
            }
            else if (current - forceLocalCurrent <= 1) {
                subscriptionChanged = true;
            }
            if (subscriptionChanged)
                this.sendSubscriptionUpdate();
        };
    }
    /** Unsubscribe every handler on every stream this EventManager owns. */
    unsubscribeAll() {
        this.emitter.removeAllListeners();
        this.refCounts.clear();
        this.forceLocalRefCounts.clear();
        this.sendSubscriptionUpdate();
    }
    // -------------------------------------------------------------------------
    // Internal — called by MiniappSession when EVENT arrives from phone
    // -------------------------------------------------------------------------
    /** @internal */
    _forwardEvent(stream, data, transcriptionRoute) {
        this.emitter.emit(stream, data, transcriptionRoute);
        // Wildcard fan-out: handlers register under wildcard patterns
        // ("transcription:auto", "translation:*:<target>", …) but the host
        // delivers events under the CONCRETE stream key
        // ("transcription:en-US", "translation:en:es"). Re-emit on every
        // pattern the concrete key satisfies — the same pattern set
        // LocalMiniappRuntime.forwardEvent matches on the host side —
        // otherwise a wildcard subscriber never fires.
        if (stream.startsWith("transcription:") && stream !== "transcription:auto") {
            this.emitter.emit("transcription:auto", data, transcriptionRoute);
        }
        else if (stream.startsWith("translation:")) {
            const parts = stream.split(":");
            const patterns = new Set(["translation:auto"]);
            if (parts.length === 3) {
                const [, source, target] = parts;
                patterns.add("translation:*:*");
                patterns.add(`translation:*:${target}`);
                patterns.add(`translation:${source}:*`);
            }
            patterns.delete(stream); // exact key already emitted above
            for (const pattern of patterns) {
                this.emitter.emit(pattern, data);
            }
        }
    }
    sendSubscriptionUpdate() {
        const subscriptions = Array.from(this.refCounts.keys()).map((stream) => {
            if (stream === MiniappStreamType.LOCATION_UPDATE)
                return { stream: "location_stream", rate: "realtime" };
            const forceLocalRefs = this.forceLocalRefCounts.get(stream) ?? 0;
            if (forceLocalRefs === 0)
                return stream;
            const totalRefs = this.refCounts.get(stream) ?? 0;
            return {
                stream,
                forceLocal: true,
                ...(totalRefs > forceLocalRefs ? { includeCloud: true } : {}),
            };
        });
        this.session.sendOneShot({
            type: MiniappRequestType.SUBSCRIBE,
            subscriptions,
        });
    }
}
