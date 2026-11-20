import {readFile, mkdir, writeFile, chmod, rename, rm} from "node:fs/promises"
import {homedir} from "node:os"
import {join, resolve} from "node:path"
import {CatalogClient, type AccountSession} from "../../glass-contract/src/catalog-client"
import {defineApp} from "../../glass/overrides/manifest"
const folder = () => process.env.AIOS_GLASS_CLI_HOME ?? join(homedir(), ".aios-glass")
const file = () => join(folder(), "catalog-session.json")
type Saved = {address: string; session: AccountSession}
async function save(value: Saved) {
  await mkdir(folder(), {recursive: true, mode: 0o700})
  const temp = file() + `.${process.pid}.tmp`
  try {
    await writeFile(temp, JSON.stringify(value), {mode: 0o600, flag: "wx"})
    await rename(temp, file())
    await chmod(file(), 0o600)
  } finally {
    await rm(temp, {force: true})
  }
}
async function load(): Promise<Saved> {
  try {
    return JSON.parse(await readFile(file(), "utf8"))
  } catch {
    throw new Error("Login first with aios-glass account login")
  }
}
/** Password is read from an environment variable, never from argv or terminal output. */
export async function catalogCommand(args: string[]) {
  const [command, action, ...rest] = args
  const option = (key: string) => {
    const i = rest.indexOf(key)
    return i < 0 ? undefined : rest[i + 1]
  }
  if (command === "account") {
    if (action === "logout") {
      const saved = await load()
      await rm(file(), {force: true})
      await new CatalogClient(saved.address).logout(saved.session.token)
      console.log("Signed out; local credentials removed.")
      return
    }
    if (action !== "register" && action !== "login") throw new Error("account register|login|logout")
    const address = option("--server"),
      username = option("--username"),
      password = process.env.AIOS_GLASS_PASSWORD
    if (!address || !username || !password)
      throw new Error("Use --server URL --username NAME and AIOS_GLASS_PASSWORD in the environment")
    const client = new CatalogClient(address),
      session = await client.authenticate(action, username, password)
    await save({address: client.address, session})
    console.log(`Signed in as ${session.user.username}. Credentials stored in a private local file.`)
    return
  }
  const saved = await load(),
    client = new CatalogClient(saved.address)
  if (command === "catalog") {
    console.log(JSON.stringify(await client.catalog(), null, 2))
    return
  }
  if (command === "publish") {
    if (!action) throw new Error("publish FILE.zip [--project DIR]")
    const root = resolve(option("--project") ?? process.cwd()),
      manifest = defineApp(JSON.parse(await readFile(join(root, "aios.json"), "utf8")))
    try {
      await client.createApp(saved.session.token, manifest.id, manifest.name, option("--description") ?? "")
    } catch (e) {
      if (!(e instanceof Error) || e.message !== "app_exists") throw e
    }
    const release = await client.publish(saved.session.token, manifest.id, await readFile(resolve(action)))
    console.log(`Published ${release.packageName}@${release.version} · SHA-256 ${release.digest}`)
    return
  }
  throw new Error("Unknown catalog command")
}
