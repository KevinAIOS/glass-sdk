/// <reference types="bun-types" />

import {describe, expect, test} from "bun:test"

import {MiniappErrorCode, MiniappRequestType, MiniappStreamType} from "../protocol"
import type {MiniappSession} from "../session"
import {PerceptionModule, all, not, semantic, signal, when, type PerceptionEvent} from "./perception"

function mockSession(reply: (payload: {type: string} & Record<string, unknown>) => unknown) {
  const requests: Array<Record<string, unknown>> = []
  const oneShots: Array<Record<string, unknown>> = []
  const subscribed = new Map<string, Set<(data: unknown) => void>>()
  const session = {
    _hasManifestPermission: (key: string) => key === "CAMERA",
    sendOneShot: (payload: Record<string, unknown>) => {oneShots.push(payload)},
    sendRequest: (payload: {type: string} & Record<string, unknown>) => {
      requests.push(payload)
      try {return Promise.resolve(reply(payload))} catch (error) {return Promise.reject(error)}
    },
    _subscribe: (stream: string, handler: (data: unknown) => void) => {
      const set = subscribed.get(stream) ?? new Set()
      set.add(handler); subscribed.set(stream, set)
      return () => {set.delete(handler); if (!set.size) subscribed.delete(stream)}
    },
  } as unknown as MiniappSession
  const emit = (stream: string, data: unknown) => {for (const h of subscribed.get(stream) ?? []) h(data)}
  return {session, requests, oneShots, subscribed, emit}
}

