/**
 * @fileoverview Code Experiences (代码型 Experience 契约 v1, SDK 0.5).
 *
 * One set of types for both runtimes: the phone background JSContext (this
 * file's `bindExperience`) and the server Deno shim, which implements the same
 * `Session` without importing the SDK.
 *
 *   import {defineExperience} from "@aios/glass/experience"
 *   import {registerApp} from "@aios/glass/background"
 *   const experience = defineExperience({onTimer: async (ev, s) => {await s.output.speak("到时间了")}})
 *   export default experience
 *   registerApp(experience)
 *
 * The Host owns ordering, timeouts, dedupe and every Hub call; the App only
 * runs handlers and never sees the device token.
 */
import {MiniappRequestType, MiniappStreamType} from "./protocol"

export const CODE_SDK_VERSION = "0.5.0"

export type Json = null | boolean | number | string | Json[] | {[key: string]: Json}
export type CodeRuntime = "phone" | "server"
export type CodeEventType = "lifecycle" | "mount" | "signal" | "materials" | "segment" | "utterance" | "button" | "timer" | "schedule" | "peer" | "tool" | "output"

export interface CodeEvent<T = Json> {
  /** "cev_" + 22 base62 (Hub) or "cevp_…" (phone-local). Unique per (user, slug). */
  event_id: string
  type: CodeEventType
  /** Hub events: increasing per (user, slug, runtime). Phone-local events: 0. */
  seq: number
  at_ms: number
  runtime: CodeRuntime
  installation: string
  data: T
}

export type LifecycleData = {phase: "install" | "upgrade" | "uninstall"; from_version?: string; to_version: string}
export type MountData = {reason: "enabled" | "lease" | "upgrade" | "disabled" | "lease_lost" | "suspended"; mount_id: string}
export type SignalData = {subscription_id: string; run_id: string | null; wake: boolean; event: Json}
export type MaterialsData = {call_id: string; material_revision: number; subscription_id: string; run_id: string | null; context: Json}
export type SegmentData = {subscription_id: string | null; run_id: string | null; wake: boolean; segment: Json; event?: Json}
export type UtteranceData = {text: string; rule: number; reply_window_ms: number; started_at_ms: number | null; ended_at_ms: number | null}
export type ButtonData = {source: "temple" | "ui" | "action"; button_id: string; action: "press" | "long_press" | "double_press"; press_id: string; at_ms: number}
export type TimerData = {timer_id: string; payload: Json; due_at_ms: number; fired_at_ms: number; late_ms: number; fired_by: CodeRuntime}
export type ScheduleData = {schedule_id: string; planned_at_ms: number; local_date: string; tz: string; catch_up: boolean}
export type PeerData = {from: CodeRuntime; topic: string; body: Json; sent_at_ms: number}
export type ToolEventData = {call_id: string; tool: string; args: Json; activity_id: string | null; session_id: string | null; deadline_ms: number}

export interface ToolCall {call_id: string; tool: string; activity_id: string | null; session_id: string | null; deadline_ms: number}
export type UtteranceReply = {reply?: string; await_answer_ms?: number}

/** Every `session.*` failure. */
export class AiosCodeError extends Error {
  readonly code: string
  readonly retryable: boolean
  readonly details?: Json
  constructor(code: string, message: string, retryable = false, details?: Json) {
    super(message)
    this.name = "AiosCodeError"
    this.code = code
    this.retryable = retryable
    if (details !== undefined) this.details = details
  }
}

export type Capability =
  | "store" | "local" | "timers" | "schedules" | "output.speak" | "output.notify" | "outputs" | "materials" | "memory" | "images"
  | "camera.capture" | "perception.frames" | "perception.audio" | "perception.subscriptions" | "net.fetch" | "agent.ask" | "agent.start" | "peer" | "log"
export const CAPABILITIES: readonly Capability[] = [
  "store", "local", "timers", "schedules", "output.speak", "output.notify", "outputs", "materials", "memory", "images",
  "camera.capture", "perception.frames", "perception.audio", "perception.subscriptions", "net.fetch", "agent.ask", "agent.start", "peer", "log",
]

