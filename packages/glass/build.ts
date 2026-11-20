import {cp, mkdir, readFile, readdir, rm, writeFile} from "node:fs/promises"
import {createHash} from "node:crypto"
import {dirname, join, relative, resolve} from "node:path"
import {fileURLToPath} from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
// sdk-v1 extraction: upstream inputs are vendored under ./upstream (same relative layout as the
// frozen repo root at d5a93a371b3d825b87771ab517c435551948a547), so provenance keys are unchanged.
const root = resolve(here, "upstream")
const source = join(root, "mobile/modules/miniapp/src")
const sha = (text: string) => createHash("sha256").update(text).digest("hex")
const rename = (text: string) =>
  text
    .replaceAll("@mentra/cloud-protocol/languages", "../internal/languages")
    .replaceAll("@mentra/miniapp", "@aios/glass")
    .replaceAll("Mentra-hosted", "Host-configured")
    .replaceAll("Mentra hosts the stream", "a configured Host relay serves the stream")
    .replaceAll("Mapbox Navigation SDK", "configured navigation provider")
    .replaceAll("Mapbox Search Box today", "configured search provider")
    .replaceAll("Mapbox today", "configured provider")
    .replaceAll("Mapbox", "configured provider")
    .replaceAll("v2 cloud maps service", "Host maps service")
    .replaceAll("mentraUserId", "userId")
    .replaceAll("MentraOS", "AIOSGlass")
    .replaceAll("Mentra", "Aios")
    .replaceAll("MENTRA", "AIOS")
    .replaceAll("mentra", "aios")
const files: Record<string, {sha256: string; output: string}> = {}
async function walk(dir: string): Promise<string[]> {
  const result: string[] = []
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) result.push(...(await walk(path)))
    else if (/\.tsx?$/.test(entry.name)) result.push(path)
  }
  return result.sort()
}
await rm(join(here, "src"), {recursive: true, force: true})
await rm(join(here, "dist"), {recursive: true, force: true})
for (const path of await walk(source)) {
  const content = await readFile(path, "utf8")
  const output = join("src", rename(relative(source, path)))
  files[relative(root, path)] = {sha256: sha(content), output}
  await mkdir(dirname(join(here, output)), {recursive: true})
  const note = ["modules/navigation.ts", "modules/stream.ts"].includes(relative(source, path))
    ? "/** Requires a separately configured Host provider. The independent Host may reject service-backed operations with SERVICE_NOT_CONFIGURED. Importing this SDK does not enable a cloud service. */\n"
    : ""
  await writeFile(join(here, output), note + rename(content))
}
const languagePath = "cloud-v2/packages/protocol/src/languages.ts"
const languages = await readFile(join(root, languagePath), "utf8")
await mkdir(join(here, "src/internal"), {recursive: true})
await writeFile(join(here, "src/internal/languages.ts"), rename(languages))
files[languagePath] = {sha256: sha(languages), output: "src/internal/languages.ts"}
for (const path of await walk(join(here, "overrides"))) {
  const output = join(here, "src", relative(join(here, "overrides"), path))
  await mkdir(dirname(output), {recursive: true})
  await cp(path, output)
}
for (const [path, content] of Object.entries({
  "src/ui/index.ts": '\nexport * from "./data"\n',
  "src/index.ts":
    '\nexport * from "./manifest"\nexport {MiniappSession as GlassSession} from "./session"\nexport {registerMiniapp as registerApp} from "./background/register"\n',
  "src/background/index.ts":
    '\nexport {MiniappSession as GlassSession} from "../session"\nexport {registerMiniapp as registerApp} from "./register"\n',
}))
  await writeFile(join(here, path), (await readFile(join(here, path), "utf8")) + content)
// sdk-v1 extraction: eventemitter3 (the only runtime dependency) comes from `bun install`
// into ./node_modules instead of being copied from the monorepo's mobile/node_modules.
await cp(join(root, "LICENSE"), join(here, "LICENSE"))
await writeFile(
  join(here, "NOTICE"),
  "Copyright 2026 Kevin AIOS (陈子恒).\nDerived from MentraOS, Copyright Mentra Labs and contributors. Apache-2.0.\nAIOS modifications: public names, explicit transports, application manifest.\nOriginal sources, hashes and transformations are recorded in provenance.json.\n\"Mentra\" and \"MentraOS\" are trademarks of their owner. This package is not affiliated with or endorsed by Mentra; no trademark rights are granted.\n",
)
await writeFile(
  join(here, "provenance.json"),
  JSON.stringify(
    {
      upstream: "https://github.com/Mentra-Community/MentraOS",
      baseline: "5ae6d6bf777ef7343c4c7d16d6145404d619e2de",
      transformations:
        "Public AIOS names; same miniapp wire protocol; explicit transport selection; local language registry; overrides/",
      files,
    },
    null,
    2,
  ) + "\n",
)
await writeFile(
  join(here, "tsconfig.build.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        moduleResolution: "bundler",
        lib: ["ES2020", "DOM"],
        jsx: "react-jsx",
        declaration: true,
        noEmitOnError: true,
        outDir: "dist",
        rootDir: "src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        types: [],
        baseUrl: ".",
        paths: {
          "react": ["node_modules/@types/react"],
          "react/*": ["node_modules/@types/react/*"],
        },
      },
      include: ["src"],
      exclude: ["src/**/*.test.ts", "src/**/__tests__/**"],
    },
    null,
    2,
  ),
)
const build = Bun.spawnSync([join(here, "node_modules/.bin/tsc"), "-p", join(here, "tsconfig.build.json")], {
  stdout: "inherit",
  stderr: "inherit",
})
if (build.exitCode !== 0) process.exit(build.exitCode)
console.log(`AIOS SDK built from ${Object.keys(files).length} tracked source files`)
