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

import {MiniappErrorCode, MiniappRequestType, MiniappStreamType} from "../protocol"
import {MiniappSession} from "../session"
import type {UnsubscribeFn} from "./events"

// ---------------------------------------------------------------------------
// Contract shapes
// ---------------------------------------------------------------------------

export type PerceptionVideoFps = 1 | 2 | 7 | 15 | 24 | 30
export type PerceptionVideoResolution = "360p" | "540p" | "720p"
export type PerceptionAudioChunkMs = 20 | 40 | 100
export type PerceptionSignalValue = string | number | boolean | null

export interface PerceptionVideoOptions {
  /** Frames per second: 1, 2, 7, 15, 24 or 30. The host may lower it and reports what took effect. */
  fps?: PerceptionVideoFps
  max_resolution?: PerceptionVideoResolution
  /** When you are slower than the stream, keep only the newest N frames (1–8). */
  keep_latest?: number
}
export interface PerceptionAudioOptions {sample_rate_hz?: 16000; format?: "pcm_s16le"; chunk_ms?: PerceptionAudioChunkMs}

export type PerceptionStreamRequest =
  | {source: "video"; video?: PerceptionVideoOptions}
  | {source: "audio"; audio?: PerceptionAudioOptions}

export type PerceptionStreamChunk =
  | {schema_version: "v1alpha"; stream_id: string; seq: number; captured_at: number; dropped_before?: number; source: "video"; mime: "image/jpeg"; width: number; height: number; data_base64: string; reality?: Array<{ref: string; program_id: string; retention_ms?: number; expires_at_ms?: number}>}
  | {schema_version: "v1alpha"; stream_id: string; seq: number; captured_at: number; dropped_before?: number; source: "audio"; mime: "audio/pcm"; samples: number; data_base64: string}

export type PerceptionStreamOpened =
  | {schema_version: "v1alpha"; stream_id: string; source: "video"; video: Required<PerceptionVideoOptions>; adjustments: string[]}
  | {schema_version: "v1alpha"; stream_id: string; source: "audio"; audio: Required<PerceptionAudioOptions>; adjustments: string[]}

export type PerceptionOperator = "eq" | "in" | "contains" | "lt" | "lte" | "gt" | "gte" | "between" | "is" | "changes"
export interface PerceptionLeaf {
  signal: string
  op: PerceptionOperator
  value?: string | number | boolean | Array<string | number>
  params?: Record<string, unknown>
  /** The condition must hold continuously for this long (ms). */
  for_ms?: number
}
export type PerceptionExpr = {all: PerceptionExpr[]} | {any: PerceptionExpr[]} | {not: PerceptionExpr} | PerceptionLeaf
export interface PerceptionSignalCondition {kind: "signal"; expr: PerceptionExpr; fire?: "enter" | "leave"}
export interface PerceptionSemanticCondition {kind: "semantic"; text: string}
export type PerceptionCondition = PerceptionSignalCondition | PerceptionSemanticCondition
export interface PerceptionSubscription {schema_version?: "v1alpha"; id: string; when: PerceptionCondition}

export interface PerceptionSubscriptionStatus {
  subscription_id: string
  origin: "manifest" | "runtime"
  written_by: "developer" | "prompt" | "agent"
  kind: "signal" | "semantic"
  state: "active" | "paused" | "suspended"
  paused_until?: number
  suspended_reason?: "permission_revoked" | "device_disconnected" | "experience_disabled" | "low_power"
  created_at: number
}

export interface PerceptionEvent {
  schema_version: "v1alpha"
  event_id: string
  subscription_id: string
  kind: "signal" | "semantic"
  occurred_at: number
  delivered_at: number
  signals?: Record<string, PerceptionSignalValue>
  confidence?: number
  description?: string
  evidence?: {token: string; expires_at: number}
}

export interface PerceptionStateChange {
  schema_version: "v1alpha"
  subscription_id: string
  from: "active" | "paused" | "suspended"
  to: "active" | "paused" | "suspended" | "removed"
  reason?: string
  at: number
}

export interface PerceptionSignalReading {
  schema_version: "v1alpha"
  signal: string
  available: boolean
  value?: PerceptionSignalValue
  unavailable_reason?: "permission_denied" | "device_disconnected" | "not_supported" | "no_data_yet"
  as_of: number
}

/** Errors from the host carry the contract code (`aios.error.*`) and, when relevant, `path` and `missing_permissions`. */
export interface PerceptionRequestError {code: string; message: string; path?: string; missing_permissions?: string[]}

// ---------------------------------------------------------------------------
// Condition builders: sub(signal(...)) / sub(semantic("..."))
// ---------------------------------------------------------------------------