export type TimerView = {
  timer_id: string
  owner_runtime: CodeRuntime
  state: "scheduled" | "paused" | "fired" | "cancelled"
  due_at_ms: number | null
  remaining_ms: number | null
  payload: Json
  fallback: string
  created_at_ms: number
}
export type TimerSpec = {id: string; at_ms?: number; in_ms?: number; payload?: Json; fallback?: "server" | "notify" | "none"; fallback_text?: string}
export type ScheduleView = {id: string; at: string; days: string[]; tz: string; enabled: boolean; next_at_ms: number | null}
export type Urgency = "low" | "normal" | "high"
export type OutputDecision = {
  output_ref: string
  outcome: "played" | "display_only" | "suppressed"
  reason?: string
  fallback?: "voice" | "phone_notification"
  delivery: "phone_local" | "phone_push" | "held"
}
export type OutputStatus = {
  output_ref: string
  receipt: "played" | "interrupted" | "discarded" | "posted" | null
  receipt_at: number | null
  delivery?: OutputDecision["delivery"]
  outcome?: OutputDecision["outcome"]
  fallback?: OutputDecision["fallback"]
}
export type CaptureView = {
  intent_id: string
  state: "pending" | "captured" | "failed" | "cancelled"
  photo_ref?: string
  width?: number
  height?: number
  captured_at_ms?: number
  error?: string
}
/** Expiry shares Frame.captured_at_ms clock. Upper retention bound only; permission,
 * generation and capacity may revoke earlier. Older Hosts omit these fields. */
export type RealityFrameReference = {stream_id: string; ref: string; program_id: string; retention_ms?: number; expires_at_ms?: number}
export type Frame = {reality?: RealityFrameReference[];frame_id: string; jpeg_base64: string; captured_at_ms: number; width: number; height: number}
export type AudioChunk = {chunk_id: string; pcm_base64: string; sample_rate_hz: 16000; format: "pcm_s16le"; captured_at_ms: number}
export type Evidence = {image_ref?: string; photo_ref?: string; captured_at_ms?: number}
export type FetchInit = {method?: string; headers?: Record<string, string>; body?: string; body_base64?: string; timeout_ms?: number}
export type FetchResult = {status: number; headers: Record<string, string>; body?: string; body_base64?: string; truncated: boolean}
export type AskOptions = {attach?: string[]; schema?: Json; context?: string; tools?: "experience" | "none"; timeout_ms?: number; request_id?: string}
export type AskResult = {text: string; data?: Json; run_id: string; usage: {input_tokens: number; output_tokens: number}}
export type LogLevel = "debug" | "info" | "warn" | "error"

/** Retain request_id across uncertain receipts; only the calling handler waits. */
export type MemoryOptions = {request_id: string}
export type RememberOptions = MemoryOptions & {kind?: "profile" | "timeline" | "entity"; dimension?: string; entity?: string; aliases?: string[]}

