export declare const CODE_SDK_VERSION = "0.5.0";
export type Json = null | boolean | number | string | Json[] | {
    [key: string]: Json;
};
export type CodeRuntime = "phone" | "server";
export type CodeEventType = "lifecycle" | "mount" | "signal" | "materials" | "segment" | "utterance" | "button" | "timer" | "schedule" | "peer" | "tool" | "output";
export interface CodeEvent<T = Json> {
    /** "cev_" + 22 base62 (Hub) or "cevp_…" (phone-local). Unique per (user, slug). */
    event_id: string;
    type: CodeEventType;
    /** Hub events: increasing per (user, slug, runtime). Phone-local events: 0. */
    seq: number;
    at_ms: number;
    runtime: CodeRuntime;
    installation: string;
    data: T;
}
export type LifecycleData = {
    phase: "install" | "upgrade" | "uninstall";
    from_version?: string;
    to_version: string;
};
export type MountData = {
    reason: "enabled" | "lease" | "upgrade" | "disabled" | "lease_lost" | "suspended";
    mount_id: string;
};
export type SignalData = {
    subscription_id: string;
    run_id: string | null;
    wake: boolean;
    event: Json;
};
export type MaterialsData = {
    call_id: string;
    material_revision: number;
    subscription_id: string;
    run_id: string | null;
    context: Json;
};
export type SegmentData = {
    subscription_id: string | null;
    run_id: string | null;
    wake: boolean;
    segment: Json;
    event?: Json;
};
export type UtteranceData = {
    text: string;
    rule: number;
    reply_window_ms: number;
    started_at_ms: number | null;
    ended_at_ms: number | null;
};
export type ButtonData = {
    source: "temple" | "ui" | "action";
    button_id: string;
    action: "press" | "long_press" | "double_press";
    press_id: string;
    at_ms: number;
};
export type TimerData = {
    timer_id: string;
    payload: Json;
    due_at_ms: number;
    fired_at_ms: number;
    late_ms: number;
    fired_by: CodeRuntime;
};
export type ScheduleData = {
    schedule_id: string;
    planned_at_ms: number;
    local_date: string;
    tz: string;
    catch_up: boolean;
};
export type PeerData = {
    from: CodeRuntime;
    topic: string;
    body: Json;
    sent_at_ms: number;
};
export type ToolEventData = {
    call_id: string;
    tool: string;
    args: Json;
    activity_id: string | null;
    session_id: string | null;
    deadline_ms: number;
};
export interface ToolCall {
    call_id: string;
    tool: string;
    activity_id: string | null;
    session_id: string | null;
    deadline_ms: number;
}
export type UtteranceReply = {
    reply?: string;
    await_answer_ms?: number;
};
/** Every `session.*` failure. */
export declare class AiosCodeError extends Error {
    readonly code: string;
    readonly retryable: boolean;
    readonly details?: Json;
    constructor(code: string, message: string, retryable?: boolean, details?: Json);
}
export type Capability = "store" | "local" | "timers" | "schedules" | "output.speak" | "output.notify" | "outputs" | "materials" | "memory" | "images" | "camera.capture" | "perception.frames" | "perception.audio" | "perception.subscriptions" | "net.fetch" | "agent.ask" | "agent.start" | "peer" | "log";
export declare const CAPABILITIES: readonly Capability[];
export type TimerView = {
    timer_id: string;
    owner_runtime: CodeRuntime;
    state: "scheduled" | "paused" | "fired" | "cancelled";
    due_at_ms: number | null;
    remaining_ms: number | null;
    payload: Json;
    fallback: string;
    created_at_ms: number;
};
export type TimerSpec = {
    id: string;
    at_ms?: number;
    in_ms?: number;
    payload?: Json;
    fallback?: "server" | "notify" | "none";
    fallback_text?: string;
};
export type ScheduleView = {
    id: string;
    at: string;
    days: string[];
    tz: string;
    enabled: boolean;
    next_at_ms: number | null;
};
export type Urgency = "low" | "normal" | "high";
export type OutputDecision = {
    output_ref: string;
    outcome: "played" | "display_only" | "suppressed";
    reason?: string;
    fallback?: "voice" | "phone_notification";
    delivery: "phone_local" | "phone_push" | "held";
};
export type OutputStatus = {
    output_ref: string;
    receipt: "played" | "interrupted" | "discarded" | "posted" | null;
    receipt_at: number | null;
    delivery?: OutputDecision["delivery"];
    outcome?: OutputDecision["outcome"];
    fallback?: OutputDecision["fallback"];
};
export type CaptureView = {
    intent_id: string;
    state: "pending" | "captured" | "failed" | "cancelled";
    photo_ref?: string;
    width?: number;
    height?: number;
    captured_at_ms?: number;
    error?: string;
};
/** Expiry shares Frame.captured_at_ms clock. Upper retention bound only; permission,
 * generation and capacity may revoke earlier. Older Hosts omit these fields. */