/** A single signal condition, e.g. `signal("place.category", "eq", "shopping.supermarket")`. */
export function signal(id: string, op: PerceptionOperator, value?: PerceptionLeaf["value"], options: {params?: Record<string, unknown>; for_ms?: number} = {}): PerceptionLeaf {
  return {signal: id, op, ...(value === undefined ? {} : {value}), ...(options.params ? {params: options.params} : {}), ...(options.for_ms !== undefined ? {for_ms: options.for_ms} : {})}
}
export const all = (...conditions: PerceptionExpr[]): PerceptionExpr => ({all: conditions})
export const any = (...conditions: PerceptionExpr[]): PerceptionExpr => ({any: conditions})
export const not = (condition: PerceptionExpr): PerceptionExpr => ({not: condition})
/** A one-sentence semantic condition judged by the system perception agent. */
export const semantic = (text: string): PerceptionSemanticCondition => ({kind: "semantic", text})
/** Wrap an expression as a signal condition; `fire: "leave"` triggers when it stops being true. */
export const when = (expr: PerceptionExpr, fire: "enter" | "leave" = "enter"): PerceptionSignalCondition => ({kind: "signal", expr, ...(fire === "leave" ? {fire} : {})})

// ---------------------------------------------------------------------------
// Handles
// ---------------------------------------------------------------------------

export interface PerceptionStreamHandle {
  readonly id: string
  /** What the host actually granted (fps, resolution, chunk size) and why it differs from the request. */
  readonly opened: PerceptionStreamOpened
  stop(): Promise<void>
}

export interface PerceptionSubscriptionHandle {
  readonly id: string
  readonly status: PerceptionSubscriptionStatus
  pause(forMs?: number): Promise<PerceptionSubscriptionStatus>
  resume(): Promise<PerceptionSubscriptionStatus>
  unsubscribe(): Promise<void>
  /** Stop listening locally without cancelling the subscription on the host. */
  detach(): void
}

const isExpr = (value: unknown): value is PerceptionExpr =>
  !!value && typeof value === "object" && ("all" in value || "any" in value || "not" in value || "signal" in value)

export class PerceptionModule {
  private readonly streams = new Map<string, {unsubscribe: UnsubscribeFn}>()
  private readonly handlers = new Map<string, Set<(event: PerceptionEvent) => void>>()
  private eventFeed?: UnsubscribeFn
  private stateFeed?: UnsubscribeFn
  private readonly stateListeners = new Set<(change: PerceptionStateChange) => void>()

  constructor(private readonly session: MiniappSession) {}

  /** True iff CAMERA is declared in the manifest (needed for video streams). */
  get hasCameraPermission(): boolean {return this.session._hasManifestPermission("CAMERA")}
  /** True iff MICROPHONE is declared in the manifest (needed for audio streams). */
  get hasMicrophonePermission(): boolean {return this.session._hasManifestPermission("MICROPHONE")}

  /** Whether this host implements perception. Older hosts answer NOT_IMPLEMENTED. */
  async reportProgram(reference: {stream_id: string; ref: string}, state: "match" | "clear" | "unknown", evidence_refs?: string[]): Promise<unknown> {
    return this.session.sendRequest({type: MiniappRequestType.AIOS_PERCEPTION_PROGRAM_REPORT, stream_id: reference.stream_id, report: {ref:reference.ref,state,...(evidence_refs?{evidence_refs}:{})}})
  }
  async isSupported(): Promise<boolean> {
    try {await this.list(); return true} catch (error) {
      if ((error as PerceptionRequestError)?.code === MiniappErrorCode.NOT_IMPLEMENTED) return false
      throw error
    }
  }

  /**
   * Open a continuous stream. Video: JPEG frames at the granted fps. Audio:
   * 16 kHz mono PCM chunks. `chunk.dropped_before` tells you how many chunks
   * were skipped because you were slower than the stream.
   */
  async stream(request: PerceptionStreamRequest, handler: (chunk: PerceptionStreamChunk) => void): Promise<PerceptionStreamHandle> {
    const opened = await this.session.sendRequest<PerceptionStreamOpened>({
      type: MiniappRequestType.AIOS_PERCEPTION_STREAM_START,
      request: {schema_version: "v1alpha", ...request},
    })
    const streamType = `${MiniappStreamType.PERCEPTION_CHUNK}:${opened.stream_id}`
    const unsubscribe = this.session._subscribe(streamType, data => handler(data as PerceptionStreamChunk))
    this.streams.set(opened.stream_id, {unsubscribe})
    return {
      id: opened.stream_id,
      opened,
      stop: async () => {
        const entry = this.streams.get(opened.stream_id)
        if (!entry) return
        this.streams.delete(opened.stream_id)
        entry.unsubscribe()
        await this.session.sendRequest<void>({type: MiniappRequestType.AIOS_PERCEPTION_STREAM_STOP, stream_id: opened.stream_id})
      },
    }
  }

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
  sub(subscription: PerceptionSubscription, handler?: (event: PerceptionEvent) => void): Promise<PerceptionSubscriptionHandle>
  sub(id: string, condition: PerceptionCondition | PerceptionExpr, handler?: (event: PerceptionEvent) => void): Promise<PerceptionSubscriptionHandle>
  async sub(
    first: PerceptionSubscription | string,
    second?: PerceptionCondition | PerceptionExpr | ((event: PerceptionEvent) => void),
    third?: (event: PerceptionEvent) => void,
  ): Promise<PerceptionSubscriptionHandle> {
    let subscription: PerceptionSubscription
    let handler: ((event: PerceptionEvent) => void) | undefined
    if (typeof first === "string") {
      const condition = second as PerceptionCondition | PerceptionExpr
      subscription = {id: first, when: isExpr(condition) ? when(condition) : condition}
      handler = third
    } else {
      subscription = first
      handler = typeof second === "function" ? second : undefined
    }
    const status = await this.session.sendRequest<PerceptionSubscriptionStatus>({
      type: MiniappRequestType.AIOS_PERCEPTION_SUBSCRIBE,
      subscription: {schema_version: "v1alpha", ...subscription},
    })
    const id = status.subscription_id
    if (handler) this.attach(id, handler)
    return {
      id,
      status,
      pause: forMs => this.pause(id, forMs),
      resume: () => this.resume(id),
      unsubscribe: async () => {this.handlers.delete(id); this.refreshFeeds(); await this.unsubscribe(id)},
      detach: () => {if (handler) this.detach(id, handler)},
    }
  }

