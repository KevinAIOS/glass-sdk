/// <reference types="bun-types" />
import {describe, expect, test} from "bun:test"
import {AiosCodeError, bindExperience, CODE_SDK_VERSION, createPhoneSession, defineExperience, exportedHandlers, handlerFor, isExperienceDefinition, type CodeDispatch, type ExperienceHostPort} from "./experience"
import {MiniappRequestType, MiniappStreamType} from "./protocol"

const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0))
const info = {slug: "multi-pot-timers", version: "0.6.0", runtime: "phone" as const, user_ref: "u".repeat(24), capabilities: ["timers", "store", "local", "outputs"], now_offset_ms: 500}

function fakePort(answer: (payload: Record<string, unknown>) => unknown = () => ({})) {
  const sent: Record<string, unknown>[] = []
  const streams = new Map<string, (data: unknown) => void>()
  const store = new Map<string, string>()
  let connected!: () => void
  const port: ExperienceHostPort = {
    sendRequest: async <T>(payload: object) => {
      const p = payload as Record<string, unknown>
      sent.push(p)
      if (p.type === MiniappRequestType.AIOS_CODE_READY) return info as T
      const value = answer(p)
      if (value instanceof Error || (value && typeof value === "object" && "reject" in value)) throw (value as {reject?: unknown}).reject ?? value
      return value as T
    },
    _subscribe: (stream, handler) => {streams.set(stream, handler); return () => streams.delete(stream)},
    connect: () => new Promise<void>(resolve => {connected = resolve}),
    storage: {get: async k => store.get(k) ?? null, set: async (k, v) => {store.set(k, v)}, delete: async k => {store.delete(k)}, keys: async () => [...store.keys()]},
  }
  return {port, sent, streams, connect: () => connected(), dispatch: (d: CodeDispatch) => streams.get(MiniappStreamType.CODE_EVENT)?.(d)}
}
const timerEvent = (id = "cev_1"): CodeDispatch => ({dispatch_id: `d-${id}`, kind: "event", event: {event_id: id, type: "timer", seq: 0, at_ms: 1, runtime: "phone", installation: "0.6.0",
  data: {timer_id: "pot-1/step-2", payload: {pot: 1}, due_at_ms: 1, fired_at_ms: 2, late_ms: 1, fired_by: "phone"}}})

describe("defineExperience", () => {
  test("marks the definition and lists exported handlers by manifest name", () => {
    const def = defineExperience({onTimer() {}, onMount() {}, tools: {start_pot_step: () => ({ok: true})}})
    expect(isExperienceDefinition(def)).toBe(true)
    expect(def.__aios_experience).toBe(1)
    expect(isExperienceDefinition(() => {})).toBe(false)
    expect(exportedHandlers(def).sort()).toEqual(["mount", "timer", "tool"])
    expect(exportedHandlers(defineExperience({tools: {}}))).toEqual([])
    expect(CODE_SDK_VERSION).toBe("0.5.0")
  })
  test("routes each event type to its handler", () => {
    expect(handlerFor({type: "lifecycle", data: {phase: "upgrade"}})).toBe("onUpgrade")
    expect(handlerFor({type: "mount", data: {reason: "lease"}})).toBe("onMount")
    expect(handlerFor({type: "mount", data: {reason: "lease_lost"}})).toBe("onUnmount")
    expect(handlerFor({type: "signal", data: {}})).toBe("onSignal")
    expect(handlerFor({type: "output", data: {}})).toBeNull()
  })
})