export interface Session {
  readonly slug: string
  readonly version: string
  readonly runtime: CodeRuntime
  readonly user_ref: string
  /** Epoch ms corrected by the Hub clock. */
  now(): number
  store: {
    get(key: string): Promise<{value: Json | null; rev: number}>
    /** Conflicts are returned, never thrown. `value === null` deletes. */
    cas(key: string, expected_rev: number, value: Json | null): Promise<{ok: true; rev: number} | {ok: false; code: "STORE_CONFLICT"; current: {value: Json | null; rev: number}}>
    list(options?: {prefix?: string; after?: string; limit?: number}): Promise<{items: Array<{key: string; rev: number; value: Json}>; next: string | null}>
  }
  /** Phone only: the App's own local key-value storage, no CAS and no sync. */
  local: {
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<void>
    delete(key: string): Promise<void>
    list(): Promise<string[]>
  }
  timers: {
    schedule(spec: TimerSpec): Promise<TimerView>
    cancel(id: string): Promise<{ok: boolean; state: TimerView["state"]}>
    pause(id: string): Promise<TimerView>
    resume(id: string): Promise<TimerView>
    get(id: string): Promise<TimerView | null>
    list(): Promise<TimerView[]>
  }
  schedules: {
    list(): Promise<ScheduleView[]>
    set(id: string, patch: {enabled?: boolean; at?: string; days?: string[]}): Promise<ScheduleView>
  }
  output: {
    /** Read only this Experience's playback receipt; speak admission is not playback. */
    status(output_ref: string): Promise<OutputStatus>
    /** Optional audio_url is developer-owned prerecorded audio; the normal output gate still controls playback. */
    speak(text: string, options?: {urgency?: Urgency; dedupe_key?: string; await_answer_ms?: number; audio_url?: string}): Promise<OutputDecision>
    notify(text: string, options?: {title?: string; urgency?: Urgency; dedupe_key?: string; open?: string}): Promise<OutputDecision>
  }
  outputs: {
    /** `version` is an opaque string from the Hub (the Assets store's content version). */
    read(key: string): Promise<{output_id: string; version: string; output: Json} | null>
    write(key: string, output: Json, options: {expected_version: string | null; evidence?: Evidence[]}): Promise<{output_id: string; version: string; evidence_entry_ids?: string[]}>
    /** Read, change, write; retries on OUTPUT_VERSION_CONFLICT. */
    update(key: string, fn: (current: Json | null) => Json | Promise<Json>, options?: {max_retries?: number}): Promise<{output_id: string; version: string; evidence_entry_ids?: string[]}>
  }
  memory: {
    remember(text: string, options: RememberOptions): Promise<Json>
    search(question: string, options: MemoryOptions & {limit?: number}): Promise<Json>
    forget(text: string, options: MemoryOptions): Promise<Json>
  }
  materials: {
    add(entry: Json): Promise<Json>
    query(q: Json): Promise<Json>
    get(entry_id: string): Promise<Json>
    delete(entry_id: string): Promise<Json>
    keepEvidence(request: Json): Promise<Json>
  }
  images: {
    upload(photo_ref: string): Promise<{image_ref: string; expires_at_ms: number}>
    get(image_ref: string): Promise<{mime: string; width: number; height: number; bytes_base64: string}>
  }
  camera: {
    capture(request: {intent_id: string; max_side?: number; reason?: string}): Promise<CaptureView>
    status(intent_id: string): Promise<CaptureView | null>
    cancel(intent_id: string): Promise<CaptureView>
  }
  perception: {
    reportProgram(reference: RealityFrameReference, state: "match" | "clear" | "unknown", evidence_refs?: string[]): Promise<unknown>
    /** Phone only, while mounted. fps snaps down to 1/2/7/15, max_side <= 1280. Resolves to a stop function. */
    frames(options: {fps?: number; max_side?: number}, cb: (frame: Frame) => void): Promise<() => Promise<void>>
    /** Phone only, while mounted. 16 kHz mono PCM in chunk_ms pieces (20/40/100). Resolves to a stop function. */
    audio(options: {chunk_ms?: 20 | 40 | 100}, cb: (chunk: AudioChunk) => void): Promise<() => Promise<void>>
    subscribe(subscription: Json): Promise<Json>
    pause(id: string, for_ms?: number): Promise<Json>
    resume(id: string): Promise<Json>
    unsubscribe(id: string): Promise<void>
    list(): Promise<Json[]>
  }
  net: {fetch(url: string, init?: FetchInit): Promise<FetchResult>}
  agent: {
    /** The answer goes to the code only; it is never spoken. */
    ask(prompt: string, options?: AskOptions): Promise<AskResult>
    start(request: {reason: string; context?: string; accepts_user_turns?: boolean}): Promise<{activity_id: string; session_id: string; started: boolean}>
    send(text: string): Promise<{ok: boolean}>
    stop(): Promise<{ok: boolean}>
  }
  peer: {send(topic: string, body: Json): Promise<{ok: true}>}
  log: Record<LogLevel, (msg: string, fields?: Json) => void>
}

