/**
 * @fileoverview PerceptionModule — the three perception entry points of AIOS.
 *
 *   session.perception.stream(...)   layer 1: continuous frames or audio
 *   session.perception.sub(...)      layer 2 / 3: signal or semantic subscriptions
 *   session.perception.read(...)     layer 2: a signal's current value
 *
 * Shapes follow contracts/perception/v1alpha and subscription-control/v1alpha
 * one to one (snake_case on the wire). This module is additive: the existing
 * camera / mic / location modules are untouched, and a host without perception
 * support answers NOT_IMPLEMENTED, which `isSupported()` turns into `false`.
 *
 * Permissions: video needs CAMERA, audio needs MICROPHONE, and every signal
 * carries its own permission in the catalog; the host refuses with
 * `aios.error.permission_denied` and lists `missing_permissions`.
 */
import { MiniappErrorCode, MiniappRequestType, MiniappStreamType } from "../protocol";
// ---------------------------------------------------------------------------
// Condition builders: sub(signal(...)) / sub(semantic("..."))
// ---------------------------------------------------------------------------
/** A single signal condition, e.g. `signal("place.category", "eq", "shopping.supermarket")`. */
export function signal(id, op, value, options = {}) {
    return { signal: id, op, ...(value === undefined ? {} : { value }), ...(options.params ? { params: options.params } : {}), ...(options.for_ms !== undefined ? { for_ms: options.for_ms } : {}) };
}
export const all = (...conditions) => ({ all: conditions });
export const any = (...conditions) => ({ any: conditions });
export const not = (condition) => ({ not: condition });
/** A one-sentence semantic condition judged by the system perception agent. */
export const semantic = (text) => ({ kind: "semantic", text });
/** Wrap an expression as a signal condition; `fire: "leave"` triggers when it stops being true. */
export const when = (expr, fire = "enter") => ({ kind: "signal", expr, ...(fire === "leave" ? { fire } : {}) });
const isExpr = (value) => !!value && typeof value === "object" && ("all" in value || "any" in value || "not" in value || "signal" in value);
export class PerceptionModule {
    constructor(session) {
        this.session = session;
        this.streams = new Map();
        this.handlers = new Map();
        this.stateListeners = new Set();
    }
    /** True iff CAMERA is declared in the manifest (needed for video streams). */
    get hasCameraPermission() { return this.session._hasManifestPermission("CAMERA"); }
    /** True iff MICROPHONE is declared in the manifest (needed for audio streams). */
    get hasMicrophonePermission() { return this.session._hasManifestPermission("MICROPHONE"); }
    /** Whether this host implements perception. Older hosts answer NOT_IMPLEMENTED. */
    async reportProgram(reference, state, evidence_refs) {
        return this.session.sendRequest({ type: MiniappRequestType.AIOS_PERCEPTION_PROGRAM_REPORT, stream_id: reference.stream_id, report: { ref: reference.ref, state, ...(evidence_refs ? { evidence_refs } : {}) } });
    }
    async isSupported() {
        try {
            await this.list();
            return true;
        }
        catch (error) {
            if (error?.code === MiniappErrorCode.NOT_IMPLEMENTED)
                return false;
            throw error;
        }
    }
    /**
     * Open a continuous stream. Video: JPEG frames at the granted fps. Audio:
     * 16 kHz mono PCM chunks. `chunk.dropped_before` tells you how many chunks
     * were skipped because you were slower than the stream.
     */
    async stream(request, handler) {
        const opened = await this.session.sendRequest({
            type: MiniappRequestType.AIOS_PERCEPTION_STREAM_START,
            request: { schema_version: "v1alpha", ...request },
        });
        const streamType = `${MiniappStreamType.PERCEPTION_CHUNK}:${opened.stream_id}`;
        const unsubscribe = this.session._subscribe(streamType, data => handler(data));
        this.streams.set(opened.stream_id, { unsubscribe });
        return {
            id: opened.stream_id,
            opened,
            stop: async () => {
                const entry = this.streams.get(opened.stream_id);
                if (!entry)
                    return;
                this.streams.delete(opened.stream_id);
                entry.unsubscribe();
                await this.session.sendRequest({ type: MiniappRequestType.AIOS_PERCEPTION_STREAM_STOP, stream_id: opened.stream_id });
            },
        };
    }
    async sub(first, second, third) {
        let subscription;
        let handler;
        if (typeof first === "string") {
            const condition = second;
            subscription = { id: first, when: isExpr(condition) ? when(condition) : condition };
            handler = third;
        }
        else {
            subscription = first;
            handler = typeof second === "function" ? second : undefined;
        }
        const status = await this.session.sendRequest({
            type: MiniappRequestType.AIOS_PERCEPTION_SUBSCRIBE,
            subscription: { schema_version: "v1alpha", ...subscription },
        });
        const id = status.subscription_id;
        if (handler)
            this.attach(id, handler);
        return {
            id,
            status,
            pause: forMs => this.pause(id, forMs),
            resume: () => this.resume(id),
            unsubscribe: async () => { this.handlers.delete(id); this.refreshFeeds(); await this.unsubscribe(id); },
            detach: () => { if (handler)
                this.detach(id, handler); },
        };
    }
    /** Pause a subscription; with `forMs` it resumes by itself. Events during a pause are dropped, not queued. */
    pause(subscriptionId, forMs) {
        return this.session.sendRequest({
            type: MiniappRequestType.AIOS_PERCEPTION_PAUSE,
            request: { schema_version: "v1alpha", subscription_id: subscriptionId, ...(forMs !== undefined ? { for_ms: forMs } : {}) },
        });
    }
    resume(subscriptionId) {
        return this.session.sendRequest({
            type: MiniappRequestType.AIOS_PERCEPTION_RESUME,
            request: { schema_version: "v1alpha", subscription_id: subscriptionId },
        });
    }
    unsubscribe(subscriptionId) {
        return this.session.sendRequest({
            type: MiniappRequestType.AIOS_PERCEPTION_UNSUBSCRIBE,
            request: { schema_version: "v1alpha", subscription_id: subscriptionId },
        });
    }
    list() {
        return this.session.sendRequest({ type: MiniappRequestType.AIOS_PERCEPTION_LIST });
    }
    /** The current value of a signal, or why it is unavailable. */
    read(signalId) {
        return this.session.sendRequest({ type: MiniappRequestType.AIOS_PERCEPTION_READ_SIGNAL, signal: signalId });
    }
    /** Every event of every subscription of this miniapp (handlers passed to `sub` are a filtered view of this). */
    onEvent(handler) {
        this.attach("*", handler);
        return () => this.detach("*", handler);
    }
    /** Subscription state changes: paused, resumed, suspended by the system, removed. */
    onStateChange(handler) {
        this.stateListeners.add(handler);
        this.refreshFeeds();
        return () => { this.stateListeners.delete(handler); this.refreshFeeds(); };
    }
    /** Stop every stream and drop every local handler. Subscriptions on the host end when the miniapp stops. */
    stop() {
        for (const [id, entry] of this.streams) {
            entry.unsubscribe();
            this.session.sendOneShot({ type: MiniappRequestType.AIOS_PERCEPTION_STREAM_STOP, stream_id: id });
        }
        this.streams.clear();
        this.handlers.clear();
        this.stateListeners.clear();
        this.refreshFeeds();
    }
    attach(id, handler) {
        const set = this.handlers.get(id) ?? new Set();
        set.add(handler);
        this.handlers.set(id, set);
        this.refreshFeeds();
    }
    detach(id, handler) {
        const set = this.handlers.get(id);
        if (!set)
            return;
        set.delete(handler);
        if (!set.size)
            this.handlers.delete(id);
        this.refreshFeeds();
    }
    /** One wire subscription per feed while anyone listens. */
    refreshFeeds() {
        if (this.handlers.size && !this.eventFeed) {
            this.eventFeed = this.session._subscribe(MiniappStreamType.PERCEPTION_EVENT, data => {
                const event = data;
                for (const id of [event.subscription_id, "*"])
                    for (const handler of this.handlers.get(id) ?? []) {
                        try {
                            handler(event);
                        }
                        catch (error) {
                            console.warn("[PerceptionModule] event handler threw:", error);
                        }
                    }
            });
        }
        else if (!this.handlers.size && this.eventFeed) {
            this.eventFeed();
            this.eventFeed = undefined;
        }
        if (this.stateListeners.size && !this.stateFeed) {
            this.stateFeed = this.session._subscribe(MiniappStreamType.PERCEPTION_STATE, data => {
                for (const listener of this.stateListeners) {
                    try {
                        listener(data);
                    }
                    catch (error) {
                        console.warn("[PerceptionModule] state handler threw:", error);
                    }
                }
            });
        }
        else if (!this.stateListeners.size && this.stateFeed) {
            this.stateFeed();
            this.stateFeed = undefined;
        }
    }
}