export type RealityFrameReference = {
    stream_id: string;
    ref: string;
    program_id: string;
    retention_ms?: number;
    expires_at_ms?: number;
};
export type Frame = {
    reality?: RealityFrameReference[];
    frame_id: string;
    jpeg_base64: string;
    captured_at_ms: number;
    width: number;
    height: number;
};
export type AudioChunk = {
    chunk_id: string;
    pcm_base64: string;
    sample_rate_hz: 16000;
    format: "pcm_s16le";
    captured_at_ms: number;
};
export type Evidence = {
    image_ref?: string;
    photo_ref?: string;
    captured_at_ms?: number;
};
export type FetchInit = {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    body_base64?: string;
    timeout_ms?: number;
};
export type FetchResult = {
    status: number;
    headers: Record<string, string>;
    body?: string;
    body_base64?: string;
    truncated: boolean;
};
export type AskOptions = {
    attach?: string[];
    schema?: Json;
    context?: string;
    tools?: "experience" | "none";
    timeout_ms?: number;
    request_id?: string;
};
export type AskResult = {
    text: string;
    data?: Json;
    run_id: string;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
};
export type LogLevel = "debug" | "info" | "warn" | "error";
/** Retain request_id across uncertain receipts; only the calling handler waits. */
export type MemoryOptions = {
    request_id: string;
};
export type RememberOptions = MemoryOptions & {
    kind?: "profile" | "timeline" | "entity";
    dimension?: string;
    entity?: string;
    aliases?: string[];
};
export interface Session {
    readonly slug: string;
    readonly version: string;
    readonly runtime: CodeRuntime;
    readonly user_ref: string;
    /** Epoch ms corrected by the Hub clock. */
    now(): number;
    store: {
        get(key: string): Promise<{
            value: Json | null;
            rev: number;
        }>;
        /** Conflicts are returned, never thrown. `value === null` deletes. */
        cas(key: string, expected_rev: number, value: Json | null): Promise<{
            ok: true;
            rev: number;
        } | {
            ok: false;
            code: "STORE_CONFLICT";
            current: {
                value: Json | null;
                rev: number;
            };
        }>;
        list(options?: {
            prefix?: string;
            after?: string;
            limit?: number;
        }): Promise<{
            items: Array<{
                key: string;
                rev: number;
                value: Json;
            }>;
            next: string | null;
        }>;
    };
    /** Phone only: the App's own local key-value storage, no CAS and no sync. */
    local: {
        get(key: string): Promise<string | null>;
        set(key: string, value: string): Promise<void>;
        delete(key: string): Promise<void>;
        list(): Promise<string[]>;
    };
    timers: {
        schedule(spec: TimerSpec): Promise<TimerView>;
        cancel(id: string): Promise<{
            ok: boolean;
            state: TimerView["state"];
        }>;
        pause(id: string): Promise<TimerView>;
        resume(id: string): Promise<TimerView>;
        get(id: string): Promise<TimerView | null>;
        list(): Promise<TimerView[]>;
    };
    schedules: {
        list(): Promise<ScheduleView[]>;
        set(id: string, patch: {
            enabled?: boolean;
            at?: string;
            days?: string[];
        }): Promise<ScheduleView>;
    };
    output: {
        /** Read only this Experience's playback receipt; speak admission is not playback. */
        status(output_ref: string): Promise<OutputStatus>;
        /** Optional audio_url is developer-owned prerecorded audio; the normal output gate still controls playback. */
        speak(text: string, options?: {
            urgency?: Urgency;
            dedupe_key?: string;
            await_answer_ms?: number;
            audio_url?: string;
        }): Promise<OutputDecision>;
        notify(text: string, options?: {
            title?: string;
            urgency?: Urgency;
            dedupe_key?: string;
            open?: string;
        }): Promise<OutputDecision>;
    };
    outputs: {
        /** `version` is an opaque string from the Hub (the Assets store's content version). */
        read(key: string): Promise<{
            output_id: string;
            version: string;
            output: Json;
        } | null>;
        write(key: string, output: Json, options: {
            expected_version: string | null;
            evidence?: Evidence[];
        }): Promise<{
            output_id: string;
            version: string;
            evidence_entry_ids?: string[];
        }>;
        /** Read, change, write; retries on OUTPUT_VERSION_CONFLICT. */
        update(key: string, fn: (current: Json | null) => Json | Promise<Json>, options?: {
            max_retries?: number;
        }): Promise<{
            output_id: string;
            version: string;
            evidence_entry_ids?: string[];
        }>;
    };
    memory: {
        remember(text: string, options: RememberOptions): Promise<Json>;
        search(question: string, options: MemoryOptions & {
            limit?: number;
        }): Promise<Json>;
        forget(text: string, options: MemoryOptions): Promise<Json>;
    };
    materials: {
        add(entry: Json): Promise<Json>;
        query(q: Json): Promise<Json>;
        get(entry_id: string): Promise<Json>;
        delete(entry_id: string): Promise<Json>;
        keepEvidence(request: Json): Promise<Json>;
    };
    images: {
        upload(photo_ref: string): Promise<{
            image_ref: string;
            expires_at_ms: number;
        }>;
        get(image_ref: string): Promise<{
            mime: string;
            width: number;
            height: number;
            bytes_base64: string;
        }>;
    };
    camera: {
        capture(request: {
            intent_id: string;
            max_side?: number;
            reason?: string;
        }): Promise<CaptureView>;
        status(intent_id: string): Promise<CaptureView | null>;
        cancel(intent_id: string): Promise<CaptureView>;
    };
    perception: {
        reportProgram(reference: RealityFrameReference, state: "match" | "clear" | "unknown", evidence_refs?: string[]): Promise<unknown>;
        /** Phone only, while mounted. fps snaps down to 1/2/7/15, max_side <= 1280. Resolves to a stop function. */
        frames(options: {
            fps?: number;
            max_side?: number;
        }, cb: (frame: Frame) => void): Promise<() => Promise<void>>;
        /** Phone only, while mounted. 16 kHz mono PCM in chunk_ms pieces (20/40/100). Resolves to a stop function. */
        audio(options: {
            chunk_ms?: 20 | 40 | 100;
        }, cb: (chunk: AudioChunk) => void): Promise<() => Promise<void>>;
        subscribe(subscription: Json): Promise<Json>;
        pause(id: string, for_ms?: number): Promise<Json>;
        resume(id: string): Promise<Json>;
        unsubscribe(id: string): Promise<void>;
        list(): Promise<Json[]>;
    };
    net: {
        fetch(url: string, init?: FetchInit): Promise<FetchResult>;
    };
    agent: {
        /** The answer goes to the code only; it is never spoken. */
        ask(prompt: string, options?: AskOptions): Promise<AskResult>;
        start(request: {
            reason: string;
            context?: string;
            accepts_user_turns?: boolean;
        }): Promise<{
            activity_id: string;
            session_id: string;
            started: boolean;
        }>;
        send(text: string): Promise<{
            ok: boolean;
        }>;
        stop(): Promise<{
            ok: boolean;
        }>;
    };
    peer: {
        send(topic: string, body: Json): Promise<{
            ok: true;
        }>;
    };
    log: Record<LogLevel, (msg: string, fields?: Json) => void>;
}
type Handler<T, R = void> = (event: CodeEvent<T>, session: Session) => Promise<R> | R;
export interface ExperienceHandlers {
    onInstall?: Handler<LifecycleData>;
    onUpgrade?: Handler<LifecycleData>;
    onUninstall?: Handler<LifecycleData>;
    onMount?: Handler<MountData>;
    onUnmount?: Handler<MountData>;
    onSignal?: Handler<SignalData>;
    /** Additional materials for an existing invocation; never a new signal or run. */
    onMaterials?: Handler<MaterialsData>;
    onSegment?: Handler<SegmentData>;
    onUtterance?: Handler<UtteranceData, UtteranceReply | void>;
    onButton?: Handler<ButtonData>;
    onTimer?: Handler<TimerData>;
    onSchedule?: Handler<ScheduleData>;
    onPeer?: Handler<PeerData>;
    tools?: Record<string, (args: Json, call: ToolCall, session: Session) => Promise<Json> | Json>;
}
export type ExperienceDefinition<T extends ExperienceHandlers = ExperienceHandlers> = T & {
    readonly __aios_experience: 1;
};
/** Returns the argument unchanged, marked so `registerApp` and the server shim recognise it. */
export declare function defineExperience<T extends ExperienceHandlers>(definition: T): ExperienceDefinition<T>;
export declare function isExperienceDefinition(value: unknown): value is ExperienceDefinition;
/** Manifest handler name → exported function. `tool` means a non-empty `tools` map. */
export declare const MANIFEST_HANDLERS: {
    readonly install: "onInstall";
    readonly upgrade: "onUpgrade";
    readonly uninstall: "onUninstall";
    readonly mount: "onMount";
    readonly unmount: "onUnmount";
    readonly signal: "onSignal";
    readonly materials: "onMaterials";
    readonly segment: "onSegment";
    readonly utterance: "onUtterance";
    readonly button: "onButton";
    readonly timer: "onTimer";
    readonly schedule: "onSchedule";
    readonly peer: "onPeer";
    readonly tool: "tools";
};
export type ManifestHandler = keyof typeof MANIFEST_HANDLERS;
/** The manifest handler names a definition actually exports (what the Host checks against `code.phone.handlers`). */
export declare function exportedHandlers(definition: ExperienceHandlers): ManifestHandler[];
/** Which function receives an event. */
export declare function handlerFor(event: Pick<CodeEvent, "type" | "data">): keyof ExperienceHandlers | null;
export type CodeDispatch = {
    dispatch_id: string;
    kind: "event";
    event: CodeEvent;
    now_offset_ms?: number;
} | {
    dispatch_id: string;
    kind: "tool";
    event: CodeEvent<ToolEventData>;
    now_offset_ms?: number;
};
export type CodeDone = {
    dispatch_id: string;
    ok: true;
    result?: Json;
} | {
    dispatch_id: string;
    ok: false;
    error: {
        code: string;
        message: string;
    };
};
export type CodeSessionInfo = {
    slug: string;
    version: string;
    runtime: "phone";
    user_ref: string;
    capabilities: string[];
    now_offset_ms: number;
};
export type CodeReadyRequest = {
    sdk: string;
    handlers: ManifestHandler[];
    tools: string[];
};
/** The subset of MiniappSession that binding needs (kept structural for tests). */
export interface ExperienceHostPort {
    sendRequest<T = unknown>(payload: object, opts?: {
        timeoutMs?: number;
    }): Promise<T>;
    _subscribe(stream: string, handler: (data: unknown) => void): () => void;
    connect(): Promise<void>;
    storage: {
        get(key: string): Promise<string | null>;
        set(key: string, value: string): Promise<void>;
        delete(key: string): Promise<void>;
        keys(): Promise<string[]>;
    };
    perception?: {
        stream(request: {
            source: "video";
            video?: {
                fps?: 1 | 2 | 7 | 15 | 24 | 30;
                max_resolution?: "360p" | "540p" | "720p";
            };
        } | {
            source: "audio";
            audio?: {
                chunk_ms?: 20 | 40 | 100;
            };
        }, handler: (chunk: never) => void): Promise<{
            id: string;
            stop(): Promise<void>;
        }>;
        sub(subscription: never): Promise<{
            status: unknown;
        }>;
        pause(id: string, forMs?: number): Promise<unknown>;
        resume(id: string): Promise<unknown>;
        unsubscribe(id: string): Promise<void>;
        list(): Promise<unknown[]>;
    };
    speaker?: {
        speak(...args: never[]): Promise<unknown>;
    };
    ui?: {
        on(channel: never, cb: (payload: unknown) => void): () => void;
    };
}
/**
 * Builds the phone `Session`. Every Hub-backed API is one AIOS_CODE_CALL; the
 * Host checks the capability and the mount, so a modified bundle gains nothing.
 */
export declare function createPhoneSession(port: ExperienceHostPort, info: () => CodeSessionInfo): Session;
/**
 * Wire an Experience definition into a connected background session: report
 * the exported handlers, then run each Host dispatch and answer AIOS_CODE_DONE.
 * Ordering, timeouts and dedupe are the Host's; this side only executes.
 */
export declare function bindExperience(port: ExperienceHostPort, definition: ExperienceDefinition): {
    ready: Promise<CodeSessionInfo>;
};
export {};