describe("PerceptionModule", () => {
  test("stream() opens with schema_version, subscribes to its own chunk feed and stops cleanly", async () => {
    const opened = {schema_version: "v1alpha", stream_id: "str_1", source: "video", video: {fps: 2, max_resolution: "540p", keep_latest: 1}, adjustments: []}
    const m = mockSession(payload => (payload.type === MiniappRequestType.AIOS_PERCEPTION_STREAM_START ? opened : undefined))
    const perception = new PerceptionModule(m.session)
    expect(perception.hasCameraPermission).toBe(true); expect(perception.hasMicrophonePermission).toBe(false)
    const chunks: unknown[] = []
    const handle = await perception.stream({source: "video", video: {fps: 2}}, chunk => chunks.push(chunk))
    expect(m.requests[0]).toEqual({type: MiniappRequestType.AIOS_PERCEPTION_STREAM_START, request: {schema_version: "v1alpha", source: "video", video: {fps: 2}}})
    expect(handle.opened).toBe(opened as never)
    expect([...m.subscribed.keys()]).toEqual([`${MiniappStreamType.PERCEPTION_CHUNK}:str_1`])
    m.emit(`${MiniappStreamType.PERCEPTION_CHUNK}:str_1`, {seq: 1}); m.emit(`${MiniappStreamType.PERCEPTION_CHUNK}:str_other`, {seq: 9})
    expect(chunks).toEqual([{seq: 1}])
    await handle.stop(); await handle.stop()
    expect(m.requests.at(-1)).toEqual({type: MiniappRequestType.AIOS_PERCEPTION_STREAM_STOP, stream_id: "str_1"})
    expect(m.requests).toHaveLength(2)
    expect(m.subscribed.size).toBe(0)
  })

  test("sub() accepts builders and raw subscriptions, routes events by id and controls the subscription", async () => {
    const statuses = new Map<string, unknown>()
    const m = mockSession(payload => {
      if (payload.type === MiniappRequestType.AIOS_PERCEPTION_SUBSCRIBE) {
        const sub = payload.subscription as {id: string; when: {kind: string}}
        const status = {subscription_id: sub.id, origin: "runtime", written_by: "developer", kind: sub.when.kind, state: "active", created_at: 1}
        statuses.set(sub.id, status); return status
      }
      if (payload.type === MiniappRequestType.AIOS_PERCEPTION_PAUSE) return {...(statuses.get((payload.request as {subscription_id: string}).subscription_id) as object), state: "paused", paused_until: 99}
      if (payload.type === MiniappRequestType.AIOS_PERCEPTION_RESUME) return statuses.get((payload.request as {subscription_id: string}).subscription_id)
      if (payload.type === MiniappRequestType.AIOS_PERCEPTION_LIST) return [...statuses.values()]
      return undefined
    })
    const perception = new PerceptionModule(m.session)
    const seen: string[] = []
    const shop = await perception.sub("enter-supermarket", signal("place.category", "eq", "shopping.supermarket"), e => seen.push(`shop:${e.event_id}`))
    const talk = await perception.sub("long-talk", when(all(signal("calendar.in_meeting", "is", true), signal("audio.user_speaking", "is", true, {for_ms: 120000})), "leave"))
    const shampoo = await perception.sub({id: "shampoo", when: semantic("用户拿起了一瓶海飞丝")}, e => seen.push(`shampoo:${e.description}`))
    expect(m.requests[0]).toEqual({type: MiniappRequestType.AIOS_PERCEPTION_SUBSCRIBE, subscription: {schema_version: "v1alpha", id: "enter-supermarket", when: {kind: "signal", expr: {signal: "place.category", op: "eq", value: "shopping.supermarket"}}}})
    expect((m.requests[1].subscription as {when: unknown}).when).toEqual({kind: "signal", fire: "leave", expr: {all: [{signal: "calendar.in_meeting", op: "is", value: true}, {signal: "audio.user_speaking", op: "is", value: true, for_ms: 120000}]}})
    expect(shampoo.status.kind).toBe("semantic")
    expect(not(signal("place.saved", "eq", "home"))).toEqual({not: {signal: "place.saved", op: "eq", value: "home"}})
    // One wire feed for every subscription handler.
    expect([...m.subscribed.keys()]).toEqual([MiniappStreamType.PERCEPTION_EVENT])
    const every: PerceptionEvent[] = []
    const off = perception.onEvent(e => every.push(e))
    m.emit(MiniappStreamType.PERCEPTION_EVENT, {event_id: "e1", subscription_id: "enter-supermarket", kind: "signal"})
    m.emit(MiniappStreamType.PERCEPTION_EVENT, {event_id: "e2", subscription_id: "shampoo", kind: "semantic", description: "拿起了海飞丝", confidence: 0.9})
    m.emit(MiniappStreamType.PERCEPTION_EVENT, {event_id: "e3", subscription_id: "long-talk", kind: "signal"})
    expect(seen).toEqual(["shop:e1", "shampoo:拿起了海飞丝"])
    expect(every.map(e => e.event_id)).toEqual(["e1", "e2", "e3"])
    off()
    expect(await shop.pause(600000)).toMatchObject({state: "paused", paused_until: 99})
    expect(m.requests.at(-1)).toEqual({type: MiniappRequestType.AIOS_PERCEPTION_PAUSE, request: {schema_version: "v1alpha", subscription_id: "enter-supermarket", for_ms: 600000}})
    expect(await shop.resume()).toMatchObject({state: "active"})
    const states: string[] = []
    const offState = perception.onStateChange(c => states.push(c.to))
    expect(m.subscribed.has(MiniappStreamType.PERCEPTION_STATE)).toBe(true)
    m.emit(MiniappStreamType.PERCEPTION_STATE, {subscription_id: "enter-supermarket", from: "active", to: "paused", at: 1})
    expect(states).toEqual(["paused"])
    offState()
    expect(m.subscribed.has(MiniappStreamType.PERCEPTION_STATE)).toBe(false)
    await shampoo.unsubscribe()
    expect(m.requests.at(-1)).toEqual({type: MiniappRequestType.AIOS_PERCEPTION_UNSUBSCRIBE, request: {schema_version: "v1alpha", subscription_id: "shampoo"}})
    m.emit(MiniappStreamType.PERCEPTION_EVENT, {event_id: "e4", subscription_id: "shampoo", kind: "semantic", description: "x", confidence: 1})
    expect(seen).toHaveLength(2)
    expect((await perception.list()).map(s => (s as {subscription_id: string}).subscription_id)).toEqual(["enter-supermarket", "long-talk", "shampoo"])
    talk.detach(); shop.detach()
    expect(m.subscribed.size).toBe(0)
  })

  test("read() and isSupported() map onto the wire; stop() closes streams with one-shots", async () => {
    let supported = false
    const m = mockSession(payload => {
      if (payload.type === MiniappRequestType.AIOS_PERCEPTION_LIST) {if (!supported) throw {code: MiniappErrorCode.NOT_IMPLEMENTED, message: "no"}; return []}
      if (payload.type === MiniappRequestType.AIOS_PERCEPTION_READ_SIGNAL) return {schema_version: "v1alpha", signal: payload.signal, available: true, value: 8.5, as_of: 1}
      if (payload.type === MiniappRequestType.AIOS_PERCEPTION_STREAM_START) return {schema_version: "v1alpha", stream_id: "a1", source: "audio", audio: {sample_rate_hz: 16000, format: "pcm_s16le", chunk_ms: 40}, adjustments: []}
      return undefined
    })
    const perception = new PerceptionModule(m.session)
    expect(await perception.isSupported()).toBe(false)
    supported = true
    expect(await perception.isSupported()).toBe(true)
    expect(await perception.read("weather.temperature")).toMatchObject({signal: "weather.temperature", value: 8.5})
    await perception.stream({source: "audio", audio: {chunk_ms: 40}}, () => {})
    perception.stop()
    expect(m.oneShots).toEqual([{type: MiniappRequestType.AIOS_PERCEPTION_STREAM_STOP, stream_id: "a1"}])
    expect(m.subscribed.size).toBe(0)
  })
})

test('program report sends opaque references only through existing perception transport',async()=>{
 const m=mockSession(()=>({accepted:true}));const p=new PerceptionModule(m.session)
 await p.reportProgram({stream_id:'stream',ref:'opaque'},'match',['opaque'])
 expect(m.requests[0]).toEqual({type:MiniappRequestType.AIOS_PERCEPTION_PROGRAM_REPORT,stream_id:'stream',report:{ref:'opaque',state:'match',evidence_refs:['opaque']}})
})