  /** Pause a subscription; with `forMs` it resumes by itself. Events during a pause are dropped, not queued. */
  pause(subscriptionId: string, forMs?: number): Promise<PerceptionSubscriptionStatus> {
    return this.session.sendRequest<PerceptionSubscriptionStatus>({
      type: MiniappRequestType.AIOS_PERCEPTION_PAUSE,
      request: {schema_version: "v1alpha", subscription_id: subscriptionId, ...(forMs !== undefined ? {for_ms: forMs} : {})},
    })
  }
  resume(subscriptionId: string): Promise<PerceptionSubscriptionStatus> {
    return this.session.sendRequest<PerceptionSubscriptionStatus>({
      type: MiniappRequestType.AIOS_PERCEPTION_RESUME,
      request: {schema_version: "v1alpha", subscription_id: subscriptionId},
    })
  }
  unsubscribe(subscriptionId: string): Promise<void> {
    return this.session.sendRequest<void>({
      type: MiniappRequestType.AIOS_PERCEPTION_UNSUBSCRIBE,
      request: {schema_version: "v1alpha", subscription_id: subscriptionId},
    })
  }
  list(): Promise<PerceptionSubscriptionStatus[]> {
    return this.session.sendRequest<PerceptionSubscriptionStatus[]>({type: MiniappRequestType.AIOS_PERCEPTION_LIST})
  }

  /** The current value of a signal, or why it is unavailable. */
  read(signalId: string): Promise<PerceptionSignalReading> {
    return this.session.sendRequest<PerceptionSignalReading>({type: MiniappRequestType.AIOS_PERCEPTION_READ_SIGNAL, signal: signalId})
  }

  /** Every event of every subscription of this miniapp (handlers passed to `sub` are a filtered view of this). */
  onEvent(handler: (event: PerceptionEvent) => void): UnsubscribeFn {
    this.attach("*", handler)
    return () => this.detach("*", handler)
  }
  /** Subscription state changes: paused, resumed, suspended by the system, removed. */
  onStateChange(handler: (change: PerceptionStateChange) => void): UnsubscribeFn {
    this.stateListeners.add(handler)
    this.refreshFeeds()
    return () => {this.stateListeners.delete(handler); this.refreshFeeds()}
  }

  /** Stop every stream and drop every local handler. Subscriptions on the host end when the miniapp stops. */
  stop(): void {
    for (const [id, entry] of this.streams) {
      entry.unsubscribe()
      this.session.sendOneShot({type: MiniappRequestType.AIOS_PERCEPTION_STREAM_STOP, stream_id: id})
    }
    this.streams.clear()
    this.handlers.clear()
    this.stateListeners.clear()
    this.refreshFeeds()
  }

  private attach(id: string, handler: (event: PerceptionEvent) => void) {
    const set = this.handlers.get(id) ?? new Set()
    set.add(handler)
    this.handlers.set(id, set)
    this.refreshFeeds()
  }
  private detach(id: string, handler: (event: PerceptionEvent) => void) {
    const set = this.handlers.get(id)
    if (!set) return
    set.delete(handler)
    if (!set.size) this.handlers.delete(id)
    this.refreshFeeds()
  }
  /** One wire subscription per feed while anyone listens. */
  private refreshFeeds() {
    if (this.handlers.size && !this.eventFeed) {
      this.eventFeed = this.session._subscribe(MiniappStreamType.PERCEPTION_EVENT, data => {
        const event = data as PerceptionEvent
        for (const id of [event.subscription_id, "*"]) for (const handler of this.handlers.get(id) ?? []) {
          try {handler(event)} catch (error) {console.warn("[PerceptionModule] event handler threw:", error)}
        }
      })
    } else if (!this.handlers.size && this.eventFeed) {this.eventFeed(); this.eventFeed = undefined}
    if (this.stateListeners.size && !this.stateFeed) {
      this.stateFeed = this.session._subscribe(MiniappStreamType.PERCEPTION_STATE, data => {
        for (const listener of this.stateListeners) {
          try {listener(data as PerceptionStateChange)} catch (error) {console.warn("[PerceptionModule] state handler threw:", error)}
        }
      })
    } else if (!this.stateListeners.size && this.stateFeed) {this.stateFeed(); this.stateFeed = undefined}
  }
}