type Handler<T, R = void> = (event: CodeEvent<T>, session: Session) => Promise<R> | R
export interface ExperienceHandlers {
  onInstall?: Handler<LifecycleData>
  onUpgrade?: Handler<LifecycleData>
  onUninstall?: Handler<LifecycleData>
  onMount?: Handler<MountData>
  onUnmount?: Handler<MountData>
  onSignal?: Handler<SignalData>
  /** Additional materials for an existing invocation; never a new signal or run. */
  onMaterials?: Handler<MaterialsData>
  onSegment?: Handler<SegmentData>
  onUtterance?: Handler<UtteranceData, UtteranceReply | void>
  onButton?: Handler<ButtonData>
  onTimer?: Handler<TimerData>
  onSchedule?: Handler<ScheduleData>
  onPeer?: Handler<PeerData>
  tools?: Record<string, (args: Json, call: ToolCall, session: Session) => Promise<Json> | Json>
}
export type ExperienceDefinition<T extends ExperienceHandlers = ExperienceHandlers> = T & {readonly __aios_experience: 1}

/** Returns the argument unchanged, marked so `registerApp` and the server shim recognise it. */
export function defineExperience<T extends ExperienceHandlers>(definition: T): ExperienceDefinition<T> {
  return Object.assign(definition, {__aios_experience: 1 as const})
}
export function isExperienceDefinition(value: unknown): value is ExperienceDefinition {
  return !!value && typeof value === "object" && (value as {__aios_experience?: unknown}).__aios_experience === 1
}

/** Manifest handler name → exported function. `tool` means a non-empty `tools` map. */
export const MANIFEST_HANDLERS = {
  install: "onInstall", upgrade: "onUpgrade", uninstall: "onUninstall", mount: "onMount", unmount: "onUnmount",
  signal: "onSignal", materials: "onMaterials", segment: "onSegment", utterance: "onUtterance", button: "onButton", timer: "onTimer",
  schedule: "onSchedule", peer: "onPeer", tool: "tools",
} as const satisfies Record<string, keyof ExperienceHandlers>
export type ManifestHandler = keyof typeof MANIFEST_HANDLERS

/** The manifest handler names a definition actually exports (what the Host checks against `code.phone.handlers`). */
export function exportedHandlers(definition: ExperienceHandlers): ManifestHandler[] {
  return (Object.keys(MANIFEST_HANDLERS) as ManifestHandler[]).filter(name => {
    const key = MANIFEST_HANDLERS[name]
    if (key === "tools") return !!definition.tools && Object.keys(definition.tools).length > 0
    return typeof definition[key] === "function"
  })
}

/** Which function receives an event. */
export function handlerFor(event: Pick<CodeEvent, "type" | "data">): keyof ExperienceHandlers | null {
  const data = (event.data ?? {}) as Record<string, unknown>
  switch (event.type) {
    case "lifecycle": return data.phase === "install" ? "onInstall" : data.phase === "upgrade" ? "onUpgrade" : data.phase === "uninstall" ? "onUninstall" : null
    case "mount": return ["disabled", "lease_lost", "suspended"].includes(String(data.reason)) ? "onUnmount" : "onMount"
    case "signal": return "onSignal"
    case "materials": return "onMaterials"
    case "segment": return "onSegment"
    case "utterance": return "onUtterance"
    case "button": return "onButton"
    case "timer": return "onTimer"
    case "schedule": return "onSchedule"
    case "peer": return "onPeer"
    default: return null
  }
}

// ---------------------------------------------------------------------------
// Host ↔ App wire (phone only)
// ---------------------------------------------------------------------------

export type CodeDispatch =
  | {dispatch_id: string; kind: "event"; event: CodeEvent; now_offset_ms?: number}
  | {dispatch_id: string; kind: "tool"; event: CodeEvent<ToolEventData>; now_offset_ms?: number}
export type CodeDone = {dispatch_id: string; ok: true; result?: Json} | {dispatch_id: string; ok: false; error: {code: string; message: string}}
export type CodeSessionInfo = {slug: string; version: string; runtime: "phone"; user_ref: string; capabilities: string[]; now_offset_ms: number}
export type CodeReadyRequest = {sdk: string; handlers: ManifestHandler[]; tools: string[]}

