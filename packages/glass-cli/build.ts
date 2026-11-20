import {cp, mkdir, rename, readFile} from "node:fs/promises"
import {dirname, resolve, join} from "node:path"
import {fileURLToPath} from "node:url"
// sdk-v1 extraction: the three glass-contract files the CLI imports are vendored read-only under
// ../../build-inputs/glass-contract-src (byte-identical to the step-1 freeze at the same commit).
import {BLOCKED_SERVICE_DOMAINS} from "../../build-inputs/glass-contract-src/network-policy"
const here = dirname(fileURLToPath(import.meta.url))
// sdk-v1 extraction root (contains packages/, examples/, build-inputs/, LICENSE).
const root = resolve(here, "../..")
const contractSrc = join(root, "build-inputs/glass-contract-src")
await mkdir(join(here, "dist"), {recursive: true})
// sdk-v1 extraction: typescript (bundled dependency) comes from `bun install` into ./node_modules
// instead of being copied from the monorepo's mobile/node_modules.
const sdkBuild = Bun.spawnSync([process.execPath, join(here, "../glass/build.ts")], {
  stdout: "inherit",
  stderr: "inherit",
})
if (sdkBuild.exitCode) process.exit(sdkBuild.exitCode)
// npm pack includes the SDK's bundled runtime dependency; create does not need a registry.
const pack = Bun.spawnSync(["npm", "pack", "--ignore-scripts", "--json", "--pack-destination", join(here, "assets")], {
  cwd: join(here, "../glass"),
  stdout: "pipe",
  stderr: "pipe",
})
if (pack.exitCode) throw new Error(pack.stderr.toString())
await rename(join(here, "assets", JSON.parse(pack.stdout.toString())[0].filename), join(here, "assets/glass.tgz"))
// The data demo is an ordinary MiniApp template with the same SDK and package format.
await mkdir(join(here, "assets/contacts"), {recursive: true})
await cp(join(root, "examples/contacts/aios.json"), join(here, "assets/contacts/aios.json"))
await cp(join(root, "examples/contacts/src"), join(here, "assets/contacts/src"), {recursive: true})
const result = await Bun.build({
  entrypoints: [join(here, "src/cli.ts")],
  outdir: join(here, "dist"),
  target: "bun",
  format: "esm",
  minify: true,
  external: ["typescript"],
  plugins: [
    {
      // CLI sources keep their frozen import specifiers (../../glass-contract/src/<file>);
      // resolve them to the vendored build inputs instead of a sibling glass-contract package.
      name: "sdk-v1-glass-contract-build-inputs",
      setup(builder) {
        builder.onResolve({filter: /glass-contract\/src\/(catalog-client|packages|network-policy)$/}, (args) => ({
          path: join(contractSrc, args.path.split("/").pop()! + ".ts"),
        }))
      },
    },
  ],
})
if (!result.success) throw new Error(result.logs.map(String).join("\n"))
await cp(join(root, "LICENSE"), join(here, "LICENSE"))
// The shared network policy deliberately names forbidden upstream hosts. Keep
// that exact denylist in the bundle; it is not a product identity or dependency.
const cliBundle = await readFile(join(here, "dist/cli.js"), "utf8")
const withoutDenylist = cliBundle.replace(JSON.stringify(BLOCKED_SERVICE_DOMAINS), "[]")
if (/mentra/i.test(withoutDenylist)) throw new Error("CLI contains upstream identity outside the service denylist")
console.log("AIOS CLI distribution built")
