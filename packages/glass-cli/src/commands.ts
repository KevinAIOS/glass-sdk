import {catalogCommand} from "./catalog"
import ts from "typescript"
import {cp, mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile, lstat} from "node:fs/promises"
import {createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign} from "node:crypto"
import {dirname, join, relative, resolve} from "node:path"
import {fileURLToPath} from "node:url"
import {defineApp, safeAppPath, toHostManifest} from "../../glass/overrides/manifest"
import {packageProofText, type PackageRelease} from "../../glass-contract/src/packages"

const distribution = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const digest = (data: Uint8Array) => createHash("sha256").update(data).digest("hex")
function run(args: string[], cwd?: string, stdin?: Uint8Array): string {
  const result = Bun.spawnSync(args, {cwd, stdin, stdout: "pipe", stderr: "pipe"})
  if (result.exitCode !== 0)
    throw new Error(`${args[0]} failed: ${result.stderr.toString().trim() || result.stdout.toString().trim()}`)
  return result.stdout.toString()
}
async function json(path: string) {
  return JSON.parse(await readFile(path, "utf8"))
}
async function writeJson(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n")
}
async function checkedFile(root: string, name: string) {
  if (!safeAppPath(name)) throw new Error("Invalid project path")
  const path = join(root, name)
  const real = await realpath(path)
  if (!real.startsWith((await realpath(root)) + "/") || !(await stat(real)).isFile())
    throw new Error("Entry escapes project")
  return path
}
async function files(root: string, prefix = ""): Promise<string[]> {
  const list: string[] = []
  for (const entry of await readdir(join(root, prefix), {withFileTypes: true})) {
    const name = prefix + entry.name
    if (!safeAppPath(name) || entry.isSymbolicLink()) throw new Error("Unsafe package path")
    if (entry.isDirectory()) list.push(...(await files(root, name + "/")))
    else if (entry.isFile()) list.push(name)
    else throw new Error("Unsupported package file")
  }
  return list.sort()
}
export async function create(project: string, id: string, template = "reference") {
  if (/m[e]ntra/i.test(id)) throw new Error("Choose an independent application identifier")
  defineApp({
    schema: 1,
    id,
    name: "AIOS Reference",
    version: "1.0.0",
    entry: {background: "background/index.js", ui: "ui/index.html"},
    capabilities: [],
    permissions: [],
  })
  if (!["reference", "compatibility", "contacts"].includes(template)) throw new Error("Unknown template")
  // mkdir is exclusive: never overwrite an existing project.
  await mkdir(project)
  try {
    await cp(join(distribution, "assets", template), project, {recursive: true, errorOnExist: false, force: false})
    await mkdir(join(project, ".toolchain"))
    await cp(join(distribution, "assets/glass.tgz"), join(project, ".toolchain/glass.tgz"))
    const manifest = await json(join(project, "aios.json"))
    manifest.id = id
    await writeJson(join(project, "aios.json"), defineApp(manifest))
    await writeJson(join(project, "tsconfig.json"), {
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        lib: ["ES2020", "DOM"],
      },
      include: ["src"],
    })
    await writeJson(join(project, "package.json"), {
      name: id,
      version: manifest.version,
      private: true,
      type: "module",
      dependencies: {"@aios/glass": "file:.toolchain/glass.tgz"},
    })
    console.log(
      `AIOS project created: ${project}\nRun bun install, then aios-glass build and aios-glass pack in the project.`,
    )
  } catch (error) {
    await rm(project, {recursive: true, force: true})
    throw error
  }
}
export async function build(project: string) {
  const manifest = defineApp(await json(join(project, "aios.json")))
  const sources = [await checkedFile(project, "src/background/index.ts")]
  if (manifest.entry.ui) sources.push(await checkedFile(project, "src/ui/index.ts"))
  const program = ts.createProgram(sources, {
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    types: [],
    lib: ["lib.es2020.d.ts", "lib.dom.d.ts"],
  })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  if (diagnostics.length)
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (path) => path,
        getCurrentDirectory: () => project,
        getNewLine: () => "\n",
      }),
    )
  const staging = join(project, `.aios-build-${process.pid}`)
  await mkdir(staging)
  try {
    const entries = [{source: "src/background/index.ts", output: manifest.entry.background}]
    if (manifest.entry.ui) entries.push({source: "src/ui/index.ts", output: "ui/index.js"})
    for (const entry of entries) {
      const source = await checkedFile(project, entry.source)
      const result = await Bun.build({
        entrypoints: [source],
        target: "browser",
        format: "iife",
        minify: true,
        sourcemap: "none",
      })
      if (!result.success) throw new Error(result.logs.map(String).join("\n"))
      if (result.outputs.length !== 1) throw new Error("Unexpected build assets")
      const content = await result.outputs[0].text()
      if (/m[e]ntra/i.test(content))
        throw new Error("Public bundle contains an upstream identity; migrate the application source")
      await mkdir(dirname(join(staging, entry.output)), {recursive: true})
      await writeFile(join(staging, entry.output), content)
    }
    if (manifest.entry.ui) {
      if (manifest.entry.ui !== "ui/index.html") throw new Error("UI entry must be ui/index.html")
      await cp(await checkedFile(project, "src/ui/index.html"), join(staging, "ui/index.html"))
    }
    await writeJson(join(staging, "aios.json"), manifest)
    await writeJson(join(staging, "miniapp.json"), toHostManifest(manifest))
    await writeJson(join(staging, "aios-build.json"), {
      schema: 1,
      sdk: `@aios/glass@${JSON.parse(await readFile(join(project, "node_modules/@aios/glass/package.json"), "utf8")).version}`,
      id: manifest.id,
      version: manifest.version,
    })
    for (const file of await files(staging))
      if (/m[e]ntra/i.test(await readFile(join(staging, file), "utf8")))
        throw new Error("Public package contains an upstream identity")
    const output = join(project, "dist")
    // dist is dedicated generated output, but do not follow symlinks into other projects.
    const existing = await lstat(output).catch(() => null)
    if (existing?.isSymbolicLink()) throw new Error("dist must not be a symlink")
    await rm(output, {recursive: true, force: true})
    await rename(staging, output)
    console.log(`AIOS build complete: ${manifest.id}@${manifest.version}`)
  } finally {
    await rm(staging, {recursive: true, force: true})
  }
}
export async function keygen(path: string): Promise<void> {
  const pair = generateKeyPairSync("ed25519")
  await writeFile(path, pair.privateKey.export({format: "pem", type: "pkcs8"}), {flag: "wx", mode: 0o600})
  console.log(`AIOS signing key created: ${path}. Keep this private file outside application output.`)
}
export async function pack(project: string, keyPath?: string): Promise<string> {
  const manifest = defineApp(await json(join(project, "aios.json")))
  const dist = join(project, "dist")
  if ((await lstat(dist)).isSymbolicLink()) throw new Error("dist must not be a symlink")
  if (JSON.stringify(defineApp(await json(join(dist, "aios.json")))) !== JSON.stringify(manifest))
    throw new Error("Manifest changed; rebuild first")
  if (JSON.stringify(await json(join(dist, "miniapp.json"))) !== JSON.stringify(toHostManifest(manifest)))
    throw new Error("Host manifest mismatch; rebuild first")
  const list = await files(dist)
  if (list.includes("aios-package.json")) throw new Error("Rebuild before signing; package proof is generated by pack")
  for (const entry of [manifest.entry.background, manifest.entry.ui])
    if (entry && !list.includes(entry)) throw new Error("Missing application entry")
  let size = 0
  for (const name of list) {
    size += (await stat(join(dist, name))).size
    if (size > 128 * 1024 * 1024) throw new Error("Package exceeds 128 MB unpacked limit")
    const data = await readFile(join(dist, name))
    if (/m[e]ntra/i.test(data.toString())) throw new Error("Public package contains an upstream identity")
  }
  if (size > 128 * 1024 * 1024) throw new Error("Package exceeds 128 MB unpacked limit")
  const destination = join(project, "packages")
  await mkdir(destination, {recursive: true})
  if ((await lstat(destination)).isSymbolicLink()) throw new Error("packages must not be a symlink")
  const path = join(destination, `${manifest.id}-${manifest.version}.zip`)
  const temp = join(destination, `.packing-${process.pid}.zip`)
  const staging = join(destination, `.signing-${process.pid}`)
  try {
    await rm(temp, {force: true})
    await mkdir(staging)
    for (const name of list) {
      await mkdir(dirname(join(staging, name)), {recursive: true})
      await cp(join(dist, name), join(staging, name))
    }
    let signer: string | undefined
    if (keyPath) {
      const keyFile = await realpath(keyPath)
      if (keyFile.startsWith((await realpath(dist)) + "/")) throw new Error("Signing key must be outside app output")
      const key = createPrivateKey(await readFile(keyFile))
      if (key.asymmetricKeyType !== "ed25519") throw new Error("Signing requires an Ed25519 private key")
      signer = createPublicKey(key).export({format: "der", type: "spki"}).subarray(-32).toString("hex")
      const hashes: Record<string, string> = {}
      for (const name of list) hashes[name] = digest(await readFile(join(staging, name)))
      const proof = {
        schema: 1 as const,
        packageName: manifest.id,
        version: manifest.version,
        files: hashes,
        publicKey: signer,
      }
      await writeJson(join(staging, "aios-package.json"), {
        ...proof,
        signature: sign(null, Buffer.from(packageProofText(proof)), key).toString("hex"),
      })
      list.push("aios-package.json")
    }
    run(["zip", "-X", "-q", temp, "--", ...list], staging)
    if ((await stat(temp)).size > 64 * 1024 * 1024) throw new Error("Package exceeds 64 MB archive limit")
    const release = signer
      ? ({
          schema: 1 as const,
          packageName: manifest.id,
          version: manifest.version,
          digest: digest(await readFile(temp)),
          signer,
        } satisfies PackageRelease)
      : null
    await rename(temp, path)
    if (release) await writeJson(path + ".release.json", release)
    else await rm(path + ".release.json", {force: true})
  } finally {
    await rm(temp, {force: true})
    await rm(staging, {recursive: true, force: true})
  }
  console.log(`AIOS package: ${path}`)
  return path
}
export function chooseDevice(output: string, requested?: string): string {
  const devices = output
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts[1] === "device")
  if (requested) {
    if (!devices.some(([id]) => id === requested))
      throw new Error("Selected Android device is not authorized and online")
    return requested
  }
  if (devices.length !== 1) throw new Error("Connect one Android phone/emulator or pass --device SERIAL")
  return devices[0][0]
}
export async function sideload(archive: string, requested?: string, waitSeconds = 120) {
  if ((await stat(archive)).size > 64 * 1024 * 1024) throw new Error("Package exceeds 64 MB archive limit")
  const data = await readFile(archive)
  if (data.length > 64 * 1024 * 1024 || data[0] !== 80 || data[1] !== 75) throw new Error("Invalid application archive")
  const token = digest(data)
  const adb = process.env.AIOS_ADB ?? "adb"
  const device = chooseDevice(run([adb, "devices"]), requested)
  const command = (...args: string[]) => [adb, "-s", device, ...args]
  // Only debuggable AIOS Hosts accept run-as. No root, shared-storage grants or cloud upload.
  run(command("shell", "run-as local.aios.glass mkdir -p files/aios-inbox"))
  run(command("shell", `run-as local.aios.glass rm -f files/aios-inbox/${token}.json`))
  run(command("shell", "-T", `run-as local.aios.glass sh -c 'cat > files/aios-inbox/${token}.zip'`), undefined, data)
  run(
    command(
      "shell",
      "am",
      "start",
      "-W",
      "-a",
      "android.intent.action.VIEW",
      "-d",
      `aios://sideload/${token}`,
      "local.aios.glass",
    ),
  )
  console.log(`AIOS package delivered to ${device}. Confirm installation in AIOS; the app will then start locally.`)
  const deadline = Date.now() + waitSeconds * 1000
  while (Date.now() < deadline) {
    let receipt: {schema?: number; token?: string; state?: string; packageName?: string; error?: string} | undefined
    try {
      receipt = JSON.parse(run(command("exec-out", `run-as local.aios.glass cat files/aios-inbox/${token}.json`)))
    } catch {}
    if (receipt?.schema === 1 && receipt.token === token) {
      if (receipt.state === "started") {
        console.log(`AIOS application started: ${receipt.packageName}`)
        return receipt
      }
      if (receipt.state === "error" || receipt.state === "rejected")
        throw new Error(`Sideload ${receipt.state}: ${receipt.error ?? "cancelled in Host"}`)
    }
    await Bun.sleep(1000)
  }
  throw new Error("Timed out waiting for Host approval/start. Delivery alone does not mean installed.")
}
export async function main(args: string[]) {
  const [command, ...rest] = args
  if (["account", "catalog", "publish"].includes(command)) return catalogCommand(args)
  if (!command || command === "--help") {
    console.log(
      "aios-glass create DIR --id local.aios.myapp [--template reference|compatibility|contacts]\naios-glass build\naios-glass keygen FILE.pem\naios-glass pack [--key FILE.pem]\naios-glass sideload FILE.zip [--device SERIAL] [--wait SECONDS]\naios-glass account register|login --server URL --username NAME (password: AIOS_GLASS_PASSWORD)\naios-glass account logout\naios-glass publish FILE.zip [--project DIR]\naios-glass catalog\nSigned packs include an immutable .release.json for catalog delivery. Keep private keys private.\nRequires Bun; Android sideload requires adb and a debuggable AIOS Host.",
    )
    return
  }
  const allowed: Record<string, string[]> = {
    create: ["--id", "--template"],
    build: [],
    pack: ["--key"],
    keygen: [],
    sideload: ["--device", "--wait"],
  }
  if (!(command in allowed)) throw new Error(`Unknown command: ${command}`)
  const positional = ["create", "sideload", "keygen"].includes(command) ? 1 : 0
  const seen = new Set<string>()
  for (let i = positional; i < rest.length; i += 2) {
    const flag = rest[i]
    if (!allowed[command].includes(flag) || seen.has(flag) || !rest[i + 1] || rest[i + 1].startsWith("--"))
      throw new Error(`Invalid option: ${flag}`)
    seen.add(flag)
  }
  const option = (name: string) => {
    const i = rest.indexOf(name)
    return i < 0 ? undefined : rest[i + 1]
  }
  if (command === "create") {
    if (!rest[0] || !option("--id")) throw new Error("create requires DIR and --id")
    await create(resolve(rest[0]), option("--id")!, option("--template"))
  } else if (command === "build") await build(process.cwd())
  else if (command === "pack") await pack(process.cwd(), option("--key"))
  else if (command === "keygen") {
    if (!rest[0]) throw new Error("keygen requires a private key file path")
    await keygen(resolve(rest[0]))
  } else if (command === "sideload") {
    if (!rest[0]) throw new Error("sideload requires an archive")
    const seconds = Number(option("--wait") ?? 120)
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 600) throw new Error("--wait must be 1–600 seconds")
    await sideload(resolve(rest[0]), option("--device"), seconds)
  } else throw new Error(`Unknown command: ${command}`)
}
