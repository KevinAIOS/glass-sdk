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
import { MiniappRequestType, MiniappStreamType } from "./protocol";
export const CODE_SDK_VERSION = "0.5.0";
/** Every `session.*` failure. */
export class AiosCodeError extends Error {
    constructor(code, message, retryable = false, details) {
        super(message);
        this.name = "AiosCodeError";
        this.code = code;
        this.retryable = retryable;
        if (details !== undefined)
            this.details = details;
    }
}
export const CAPABILITIES = [
    "store", "local", "timers", "schedules", "output.speak", "output.notify", "outputs", "materials", "memory", "images",
    "camera.capture", "perception.frames", "perception.audio", "perception.subscriptions", "net.fetch", "agent.ask", "agent.start", "peer", "log",
];
/** Returns the argument unchanged, marked so `registerApp` and the server shim recognise it. */
export function defineExperience(definition) {
    return Object.assign(definition, { __aios_experience: 1 });
}
export function isExperienceDefinition(value) {
    return !!value && typeof value === "object" && value.__aios_experience === 1;
}
/** Manifest handler name → exported function. `tool` means a non-empty `tools` map. */
export const MANIFEST_HANDLERS = {
    install: "onInstall", upgrade: "onUpgrade", uninstall: "onUninstall", mount: "onMount", unmount: "onUnmount",
    signal: "onSignal", materials: "onMaterials", segment: "onSegment", utterance: "onUtterance", button: "onButton", timer: "onTimer",
    schedule: "onSchedule", peer: "onPeer", tool: "tools",
};
/** The manifest handler names a definition actually exports (what the Host checks against `code.phone.handlers`). */
export function exportedHandlers(definition) {
    return Object.keys(MANIFEST_HANDLERS).filter(name => {
        const key = MANIFEST_HANDLERS[name];
        if (key === "tools")
            return !!definition.tools && Object.keys(definition.tools).length > 0;
        return typeof definition[key] === "function";
    });
}
/** Which function receives an event. */
export function handlerFor(event) {
    const data = (event.data ?? {});
    switch (event.type) {
        case "lifecycle": return data.phase === "install" ? "onInstall" : data.phase === "upgrade" ? "onUpgrade" : data.phase === "uninstall" ? "onUninstall" : null;
        case "mount": return ["disabled", "lease_lost", "suspended"].includes(String(data.reason)) ? "onUnmount" : "onMount";
        case "signal": return "onSignal";
        case "materials": return "onMaterials";
        case "segment": return "onSegment";
        case "utterance": return "onUtterance";
        case "button": return "onButton";
        case "timer": return "onTimer";
        case "schedule": return "onSchedule";
        case "peer": return "onPeer";
        default: return null;
    }
}
const toError = (error) => {
    if (error instanceof AiosCodeError)
        return error;
    const e = (error ?? {});
    return new AiosCodeError(typeof e.code === "string" ? e.code : "INTERNAL", typeof e.message === "string" ? e.message : String(error), e.retryable === true, e.details);
};
const CALL_TIMEOUT_MS = { "memory.remember": 35000, "memory.search": 35000, "memory.forget": 35000, "camera.capture": 25000, "net.fetch": 15000, "output.speak": 60000, "agent.start": 20000 };
const FRAME_FPS = (fps = 1) => (fps >= 15 ? 15 : fps >= 7 ? 7 : fps >= 2 ? 2 : 1);
const AUDIO_CHUNK_MS = new Set([20, 40, 100]);
const FRAME_RESOLUTION = (side = 768) => (side <= 360 ? "360p" : side <= 540 ? "540p" : "720p");
/**
 * Builds the phone `Session`. Every Hub-backed API is one AIOS_CODE_CALL; the
 * Host checks the capability and the mount, so a modified bundle gains nothing.
 */