describe("bindExperience", () => {
  test("reports handlers after connect and holds dispatches until the Host answers", async () => {
    const seen: unknown[] = []
    const h = fakePort()
    const bound = bindExperience(h.port, defineExperience({onTimer: (ev, s) => {seen.push([ev.data, s.slug, s.now() >= Date.now()])}}))
    h.dispatch(timerEvent())
    await flush()
    expect(seen).toEqual([])
    h.connect()
    await bound.ready
    await flush()
    expect(h.sent[0]).toMatchObject({type: MiniappRequestType.AIOS_CODE_READY, sdk: "0.5.0", handlers: ["timer"], tools: []})
    expect(seen).toEqual([[{timer_id: "pot-1/step-2", payload: {pot: 1}, due_at_ms: 1, fired_at_ms: 2, late_ms: 1, fired_by: "phone"}, "multi-pot-timers", true]])
    expect(h.sent.at(-1)).toEqual({type: MiniappRequestType.AIOS_CODE_DONE, dispatch_id: "d-cev_1", ok: true})
  })
  test("tool calls return the handler result; thrown errors become a failed DONE with the developer code", async () => {
    const h = fakePort()
    const bound = bindExperience(h.port, defineExperience({
      onSignal: () => {throw new AiosCodeError("POT_UNKNOWN", "no such pot")},
      tools: {start_pot_step: (args, call) => ({started: (args as {pot_id: string}).pot_id, call: call.call_id})},
    }))
    h.connect(); await bound.ready
    h.dispatch({dispatch_id: "t1", kind: "tool", event: {event_id: "cev_t", type: "tool", seq: 3, at_ms: 1, runtime: "phone", installation: "0.6.0",
      data: {call_id: "call_1", tool: "start_pot_step", args: {pot_id: "p1"}, activity_id: null, session_id: null, deadline_ms: 9}}})
    h.dispatch({dispatch_id: "s1", kind: "event", event: {event_id: "cev_s", type: "signal", seq: 4, at_ms: 1, runtime: "phone", installation: "0.6.0", data: {subscription_id: "x", run_id: null, wake: true, event: {}}}})
    await flush(); await flush()
    const done = h.sent.filter(m => m.type === MiniappRequestType.AIOS_CODE_DONE)
    expect(done).toContainEqual({type: MiniappRequestType.AIOS_CODE_DONE, dispatch_id: "t1", ok: true, result: {started: "p1", call: "call_1"}})
    expect(done).toContainEqual({type: MiniappRequestType.AIOS_CODE_DONE, dispatch_id: "s1", ok: false, error: {code: "POT_UNKNOWN", message: "no such pot"}})
  })
  test("session calls go through AIOS_CODE_CALL and Host errors surface as AiosCodeError", async () => {
    const h = fakePort(p => p.api === "store.cas" ? {reject: {code: "QUOTA_EXCEEDED", message: "1 MB", retryable: false, details: {limit: 1048576}}} : {value: null, rev: 0})
    let caught: unknown, got: unknown
    const bound = bindExperience(h.port, defineExperience({onTimer: async (_ev, s) => {
      got = await s.store.get("pot/1")
      try {await s.store.cas("pot/1", 0, {x: 1})} catch (error) {caught = error}
    }}))
    h.connect(); await bound.ready
    h.dispatch(timerEvent()); await flush(); await flush(); await flush()
    expect(got).toEqual({value: null, rev: 0})
    expect(h.sent).toContainEqual({type: MiniappRequestType.AIOS_CODE_CALL, api: "store.get", args: {key: "pot/1"}})
    expect(caught).toBeInstanceOf(AiosCodeError)
    expect(caught).toMatchObject({code: "QUOTA_EXCEEDED", details: {limit: 1048576}})
  })
  test("outputs.update retries a version conflict; local is the App storage and needs the capability", async () => {
    let writes = 0
    const h = fakePort(p => {
      if (p.api === "outputs.read") return {output_id: "o1", version: `v${writes + 1}`, output: {items: writes}}
      if (p.api === "outputs.write") return ++writes < 2 ? {reject: {code: "OUTPUT_VERSION_CONFLICT", message: "stale"}} : {output_id: "o1", version: "v3"}
      return {}
    })
    let result: unknown, frames: unknown
    const bound = bindExperience(h.port, defineExperience({onTimer: async (_ev, s) => {
      result = await s.outputs.update("promises", current => ({items: ((current as {items: number}).items) + 1}))
      await s.local.set("k", "v")
      try {await s.perception.frames({fps: 2}, () => {})} catch (error) {frames = error}
    }}))
    h.connect(); await bound.ready
    h.dispatch(timerEvent()); for (let i = 0; i < 8; i++) await flush()
    expect(result).toEqual({output_id: "o1", version: "v3"})
    expect(await h.port.storage.get("k")).toBe("v")
    expect(frames).toMatchObject({code: "CAPABILITY_NOT_DECLARED"})
  })
  test("button presses are sent to the Host as phone-local events", async () => {
    const h = fakePort()
    bindExperience(h.port, defineExperience({onButton() {}}))
    h.streams.get(MiniappStreamType.BUTTON_PRESS)?.({buttonId: "main", pressType: "long"})
    await flush()
    expect(h.sent).toContainEqual({type: MiniappRequestType.AIOS_CODE_LOCAL_EVENT, event: {type: "button", data: {source: "temple", button_id: "main", action: "long_press"}}})
  })
})

