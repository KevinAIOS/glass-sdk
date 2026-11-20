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
import { MiniappSession } from "../session";
import type { UnsubscribeFn } from "./events";
export type PerceptionVideoFps = 1 | 2 | 7 | 15 | 24 | 30;
export type PerceptionVideoResolution = "360p" | "540p" | "720p";
export type PerceptionAudioChunkMs = 20 | 40 | 100;
export type PerceptionSignalValue = string | number | boolean | null;
export interface PerceptionVideoOptions {
    /** Frames per second: 1, 2, 7, 15, 24 or 30. The host may lower it and reports what took effect. */
    fps?: PerceptionVideoFps;
    max_resolution?: PerceptionVideoResolution;
    /** When you are slower than the stream, keep only the newest N frames (1–8). */
    keep_latest?: number;
}
export interface PerceptionAudioOptions {
    sample_rate_hz?: 16000;
    format?: "pcm_s16le";
    chunk_ms?: PerceptionAudioChunkMs;
}
export type PerceptionStreamRequest = {
    source: "video";
    video?: PerceptionVideoOptions;
} | {
    source: "audio";
    audio?: PerceptionAudioOptions;
};
export type PerceptionStreamChunk = {
    schema_version: "v1alpha";
    stream_id: string;
    seq: number;
    captured_at: number;
    dropped_before?: number;
    source: "video";
    mime: "image/jpeg";
    width: number;
    height: number;
    data_base64: string;
    reality?: Array<{
        ref: string;
        program_id: string;
        retention_ms?: number;
        expires_at_ms?: number;
    }>;
} | {
    schema_version: "v1alpha";
    stream_id: string;
    seq: number;
    captured_at: number;
    dropped_before?: number;
    source: "audio";
    mime: "audio/pcm";
    samples: number;
    data_base64: string;
};
export type PerceptionStreamOpened = {
    schema_version: "v1alpha";
    stream_id: string;
    source: "video";
    video: Required<PerceptionVideoOptions>;
    adjustments: string[];
} | {
    schema_version: "v1alpha";
    stream_id: string;
    source: "audio";
    audio: Required<PerceptionAudioOptions>;
    adjustments: string[];
};
export type PerceptionOperator = "eq" | "in" | "contains" | "lt" | "lte" | "gt" | "gte" | "between" | "is" | "changes";
export interface PerceptionLeaf {
    signal: string;
    op: PerceptionOperator;
    value?: string | number | boolean | Array<string | number>;
    params?: Record<string, unknown>;
    /** The condition must hold continuously for this long (ms). */
    for_ms?: number;
}
export type PerceptionExpr = {
    all: PerceptionExpr[];
} | {
    any: PerceptionExpr[];
} | {
    not: PerceptionExpr;
} | PerceptionLeaf;
export interface PerceptionSignalCondition {
    kind: "signal";
    expr: PerceptionExpr;
    fire?: "enter" | "leave";
}
export interface PerceptionSemanticCondition {
    kind: "semantic";
    text: string;
}
export type PerceptionCondition = PerceptionSignalCondition | PerceptionSemanticCondition;
export interface PerceptionSubscription {
    schema_version?: "v1alpha";
    id: string;
    when: PerceptionCondition;
}
export interface PerceptionSubscriptionStatus {
    subscription_id: string;
    origin: "manifest" | "runtime";
    written_by: "developer" | "prompt" | "agent";
    kind: "signal" | "semantic";
    state: "active" | "paused" | "suspended";
    paused_until?: number;
    suspended_reason?: "permission_revoked" | "device_disconnected" | "experience_disabled" | "low_power";
    created_at: number;
}
export interface PerceptionEvent {
    schema_version: "v1alpha";
    event_id: string;
    subscription_id: string;
    kind: "signal" | "semantic";
    occurred_at: number;
    delivered_at: number;
    signals?: Record<string, PerceptionSignalValue>;
    confidence?: number;
    description?: string;
    evidence?: {
        token: string;
        expires_at: number;
    };
}
export interface PerceptionStateChange {
    schema_version: "v1alpha";
    subscription_id: string;
    from: "active" | "paused" | "suspended";
    to: "active" | "paused" | "suspended" | "removed";
    reason?: string;
    at: number;
}
export interface PerceptionSignalReading {
    schema_version: "v1alpha";
    signal: string;
    available: boolean;
    value?: PerceptionSignalValue;
    unavailable_reason?: "permission_denied" | "device_disconnected" | "not_supported" | "no_data_yet";
    as_of: number;
}
/** Errors from the host carry the contract code (`aios.error.*`) and, when relevant, `path` and `missing_permissions`. */
export interface PerceptionRequestError {
    code: string;
    message: string;
    path?: string;
    missing_permissions?: string[];
}
/** A single signal condition, e.g. `signal("place.category", "eq", "shopping.supermarket")`. */
export declare function signal(id: string, op: PerceptionOperator, value?: PerceptionLeaf["value"], options?: {
    params?: Record<string, unknown>;
    for_ms?: number;
}): PerceptionLeaf;
export declare const all: (...conditions: PerceptionExpr[]) => PerceptionExpr;
export declare const any: (...conditions: PerceptionExpr[]) => PerceptionExpr;
export declare const not: (condition: PerceptionExpr) => PerceptionExpr;
/** A one-sentence semantic condition judged by the system perception agent. */
export declare const semantic: (text: string) => PerceptionSemanticCondition;
/** Wrap an expression as a signal condition; `fire: "leave"` triggers when it stops being true. */
export declare const when: (expr: PerceptionExpr, fire?: "enter" | "leave") => PerceptionSignalCondition;
export interface PerceptionStreamHandle {
    readonly id: string;
    /** What the host actually granted (fps, resolution, chunk size) and why it differs from the request. */
    readonly opened: PerceptionStreamOpened;
    stop(): Promise<void>;
}
export interface PerceptionSubscriptionHandle {
    readonly id: string;
    readonly status: PerceptionSubscriptionStatus;
    pause(forMs?: number): Promise<PerceptionSubscriptionStatus>;
    resume(): Promise<PerceptionSubscriptionStatus>;
    unsubscribe(): Promise<void>;
    /** Stop listening locally without cancelling the subscription on the host. */
    detach(): void;
}
export declare class PerceptionModule {
    private readonly session;
    private readonly streams;
    private readonly handlers;
    private eventFeed?;
    private stateFeed?;
    private readonly stateListeners;
    constructor(session: MiniappSession);
    /** True iff CAMERA is declared in the manifest (needed for video streams). */
    get hasCameraPermission(): boolean;
    /** True iff MICROPHONE is declared in the manifest (needed for audio streams). */
    get hasMicrophonePermission(): boolean;
    /** Whether this host implements perception. Older hosts answer NOT_IMPLEMENTED. */
    reportProgram(reference: {
        stream_id: string;
        ref: string;
    }, state: "match" | "clear" | "unknown", evidence_refs?: string[]): Promise<unknown>;
    isSupported(): Promise<boolean>;
    /**
     * Open a continuous stream. Video: JPEG frames at the granted fps. Audio:
     * 16 kHz mono PCM chunks. `chunk.dropped_before` tells you how many chunks
     * were skipped because you were slower than the stream.
     */
    stream(request: PerceptionStreamRequest, handler: (chunk: PerceptionStreamChunk) => void): Promise<PerceptionStreamHandle>;
    /**
     * Subscribe to a condition. Signal conditions are judged exactly by code;
     * semantic sentences by the system perception agent (events carry a
     * confidence). One event per occurrence: it fires again only after the
     * condition stopped being true.
     *
     *   sub("enter-supermarket", when(signal("place.category", "eq", "shopping.supermarket")), e => ...)
     *   sub("picked-up-shampoo", semantic("用户在超市里拿起了一瓶海飞丝洗发水"), e => ...)
     *   sub({id, when}, handler)
     */
    sub(subscription: PerceptionSubscription, handler?: (event: PerceptionEvent) => void): Promise<PerceptionSubscriptionHandle>;
    sub(id: string, condition: PerceptionCondition | PerceptionExpr, handler?: (event: PerceptionEvent) => void): Promise<PerceptionSubscriptionHandle>;
    /** Pause a subscription; with `forMs` it resumes by itself. Events during a pause are dropped, not queued. */
    pause(subscriptionId: string, forMs?: number): Promise<PerceptionSubscriptionStatus>;
    resume(subscriptionId: string): Promise<PerceptionSubscriptionStatus>;
    unsubscribe(subscriptionId: string): Promise<void>;
    list(): Promise<PerceptionSubscriptionStatus[]>;
    /** The current value of a signal, or why it is unavailable. */
    read(signalId: string): Promise<PerceptionSignalReading>;
    /** Every event of every subscription of this miniapp (handlers passed to `sub` are a filtered view of this). */
    onEvent(handler: (event: PerceptionEvent) => void): UnsubscribeFn;
    /** Subscription state changes: paused, resumed, suspended by the system, removed. */
    onStateChange(handler: (change: PerceptionStateChange) => void): UnsubscribeFn;
    /** Stop every stream and drop every local handler. Subscriptions on the host end when the miniapp stops. */
    stop(): void;
    private attach;
    private detach;
    /** One wire subscription per feed while anyone listens. */
    private refreshFeeds;
}
