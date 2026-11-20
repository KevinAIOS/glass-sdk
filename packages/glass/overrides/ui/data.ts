/** Optional local-data access in an ordinary MiniApp UI. All access is authorized by the Host. */
export type DataSchema = {
  type: "object" | "array" | "string" | "number" | "boolean" | "null"
  properties?: Record<string, DataSchema>
  required?: string[]
  items?: DataSchema
  maxItems?: number
  maxLength?: number
  additionalProperties?: false
}
export type DataNeed = {need: string; purpose: string; schema: DataSchema}
export type DataSource = {id: string; scopeId: string; title: string}
export type DataResult<T = unknown> = {
  requestId: string
  identity: {user: string; app: string; version: string; session: string}
  updatedAt: string
  data: T
  sources: DataSource[]
  warnings: string[]
}
export type SourceContent = {requestId: string; sourceId: string; text: string}
export type DataTask<T> = {id: string; result: Promise<T>; cancel(): void}

type Reply = {id: string; value?: unknown; error?: string}
const pending = new Map<
  string,
  {resolve(v: unknown): void; reject(e: Error): void; timer: ReturnType<typeof setTimeout>}
>()
let sequence = 0,
  installed = false
function bridge() {
  const w = window as unknown as {
    ReactNativeWebView?: {postMessage(s: string): void}
    __aiosDataReply?: (reply: Reply) => void
  }
  if (!w.ReactNativeWebView) throw new Error("host_unavailable")
  if (!installed) {
    w.__aiosDataReply = (reply) => {
      if (reply.id === "revoked") {
        for (const p of pending.values()) {
          clearTimeout(p.timer)
          p.reject(new Error("permission_revoked"))
        }
        pending.clear()
        window.dispatchEvent(new Event("aios:data-revoked"))
        return
      }
      const p = pending.get(reply.id)
      if (!p) return
      pending.delete(reply.id)
      clearTimeout(p.timer)
      if (reply.error) p.reject(new Error(reply.error))
      else p.resolve(reply.value)
    }
    installed = true
  }
  return (message: unknown) => w.ReactNativeWebView!.postMessage(JSON.stringify(message))
}
function task<T>(operation: string, payload: unknown): DataTask<T> {
  const id = `data_${Date.now()}_${++sequence}`
  let send: (message: unknown) => void
  const result = new Promise<T>((resolve, reject) => {
    try {
      send = bridge()
    } catch (e) {
      reject(e)
      return
    }
    const timer = setTimeout(() => {
      pending.delete(id)
      send({type: "aios-data-v1", id, operation: "cancel"})
      reject(new Error("data_timeout"))
    }, 120_000)
    pending.set(id, {resolve: (v) => resolve(v as T), reject, timer})
    send({type: "aios-data-v1", id, operation, payload})
  })
  return {
    id,
    result,
    cancel() {
      const p = pending.get(id)
      if (!p) return
      pending.delete(id)
      clearTimeout(p.timer)
      p.reject(new Error("cancelled"))
      send({type: "aios-data-v1", id, operation: "cancel"})
    },
  }
}
export function requestData<T = unknown>(need: DataNeed): DataTask<DataResult<T>> {
  return task("query", need)
}
export function readDataSource(requestId: string, sourceId: string): DataTask<SourceContent> {
  return task("source", {requestId, sourceId})
}
/** Revocation also clears this UI's pending requests; consumers must clear rendered data. */
export function revokeData(): void {
  bridge()({type: "aios-data-v1", id: "revoke", operation: "revoke"})
}