describe("perception streams", () => {
  const streamPort = () => {
    const opened: unknown[] = [], stopped: string[] = []
    const handlers = new Map<string, (chunk: unknown) => void>()
    const port = {
      ...fakePort().port,
      perception: {
        stream: async (request: unknown, handler: (chunk: never) => void) => {
          const id = `str_${opened.length}`
          opened.push(request); handlers.set(id, handler as (chunk: unknown) => void)
          return {id, stop: async () => {stopped.push(id); handlers.delete(id)}}
        },
        sub: async () => ({status: {}}), pause: async () => ({}), resume: async () => ({}), unsubscribe: async () => {}, list: async () => [],
      },
    } as ExperienceHostPort
    return {port, opened, stopped, handlers}
  }
  const sessionWith = (port: ExperienceHostPort, capabilities: string[]) =>
    createPhoneSession(port, () => ({...info, capabilities})) as ReturnType<typeof createPhoneSession> & {_stopFrames(): Promise<void>}

  test("frames snap fps down to 1/2/7/15 and allow 720p", async () => {
    const h = streamPort()
    const s = sessionWith(h.port, ["perception.frames"])
    for (const fps of [1, 3, 7, 10, 15, 30]) await s.perception.frames({fps, max_side: 1280}, () => {})
    expect(h.opened.map(r => (r as {video: {fps: number}}).video.fps)).toEqual([1, 2, 7, 7, 15, 15])
    expect((h.opened[0] as {video: {max_resolution: string}}).video.max_resolution).toBe("720p")
    await expect(s.perception.frames({fps: 0}, () => {})).rejects.toMatchObject({code: "INVALID_ARGUMENT", details: {field: "fps"}})
    await expect(s.perception.frames({max_side: 2000}, () => {})).rejects.toMatchObject({code: "INVALID_ARGUMENT", details: {field: "max_side"}})
  })

  test("audio needs its capability, hands PCM chunks to the code and stops with the frames", async () => {
    const h = streamPort()
    await expect(sessionWith(h.port, ["perception.frames"]).perception.audio({}, () => {})).rejects.toMatchObject({code: "CAPABILITY_NOT_DECLARED"})
    const s = sessionWith(h.port, ["perception.frames", "perception.audio"])
    const got: unknown[] = []
    await s.perception.audio({chunk_ms: 100}, chunk => got.push(chunk))
    expect(h.opened).toEqual([{source: "audio", audio: {chunk_ms: 100}}])
    h.handlers.get("str_0")!({stream_id: "str_a", seq: 3, captured_at: 1234, data_base64: "AAAA"})
    expect(got).toEqual([{chunk_id: "str_a:3", pcm_base64: "AAAA", sample_rate_hz: 16000, format: "pcm_s16le", captured_at_ms: 1234}])
    await expect(s.perception.audio({chunk_ms: 50 as never}, () => {})).rejects.toMatchObject({code: "INVALID_ARGUMENT", details: {field: "chunk_ms"}})
    await s.perception.frames({fps: 7}, () => {})
    await s._stopFrames()
    expect(h.stopped.sort()).toEqual(["str_0", "str_1"])
  })
})

test('code frames preserve optional program refs; reporting requires frames capability',async()=>{
 const h=fakePort();let callback:any;h.port.perception={stream:async(_req,cb)=>{callback=cb;return{id:'stream',stop:async()=>{}}},sub:async()=>({status:{}}),pause:async()=>({}),resume:async()=>({}),unsubscribe:async()=>{},list:async()=>[]}
 const session=createPhoneSession(h.port,()=>({...info,capabilities:['perception.frames']}));let frame:any
 await session.perception.frames({},f=>{frame=f});callback({stream_id:'stream',seq:1,captured_at:100,width:1,height:1,data_base64:'x',reality:[{ref:'opaque',program_id:'p',retention_ms:30000,expires_at_ms:30100}]})
 expect(frame.reality).toEqual([{stream_id:'stream',ref:'opaque',program_id:'p',retention_ms:30000,expires_at_ms:30100}])
 await session.perception.reportProgram(frame.reality[0],'match');expect(h.sent.at(-1)).toEqual({type:MiniappRequestType.AIOS_PERCEPTION_PROGRAM_REPORT,stream_id:'stream',report:{ref:'opaque',state:'match'}})
 const denied=createPhoneSession(h.port,()=>({...info,capabilities:[]}));expect(()=>denied.perception.reportProgram(frame.reality[0],'match')).toThrow('not declared')
})

test("output.status forwards an exact output ref without inferring playback from admission",async()=>{
 const expected={output_ref:"utt_1",receipt:null,receipt_at:null,delivery:"phone_push",outcome:"played"}
 const h=fakePort(()=>expected),s=createPhoneSession(h.port,()=>({...info,capabilities:["output.speak"]}))
 expect(await s.output.status("utt_1")).toEqual(expected)
 expect(h.sent).toContainEqual({type:MiniappRequestType.AIOS_CODE_CALL,api:"output.status",args:{output_ref:"utt_1"}})
})