/** The subset of MiniappSession that binding needs (kept structural for tests). */
export interface ExperienceHostPort {
  sendRequest<T = unknown>(payload: object, opts?: {timeoutMs?: number}): Promise<T>
  _subscribe(stream: string, handler: (data: unknown) => void): () => void
  connect(): Promise<void>
  storage: {get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; delete(key: string): Promise<void>; keys(): Promise<string[]>}
  perception?: {
    stream(request: {source: "video"; video?: {fps?: 1 | 2 | 7 | 15 | 24 | 30; max_resolution?: "360p" | "540p" | "720p"}}
      | {source: "audio"; audio?: {chunk_ms?: 20 | 40 | 100}}, handler: (chunk: never) => void): Promise<{id: string; stop(): Promise<void>}>
    sub(subscription: never): Promise<{status: unknown}>
    pause(id: string, forMs?: number): Promise<unknown>
    resume(id: string): Promise<unknown>
    unsubscribe(id: string): Promise<void>
    list(): Promise<unknown[]>
  }
  speaker?: {speak(...args: never[]): Promise<unknown>}
  ui?: {on(channel: never, cb: (payload: unknown) => void): () => void}
}

const toError = (error: unknown): AiosCodeError => {
  if (error instanceof AiosCodeError) return error
  const e = (error ?? {}) as {code?: unknown; message?: unknown; retryable?: unknown; details?: unknown}
  return new AiosCodeError(typeof e.code === "string" ? e.code : "INTERNAL", typeof e.message === "string" ? e.message : String(error),
    e.retryable === true, e.details as Json | undefined)
}
const CALL_TIMEOUT_MS: Record<string, number> = {"memory.remember": 35_000, "memory.search": 35_000, "memory.forget": 35_000, "camera.capture": 25_000, "net.fetch": 15_000, "output.speak": 60_000, "agent.start": 20_000}
const FRAME_FPS = (fps = 1): 1 | 2 | 7 | 15 => (fps >= 15 ? 15 : fps >= 7 ? 7 : fps >= 2 ? 2 : 1)
const AUDIO_CHUNK_MS = new Set([20, 40, 100])
const FRAME_RESOLUTION = (side = 768): "360p" | "540p" | "720p" => (side <= 360 ? "360p" : side <= 540 ? "540p" : "720p")

/**
 * Builds the phone `Session`. Every Hub-backed API is one AIOS_CODE_CALL; the
 * Host checks the capability and the mount, so a modified bundle gains nothing.
 */
