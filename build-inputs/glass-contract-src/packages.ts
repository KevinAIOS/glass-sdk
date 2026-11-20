/** One immutable release identity for local tooling, catalogs and the phone installer. */
export type PackageRelease = {
  schema: 1
  packageName: string
  version: string
  digest: string
  signer: string
}
export type PackageSource = {kind: "local"} | {kind: "catalog"; release: PackageRelease}
export type PackageProof = {
  schema: 1
  packageName: string
  version: string
  files: Record<string, string>
  publicKey: string
  signature: string
}
export function packageProofText(p: Omit<PackageProof, "signature">): string {
  return JSON.stringify({
    schema: 1,
    packageName: p.packageName,
    version: p.version,
    files: Object.fromEntries(Object.entries(p.files).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
    publicKey: p.publicKey,
  })
}
export function packageRelease(value: unknown): PackageRelease {
  const p = value as Partial<PackageRelease> | null
  if (
    !p ||
    typeof p !== "object" ||
    Array.isArray(p) ||
    p.schema !== 1 ||
    typeof p.packageName !== "string" ||
    !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){2,}$/.test(p.packageName) ||
    typeof p.version !== "string" ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(p.version) ||
    typeof p.digest !== "string" ||
    !/^[a-f0-9]{64}$/.test(p.digest) ||
    typeof p.signer !== "string" ||
    !/^[a-f0-9]{64}$/.test(p.signer) ||
    Object.keys(p).some((k) => !["schema", "packageName", "version", "digest", "signer"].includes(k))
  )
    throw new Error("invalid_release")
  return {...p} as PackageRelease
}
/** A catalog descriptor must come from the caller's trusted catalog, never from the downloaded ZIP. */
export function verifyPackageSource(
  source: PackageSource,
  actual: Omit<PackageRelease, "schema" | "signer"> & {signer: string | null},
): void {
  if (source.kind === "local") return
  if (source.kind !== "catalog") throw new Error("invalid_release")
  const expected = packageRelease(source.release)
  if (!actual.signer) throw new Error("signature_required")
  if (actual.signer !== expected.signer) throw new Error("publisher_changed")
  if (actual.packageName !== expected.packageName || actual.version !== expected.version)
    throw new Error("release_mismatch")
  if (actual.digest !== expected.digest) throw new Error("digest_mismatch")
}
