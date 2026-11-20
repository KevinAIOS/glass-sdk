import {Buffer} from "buffer"
import {packageRelease, type PackageRelease} from "./packages"
import {isBlockedServiceHost} from "./network-policy"

export type AccountSession = {user: {id: string; username: string}; token: string; expiresAt: number}
export type CatalogEntry = {
  name: string
  description: string
  publisher: string
  release: PackageRelease
  downloadPath: string
  actions: Array<{id: string; description: string}>
}
/** Cleartext is reserved for an explicit local development tunnel. Credentials never follow redirects. */
export function serviceAddress(input: string): string {
  const u = new URL(input)
  if (
    isBlockedServiceHost(u.hostname) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/" ||
    (u.protocol !== "https:" && !(u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)))
  )
    throw new Error("invalid_service_address")
  return u.origin
}
export class CatalogClient {
  readonly address: string
  constructor(address: string, private transport: typeof fetch = fetch) {
    this.address = serviceAddress(address)
  }
  private async call<T>(
    path: string,
    init: RequestInit,
    token: string | undefined,
    consume: (r: Response) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 30_000)
    try {
      const r = await this.transport(this.address + path, {
        ...init,
        redirect: "error",
        signal: controller.signal,
        headers: {...init.headers, ...(token ? {Authorization: `Bearer ${token}`} : {})},
      })
      if (r.redirected || (r.url && new URL(r.url).origin !== this.address)) throw new Error("redirect_rejected")
      if (!r.ok) {
        const b = await boundedBody(r, 16_384)
          .then(bytes => JSON.parse(Buffer.from(bytes).toString("utf8")) as {error?: unknown})
          .catch(() => null)
        throw new Error(
          typeof b?.error === "string" && /^[a-z_]{1,80}$/.test(b.error) ? b.error : "catalog_request_failed",
        )
      }
      return await consume(r)
    } finally {
      clearTimeout(timer)
    }
  }
  private async json(path: string, body?: unknown, token?: string) {
    return this.call(
      path,
      body === undefined
        ? {}
        : {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)},
      token,
      async (r) => {
        const bytes = await boundedBody(r, 2_000_000)
        return JSON.parse(Buffer.from(bytes).toString("utf8"))
      },
    )
  }
  async authenticate(mode: "register" | "login", username: string, password: string): Promise<AccountSession> {
    const s = (await this.json(`/v1/${mode}`, {username, password})) as AccountSession
    if (
      typeof s?.user?.id !== "string" || s.user.id.length < 1 || s.user.id.length > 128 ||
      typeof s.user.username !== "string" ||
      !/^[a-f0-9]{64}$/.test(s.token) ||
      !Number.isFinite(s.expiresAt)
    )
      throw new Error("invalid_session")
    return s
  }
  async logout(token: string) {
    await this.json("/v1/logout", {}, token)
  }
  async createApp(token: string, id: string, name: string, description: string) {
    await this.json("/v1/apps", {id, name, description}, token)
  }
  async publish(token: string, id: string, archive: Uint8Array): Promise<PackageRelease> {
    if (!/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){2,}$/.test(id) || archive.length > 64 * 1024 * 1024)
      throw new Error("invalid_release")
    return packageRelease(
      await this.call(
        `/v1/apps/${id}/releases`,
        {method: "POST", body: archive as BodyInit, headers: {"Content-Type": "application/zip"}},
        token,
        (r) => r.json(),
      ),
    )
  }
  async catalog(): Promise<CatalogEntry[]> {
    const b = (await this.json("/v1/catalog")) as {schema: number; entries: CatalogEntry[]}
    if (b?.schema !== 1 || !Array.isArray(b.entries) || b.entries.length > 10000) throw new Error("invalid_catalog")
    return b.entries.map((e) => {
      const release = packageRelease(e.release)
      if (
        typeof e.name !== "string" ||
        typeof e.description !== "string" ||
        typeof e.publisher !== "string" ||
        e.downloadPath !== `/v1/packages/${release.digest}`
      )
        throw new Error("invalid_catalog")
      return {...e, release}
    })
  }
  async download(release: PackageRelease): Promise<Uint8Array> {
    return this.call(`/v1/packages/${packageRelease(release).digest}`, {}, undefined, (r) =>
      boundedBody(r, 64 * 1024 * 1024),
    )
    // The installer verifies SHA-256, signer, manifest and all file hashes before activating.
  }
}

/** Bound streamed responses before allocation; RN's non-streaming implementation is checked on receipt. */
export async function boundedBody(response: Pick<Response, "headers" | "body" | "arrayBuffer">, limit: number): Promise<Uint8Array> {
  if (Number(response.headers.get("content-length")) > limit) throw new Error("response_too_large")
  const reader = response.body?.getReader?.()
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.length > limit) throw new Error("response_too_large")
    return bytes
  }
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const {done, value} = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) throw new Error("response_too_large")
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let at = 0
  for (const chunk of chunks) {
    bytes.set(chunk, at)
    at += chunk.length
  }
  return bytes
}