export function createPhoneSession(port: ExperienceHostPort, info: () => CodeSessionInfo): Session {
  const call = async <T>(api: string, args: Record<string, unknown> = {}): Promise<T> => {
    const askTimeout = api === "agent.ask" ? Math.min(Number(args.timeout_ms ?? 30_000), 60_000) + 5_000 : undefined
    try {
      return await port.sendRequest<T>({type: MiniappRequestType.AIOS_CODE_CALL, api, args}, {timeoutMs: askTimeout ?? CALL_TIMEOUT_MS[api] ?? 15_000})
    } catch (error) {throw toError(error)}
  }
  const declared = (capability: Capability) => {
    if (!info().capabilities.includes(capability)) throw new AiosCodeError("CAPABILITY_NOT_DECLARED", `${capability} is not declared in code.capabilities`)
  }
  const frames = new Set<() => Promise<void>>()
  const log = (level: LogLevel) => (msg: string, fields?: Json) => {
    void call("log.write", {level, msg: String(msg).slice(0, 2000), ...(fields !== undefined ? {fields} : {}), kind: "api"}).catch(() => undefined)
  }
  const session: Session & {_stopFrames(): Promise<void>} = {
    get slug() {return info().slug},
    get version() {return info().version},
    runtime: "phone",
    get user_ref() {return info().user_ref},
    now: () => Date.now() + (info().now_offset_ms || 0),
    store: {
      get: key => call("store.get", {key}),
      cas: (key, expected_rev, value) => call("store.cas", {key, expected_rev, value}),
      list: (options = {}) => call("store.list", options),
    },
    local: {
      get: async key => {declared("local"); return port.storage.get(key)},
      set: async (key, value) => {declared("local"); await port.storage.set(key, value)},
      delete: async key => {declared("local"); await port.storage.delete(key)},
      list: async () => {declared("local"); return port.storage.keys()},
    },
    timers: {
      schedule: spec => call("timers.schedule", spec),
      cancel: id => call("timers.cancel", {id}),
      pause: id => call("timers.pause", {id}),
      resume: id => call("timers.resume", {id}),
      get: id => call("timers.get", {id}),
      list: () => call("timers.list"),
    },
    schedules: {
      list: () => call("schedules.list"),
      set: (id, patch) => call("schedules.set", {id, ...patch}),
    },
    output: {
      status: output_ref => call("output.status", {output_ref}),
      speak: (text, options = {}) => call("output.speak", {text, ...options}),
      notify: (text, options = {}) => call("output.notify", {text, ...options}),
    },
    outputs: {
      read: key => call("outputs.read", {key}),
      write: (key, output, options) => call("outputs.write", {key, output, ...options}),
      update: async (key, fn, options = {}) => {
        const retries = options.max_retries ?? 3
        for (let attempt = 0; ; attempt++) {
          const current = await session.outputs.read(key)
          const next = await fn(current?.output ?? null)
          try {return await session.outputs.write(key, next, {expected_version: current?.version ?? null})} catch (error) {
            if ((error as AiosCodeError).code !== "OUTPUT_VERSION_CONFLICT" || attempt >= retries) throw error
          }
        }
      },
    },
    memory: {
      remember: (text, options) => call("memory.remember", {text, ...options}),
      search: (question, options) => call("memory.search", {question, ...options}),
      forget: (text, options) => call("memory.forget", {text, ...options}),
    },
    materials: {
      add: entry => call("materials.add", {entry}),
      query: q => call("materials.query", {q}),
      get: entry_id => call("materials.get", {entry_id}),
      delete: entry_id => call("materials.delete", {entry_id}),
      keepEvidence: request => call("materials.keepEvidence", {request}),
    },
    images: {
      upload: photo_ref => call("images.upload", {photo_ref}),
      get: image_ref => call("images.get", {image_ref}),
    },
    camera: {
      capture: request => call("camera.capture", request),
      status: intent_id => call("camera.status", {intent_id}),
      cancel: intent_id => call("camera.cancel", {intent_id}),
    },
    perception: {
      reportProgram: (reference,state,evidence_refs) => {
        declared("perception.frames")
        return port.sendRequest({type:MiniappRequestType.AIOS_PERCEPTION_PROGRAM_REPORT,stream_id:reference.stream_id,report:{ref:reference.ref,state,...(evidence_refs?{evidence_refs}:{})}})
      },
      frames: async (options, cb) => {
        declared("perception.frames")
        if (!port.perception) throw new AiosCodeError("NOT_AVAILABLE_ON_RUNTIME", "This host has no perception stream")
        const fps = options.fps ?? 1, side = options.max_side ?? 768
        if (!(fps > 0) || !(side > 0 && side <= 1280)) throw new AiosCodeError("INVALID_ARGUMENT", "fps must be > 0 and max_side ≤1280", false, {field: !(fps > 0) ? "fps" : "max_side"})
        const handle = await port.perception.stream({source: "video", video: {fps: FRAME_FPS(fps), max_resolution: FRAME_RESOLUTION(side)}}, ((chunk: {reality?: Array<{ref: string; program_id: string; retention_ms?: number; expires_at_ms?: number}>; stream_id: string; seq: number; captured_at: number; width: number; height: number; data_base64: string}) => {
          cb({frame_id: `${chunk.stream_id}:${chunk.seq}`, jpeg_base64: chunk.data_base64, captured_at_ms: chunk.captured_at, width: chunk.width, height: chunk.height, ...(chunk.reality?{reality:chunk.reality.map(r=>({...r,stream_id:chunk.stream_id}))}:{})})
        }) as never)
        const stop = async () => {if (frames.delete(stop)) await handle.stop()}
        frames.add(stop)
        return stop
      },
      audio: async (options, cb) => {
        declared("perception.audio")
        if (!port.perception) throw new AiosCodeError("NOT_AVAILABLE_ON_RUNTIME", "This host has no perception stream")
        const chunk_ms = options.chunk_ms ?? 40
        if (!AUDIO_CHUNK_MS.has(chunk_ms)) throw new AiosCodeError("INVALID_ARGUMENT", "chunk_ms must be 20, 40 or 100", false, {field: "chunk_ms"})
        const handle = await port.perception.stream({source: "audio", audio: {chunk_ms}}, ((chunk: {stream_id: string; seq: number; captured_at: number; data_base64: string}) => {
          cb({chunk_id: `${chunk.stream_id}:${chunk.seq}`, pcm_base64: chunk.data_base64, sample_rate_hz: 16000, format: "pcm_s16le", captured_at_ms: chunk.captured_at})
        }) as never)
        const stop = async () => {if (frames.delete(stop)) await handle.stop()}
        frames.add(stop)
        return stop
      },
      subscribe: async subscription => {declared("perception.subscriptions"); return (await port.perception!.sub(subscription as never)).status as Json},
      pause: async (id, for_ms) => {declared("perception.subscriptions"); return port.perception!.pause(id, for_ms) as Promise<Json>},
      resume: async id => {declared("perception.subscriptions"); return port.perception!.resume(id) as Promise<Json>},
      unsubscribe: async id => {declared("perception.subscriptions"); await port.perception!.unsubscribe(id)},
      list: async () => {declared("perception.subscriptions"); return port.perception!.list() as Promise<Json[]>},
    },
    net: {fetch: (url, init = {}) => call("net.fetch", {url, ...init})},
    agent: {
      ask: (prompt, options = {}) => call("agent.ask", {prompt, ...options}),
      start: request => call("agent.start", request),
      send: text => call("agent.send", {text}),
      stop: () => call("agent.stop"),
    },
    peer: {send: (topic, body) => call("peer.send", {topic, body})},
    log: {debug: log("debug"), info: log("info"), warn: log("warn"), error: log("error")},
    _stopFrames: async () => {await Promise.all([...frames].map(stop => stop().catch(() => undefined)))},
  }
  return session
}

