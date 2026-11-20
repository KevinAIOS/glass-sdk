import {onHostReady} from "@aios/glass/ui/bridge"
import type {Channels} from "../shared/channels"
const status = document.querySelector<HTMLElement>("#status")!
const count = document.querySelector<HTMLElement>("#count")!
const button = document.querySelector<HTMLButtonElement>("#increment")!
const error = document.querySelector<HTMLElement>("#error")!
let loaded = false
async function update(increment: boolean) {
  button.disabled = true
  error.textContent = ""
  try {
    const value = await aios.request("counter", {increment}, {timeout: 8000})
    count.textContent = `已保存 ${value.count} 次`
    loaded = true
    button.textContent = "记录一次"
    status.textContent = "应用已连接本机，记录会在关闭后保留。"
  } catch {
    error.textContent = increment
      ? "未能保存，请确认应用仍在 AIOS 中运行后重试。"
      : "未能读取记录，请确认应用仍在 AIOS 中运行后重试。"
    status.textContent = "暂时无法连接本地记录。"
    if (!loaded) {
      count.textContent = "记录尚未读取"
      button.textContent = "重新读取"
    }
  } finally {
    button.disabled = false
  }
}
button.addEventListener("click", () => void update(loaded))
onHostReady<Channels>((bridge) => {
  bridge.onOpen(() => void update(false))
  bridge.ready()
})