export function createPhoneSession(port, info) {
    const call = async (api, args = {}) => {
        const askTimeout = api === "agent.ask" ? Math.min(Number(args.timeout_ms ?? 30000), 60000) + 5000 : undefined;
        try {
            return await port.sendRequest({ type: MiniappRequestType.AIOS_CODE_CALL, api, args }, { timeoutMs: askTimeout ?? CALL_TIMEOUT_MS[api] ?? 15000 });
        }
        catch (error) {
            throw toError(error);
        }
    };
    const declared = (capability) => {
        if (!info().capabilities.includes(capability))
            throw new AiosCodeError("CAPABILITY_NOT_DECLARED", `${capability} is not declared in code.capabilities`);
    };
    const frames = new Set();
    const log = (level) => (msg, fields) => {
        void call("log.write", { level, msg: String(msg).slice(0, 2000), ...(fields !== undefined ? { fields } : {}), kind: "api" }).catch(() => undefined);
    };
    const session = {
        get slug() { return info().slug; },
        get version() { return info().version; },
        runtime: "phone",
        get user_ref() { return info().user_ref; },
        now: () => Date.now() + (info().now_offset_ms || 0),
        store: {
            get: key => call("store.get", { key }),
            cas: (key, expected_rev, value) => call("store.cas", { key, expected_rev, value }),
            list: (options = {}) => call("store.list", options),
        },
        local: {
            get: async (key) => { declared("local"); return port.storage.get(key); },
            set: async (key, value) => { declared("local"); await port.storage.set(key, value); },
            delete: async (key) => { declared("local"); await port.storage.delete(key); },
            list: async () => { declared("local"); return port.storage.keys(); },
        },
        timers: {
            schedule: spec => call("timers.schedule", spec),
            cancel: id => call("timers.cancel", { id }),
            pause: id => call("timers.pause", { id }),
            resume: id => call("timers.resume", { id }),
            get: id => call("timers.get", { id }),
            list: () => call("timers.list"),
        },
        schedules: {
            list: () => call("schedules.list"),
            set: (id, patch) => call("schedules.set", { id, ...patch }),
        },
        output: {
            status: output_ref => call("output.status", { output_ref }),
            speak: (text, options = {}) => call("output.speak", { text, ...options }),
            notify: (text, options = {}) => call("output.notify", { text, ...options }),
        },
        outputs: {
            read: key => call("outputs.read", { key }),
            write: (key, output, options) => call("outputs.write", { key, output, ...options }),
            update: async (key, fn, options = {}) => {
                const retries = options.max_retries ?? 3;
                for (let attempt = 0;; attempt++) {
                    const current = await session.outputs.read(key);
                    const next = await fn(current?.output ?? null);
                    try {
                        return await session.outputs.write(key, next, { expected_version: current?.version ?? null });
                    }
                    catch (error) {
                        if (error.code !== "OUTPUT_VERSION_CONFLICT" || attempt >= retries)
                            throw error;
                    }
                }
            },
        },
        memory: {
            remember: (text, options) => call("memory.remember", { text, ...options }),
            search: (question, options) => call("memory.search", { question, ...options }),
            forget: (text, options) => call("memory.forget", { text, ...options }),
        },
        materials: {
            add: entry => call("materials.add", { entry }),
            query: q => call("materials.query", { q }),
            get: entry_id => call("materials.get", { entry_id }),
            delete: entry_id => call("materials.delete", { entry_id }),
            keepEvidence: request => call("materials.keepEvidence", { request }),
        },
        images: {
            upload: photo_ref => call("images.upload", { photo_ref }),
            get: image_ref => call("images.get", { image_ref }),
        },
        camera: {
            capture: request => call("camera.capture", request),
            status: intent_id => call("camera.status", { intent_id }),
            cancel: intent_id => call("camera.cancel", { intent_id }),
        },
        perception: {
            reportProgram: (reference, state, evidence_refs) => {
                declared("perception.frames");
                return port.sendRequest({ type: MiniappRequestType.AIOS_PERCEPTION_PROGRAM_REPORT, stream_id: reference.stream_id, report: { ref: reference.ref, state, ...(evidence_refs ? { evidence_refs } : {}) } });
            },
            frames: async (options, cb) => {
                declared("perception.frames");
                if (!port.perception)
                    throw new AiosCodeError("NOT_AVAILABLE_ON_RUNTIME", "This host has no perception stream");
                const fps = options.fps ?? 1, side = options.max_side ?? 768;
                if (!(fps > 0) || !(side > 0 && side <= 1280))
                    throw new AiosCodeError("INVALID_ARGUMENT", "fps must be > 0 and max_side ≤1280", false, { field: !(fps > 0) ? "fps" : "max_side" });
                const handle = await port.perception.stream({ source: "video", video: { fps: FRAME_FPS(fps), max_resolution: FRAME_RESOLUTION(side) } }, ((chunk) => {
                    cb({ frame_id: `${chunk.stream_id}:${chunk.seq}`, jpeg_base64: chunk.data_base64, captured_at_ms: chunk.captured_at, width: chunk.width, height: chunk.height, ...(chunk.reality ? { reality: chunk.reality.map(r => ({ ...r, stream_id: chunk.stream_id })) } : {}) });
                }));
                const stop = async () => { if (frames.delete(stop))
                    await handle.stop(); };
                frames.add(stop);
                return stop;
            },
            audio: async (options, cb) => {
                declared("perception.audio");
                if (!port.perception)
                    throw new AiosCodeError("NOT_AVAILABLE_ON_RUNTIME", "This host has no perception stream");
                const chunk_ms = options.chunk_ms ?? 40;
                if (!AUDIO_CHUNK_MS.has(chunk_ms))
                    throw new AiosCodeError("INVALID_ARGUMENT", "chunk_ms must be 20, 40 or 100", false, { field: "chunk_ms" });
                const handle = await port.perception.stream({ source: "audio", audio: { chunk_ms } }, ((chunk) => {
                    cb({ chunk_id: `${chunk.stream_id}:${chunk.seq}`, pcm_base64: chunk.data_base64, sample_rate_hz: 16000, format: "pcm_s16le", captured_at_ms: chunk.captured_at });
                }));
                const stop = async () => { if (frames.delete(stop))
                    await handle.stop(); };
                frames.add(stop);
                return stop;
            },
            subscribe: async (subscription) => { declared("perception.subscriptions"); return (await port.perception.sub(subscription)).status; },
            pause: async (id, for_ms) => { declared("perception.subscriptions"); return port.perception.pause(id, for_ms); },
            resume: async (id) => { declared("perception.subscriptions"); return port.perception.resume(id); },
            unsubscribe: async (id) => { declared("perception.subscriptions"); await port.perception.unsubscribe(id); },
            list: async () => { declared("perception.subscriptions"); return port.perception.list(); },
        },
        net: { fetch: (url, init = {}) => call("net.fetch", { url, ...init }) },
        agent: {
            ask: (prompt, options = {}) => call("agent.ask", { prompt, ...options }),
            start: request => call("agent.start", request),
            send: text => call("agent.send", { text }),
            stop: () => call("agent.stop"),
        },
        peer: { send: (topic, body) => call("peer.send", { topic, body }) },
        log: { debug: log("debug"), info: log("info"), warn: log("warn"), error: log("error") },
        _stopFrames: async () => { await Promise.all([...frames].map(stop => stop().catch(() => undefined))); },
    };
    return session;
}
/**
 * Wire an Experience definition into a connected background session: report
 * the exported handlers, then run each Host dispatch and answer AIOS_CODE_DONE.
 * Ordering, timeouts and dedupe are the Host's; this side only executes.
 */