/**
 * Wire an Experience definition into a connected background session: report
 * the exported handlers, then run each Host dispatch and answer AIOS_CODE_DONE.
 * Ordering, timeouts and dedupe are the Host's; this side only executes.
 */
export function bindExperience(port: ExperienceHostPort, definition: ExperienceDefinition): {ready: Promise<CodeSessionInfo>} {
  let info: CodeSessionInfo | null = null
  const waiting: CodeDispatch[] = []
  const session = createPhoneSession(port, () => info ?? {slug: "", version: "", runtime: "phone", user_ref: "", capabilities: [], now_offset_ms: 0}) as Session & {_stopFrames(): Promise<void>}
  const done = (message: CodeDone) => {void port.sendRequest({type: MiniappRequestType.AIOS_CODE_DONE, ...message}).catch(() => undefined)}
  const run = async (dispatch: CodeDispatch) => {
    if (info && typeof dispatch.now_offset_ms === "number") info.now_offset_ms = dispatch.now_offset_ms
    try {
      let result: unknown
      if (dispatch.kind === "tool") {
        const data = dispatch.event.data
        const tool = definition.tools?.[data.tool]
        if (!tool) throw new AiosCodeError("CODE_TOOL_NOT_EXPORTED", `tool ${data.tool} is not exported`)
        result = await tool(data.args, {call_id: data.call_id, tool: data.tool, activity_id: data.activity_id, session_id: data.session_id, deadline_ms: data.deadline_ms}, session)
      } else {
        const name = handlerFor(dispatch.event)
        const fn = name && name !== "tools" ? definition[name] as Handler<unknown, unknown> | undefined : undefined
        if (fn) result = await fn(dispatch.event, session)
        if (name === "onUnmount") await session._stopFrames()
      }
      done({dispatch_id: dispatch.dispatch_id, ok: true, ...(result !== undefined ? {result: result as Json} : {})})
    } catch (error) {
      const e = toError(error)
      done({dispatch_id: dispatch.dispatch_id, ok: false, error: {code: e.code.slice(0, 80), message: e.message.slice(0, 2000)}})
    }
  }
  port._subscribe(MiniappStreamType.CODE_EVENT, data => {
    const dispatch = data as CodeDispatch
    if (!dispatch || typeof dispatch.dispatch_id !== "string") return
    if (!info) waiting.push(dispatch)
    else void run(dispatch)
  })
  const local = (data: Omit<ButtonData, "press_id" | "at_ms"> & {press_id?: string}) => {
    void port.sendRequest({type: MiniappRequestType.AIOS_CODE_LOCAL_EVENT, event: {type: "button", data}}).catch(() => undefined)
  }
  if (definition.onButton) {
    port._subscribe(MiniappStreamType.BUTTON_PRESS, raw => {
      const press = raw as {buttonId?: string; pressType?: string}
      local({source: "temple", button_id: String(press?.buttonId ?? "main"), action: press?.pressType === "long" ? "long_press" : "press"})
    })
    port._subscribe(MiniappStreamType.SEMANTIC_ACTION, raw => {
      const action = raw as {action?: string; phase?: string; control_id?: string}
      if (action?.phase !== "end") return
      local({source: "action", button_id: String(action.action ?? "activate"), action: "press"})
    })
    port.ui?.on("aios.code.button" as never, payload => {
      const p = (payload ?? {}) as {button_id?: unknown; action?: unknown}
      if (typeof p.button_id !== "string") return
      local({source: "ui", button_id: p.button_id.slice(0, 80), action: p.action === "long_press" || p.action === "double_press" ? p.action : "press"})
    })
  }
  // Direct speech bypasses the output gate: allowed in v1, but leaves a trace.
  if (port.speaker) {
    const speaker = port.speaker as {speak: (...args: unknown[]) => Promise<unknown>}
    const original = speaker.speak.bind(port.speaker)
    speaker.speak = (...args: unknown[]) => {session.log.warn("speaker.speak bypasses the output gate; use session.output.speak"); return original(...args)}
  }
  installConsoleForwarding(port)
  const ready = port.connect().then(async () => {
    const request: CodeReadyRequest = {sdk: CODE_SDK_VERSION, handlers: exportedHandlers(definition), tools: Object.keys(definition.tools ?? {})}
    info = await port.sendRequest<CodeSessionInfo>({type: MiniappRequestType.AIOS_CODE_READY, ...request})
    for (const dispatch of waiting.splice(0)) void run(dispatch)
    return info
  })
  return {ready}
}

/** `console.*` in a code Experience also lands in the developer log (kind "console"). */
function installConsoleForwarding(port: ExperienceHostPort) {
  const target = (globalThis as unknown as {console?: Record<string, unknown>}).console
  if (!target || (target as {__aiosCodeForwarding?: boolean}).__aiosCodeForwarding) return
  const levels: Record<string, LogLevel> = {debug: "debug", log: "info", info: "info", warn: "warn", error: "error"}
  for (const [method, level] of Object.entries(levels)) {
    const original = target[method]
    if (typeof original !== "function") continue
    target[method] = (...args: unknown[]) => {
      ;(original as (...a: unknown[]) => void).apply(target, args)
      const msg = args.map(a => typeof a === "string" ? a : (() => {try {return JSON.stringify(a)} catch {return String(a)}})()).join(" ").slice(0, 2000)
      void port.sendRequest({type: MiniappRequestType.AIOS_CODE_CALL, api: "log.write", args: {level, msg, kind: "console"}}).catch(() => undefined)
    }
  }
  ;(target as {__aiosCodeForwarding?: boolean}).__aiosCodeForwarding = true
}