export function bindExperience(port, definition) {
    let info = null;
    const waiting = [];
    const session = createPhoneSession(port, () => info ?? { slug: "", version: "", runtime: "phone", user_ref: "", capabilities: [], now_offset_ms: 0 });
    const done = (message) => { void port.sendRequest({ type: MiniappRequestType.AIOS_CODE_DONE, ...message }).catch(() => undefined); };
    const run = async (dispatch) => {
        if (info && typeof dispatch.now_offset_ms === "number")
            info.now_offset_ms = dispatch.now_offset_ms;
        try {
            let result;
            if (dispatch.kind === "tool") {
                const data = dispatch.event.data;
                const tool = definition.tools?.[data.tool];
                if (!tool)
                    throw new AiosCodeError("CODE_TOOL_NOT_EXPORTED", `tool ${data.tool} is not exported`);
                result = await tool(data.args, { call_id: data.call_id, tool: data.tool, activity_id: data.activity_id, session_id: data.session_id, deadline_ms: data.deadline_ms }, session);
            }
            else {
                const name = handlerFor(dispatch.event);
                const fn = name && name !== "tools" ? definition[name] : undefined;
                if (fn)
                    result = await fn(dispatch.event, session);
                if (name === "onUnmount")
                    await session._stopFrames();
            }
            done({ dispatch_id: dispatch.dispatch_id, ok: true, ...(result !== undefined ? { result: result } : {}) });
        }
        catch (error) {
            const e = toError(error);
            done({ dispatch_id: dispatch.dispatch_id, ok: false, error: { code: e.code.slice(0, 80), message: e.message.slice(0, 2000) } });
        }
    };
    port._subscribe(MiniappStreamType.CODE_EVENT, data => {
        const dispatch = data;
        if (!dispatch || typeof dispatch.dispatch_id !== "string")
            return;
        if (!info)
            waiting.push(dispatch);
        else
            void run(dispatch);
    });
    const local = (data) => {
        void port.sendRequest({ type: MiniappRequestType.AIOS_CODE_LOCAL_EVENT, event: { type: "button", data } }).catch(() => undefined);
    };
    if (definition.onButton) {
        port._subscribe(MiniappStreamType.BUTTON_PRESS, raw => {
            const press = raw;
            local({ source: "temple", button_id: String(press?.buttonId ?? "main"), action: press?.pressType === "long" ? "long_press" : "press" });
        });
        port._subscribe(MiniappStreamType.SEMANTIC_ACTION, raw => {
            const action = raw;
            if (action?.phase !== "end")
                return;
            local({ source: "action", button_id: String(action.action ?? "activate"), action: "press" });
        });
        port.ui?.on("aios.code.button", payload => {
            const p = (payload ?? {});
            if (typeof p.button_id !== "string")
                return;
            local({ source: "ui", button_id: p.button_id.slice(0, 80), action: p.action === "long_press" || p.action === "double_press" ? p.action : "press" });
        });
    }
    // Direct speech bypasses the output gate: allowed in v1, but leaves a trace.
    if (port.speaker) {
        const speaker = port.speaker;
        const original = speaker.speak.bind(port.speaker);
        speaker.speak = (...args) => { session.log.warn("speaker.speak bypasses the output gate; use session.output.speak"); return original(...args); };
    }
    installConsoleForwarding(port);
    const ready = port.connect().then(async () => {
        const request = { sdk: CODE_SDK_VERSION, handlers: exportedHandlers(definition), tools: Object.keys(definition.tools ?? {}) };
        info = await port.sendRequest({ type: MiniappRequestType.AIOS_CODE_READY, ...request });
        for (const dispatch of waiting.splice(0))
            void run(dispatch);
        return info;
    });
    return { ready };
}
/** `console.*` in a code Experience also lands in the developer log (kind "console"). */
function installConsoleForwarding(port) {
    const target = globalThis.console;
    if (!target || target.__aiosCodeForwarding)
        return;
    const levels = { debug: "debug", log: "info", info: "info", warn: "warn", error: "error" };
    for (const [method, level] of Object.entries(levels)) {
        const original = target[method];
        if (typeof original !== "function")
            continue;
        target[method] = (...args) => {
            ;
            original.apply(target, args);
            const msg = args.map(a => typeof a === "string" ? a : (() => { try {
                return JSON.stringify(a);
            }
            catch {
                return String(a);
            } })()).join(" ").slice(0, 2000);
            void port.sendRequest({ type: MiniappRequestType.AIOS_CODE_CALL, api: "log.write", args: { level, msg, kind: "console" } }).catch(() => undefined);
        };
    }
    ;
    target.__aiosCodeForwarding = true;
}
