import {requestData, readDataSource, revokeData, type DataResult, type DataTask} from "@aios/glass/ui"
import {contactsNeed, validateContacts, filterPeople, type Contacts, type Person} from "./model"
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
let result: DataResult<Contacts> | undefined,
  task: DataTask<unknown> | undefined,
  selected = "",
  epoch = 0,
  listScroll = 0
let groups: Record<string, string> = Object.create(null),
  favorites = new Set<string>()
const status = (text: string) => {
  get("status").textContent = text
}
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "", cls = "") => {
  const n = document.createElement(tag)
  n.textContent = text
  n.className = cls
  return n
}
const button = (text: string, run: () => void, cls = "") => {
  const n = node("button", text, cls)
  n.onclick = run
  return n
}
function busy(value: boolean) {
  get<HTMLButtonElement>("request").disabled = value
  get("cancel").hidden = !value
}
function clear(resetPreferences = true) {
  epoch++
  task?.cancel()
  task = undefined
  result = undefined
  selected = ""
  if (resetPreferences) {
    groups = Object.create(null)
    favorites.clear()
  }
  busy(false)
  get("source").replaceChildren()
  get("source").hidden = true
  get("notices").replaceChildren()
  get("updated").textContent = ""
  render()
}
function error(e: unknown) {
  const code = e instanceof Error ? e.message : ""
  const messages: Record<string, string> = {
    data_service_unavailable:
      "暂时无法连接资料服务。请先在手机上连接 AIOS，再重试整理并选择允许使用的资料。",
    permission_denied: "你没有允许使用资料。可以重新请求并选择范围。",
    permission_revoked: "资料授权已撤销，已清除本次内容。",
    data_timeout: "整理超时了，请稍后重试。",
    cancelled: "请求已取消。",
    host_unavailable: "请在 AIOS 手机 Host 内打开这个应用。",
    invalid_data_result: "返回的资料或来源不完整，请重新整理。",
    session_closed: "当前会话已失效，请重新打开应用。",
  }
  status(messages[code] ?? "暂时未能取得资料，请检查连接后重试。")
}
function sourceButtons(ids: string[]) {
  const row = node("div", "", "row")
  for (const id of ids) {
    const source = result?.sources.find((s) => s.id === id)
    if (!source) continue
    row.append(button(`来源：${source.title}`, () => void openSource(id), "source"))
  }
  return row
}
async function openSource(id: string) {
  if (!result || task) return
  const stamp = epoch,
    original = result
  const request = readDataSource(result.requestId, id)
  task = request
  busy(true)
  status("正在核对授权并读取来源…")
  try {
    const value = await request.result
    if (stamp !== epoch || result !== original) return
    const panel = get("source")
    panel.hidden = false
    panel.replaceChildren(
      node("h2", "来源记录"),
      node("p", value.text, "source-text"),
      button("收起来源", () => {
        panel.hidden = true
        panel.replaceChildren()
      }),
    )
    panel.scrollIntoView({block: "start"})
    status("来源只读；不会修改原始记录。")
  } catch (e) {
    if (stamp === epoch) error(e)
  } finally {
    if (stamp === epoch) {
      task = undefined
      busy(false)
    }
  }
}
function render() {
  const list = get("list"),
    detail = get("detail"),
    filters = get("filters")
  list.replaceChildren()
  detail.replaceChildren()
  detail.hidden = true
  filters.hidden = !result
  if (!result) {
    list.append(node("p", "尚未取得资料。请求时由你选择允许使用的范围。", "empty muted"))
    return
  }
  const search = get<HTMLInputElement>("search").value,
    group = get<HTMLSelectElement>("group").value
  const people = filterPeople(result.data.people, search, group, groups)
    .slice()
    .sort((a, b) => Number(favorites.has(b.id)) - Number(favorites.has(a.id)))
  if (!people.length)
    list.append(
      node(
        "p",
        result.data.people.length
          ? "没有匹配的联系人，试试其他搜索词或分组。"
          : "获准资料中没有找到联系人。可增加资料后重新整理。",
        "empty muted",
      ),
    )
  for (const p of people) {
    const b = button(
      "",
      () => {
        listScroll = window.scrollY
        selected = p.id
        render()
        get("detail").scrollIntoView({block: "start"})
        get("detail").querySelector("h2")?.focus({preventScroll: true})
      },
      "person",
    )
    b.append(
      node("strong", `${p.name}${favorites.has(p.id) ? " · 已收藏" : ""}`),
      node("span", p.relation || "关系尚未记录", "muted"),
    )
    list.append(b)
  }
  const person = result.data.people.find((p) => p.id === selected)
  if (person) showPerson(person)
}
function showPerson(p: Person) {
  const detail = get("detail")
  detail.hidden = false
  detail.className = "section"
  const heading = node("h2", p.name)
  heading.tabIndex = -1
  detail.append(
    button("返回联系人列表", () => {
      selected = ""
      render()
      window.scrollTo(0, listScroll)
      get("list").querySelector("button")?.focus({preventScroll: true})
    }),
    heading,
    node("p", p.relation || "关系尚未记录"),
    node("p", p.notes),
    sourceButtons(p.sourceIds),
  )
  const controls = node("div", "", "row"),
    input = node("input")
  input.placeholder = "自定义分组"
  input.setAttribute("aria-label", "联系人分组")
  input.value = groups[p.id] ?? ""
  input.maxLength = 40
  controls.append(
    input,
    button("保存分组", () => {
      groups[p.id] = input.value.trim()
      updateGroups()
      render()
    }),
    button(favorites.has(p.id) ? "取消收藏" : "收藏", () => {
      favorites.has(p.id) ? favorites.delete(p.id) : favorites.add(p.id)
      render()
    }),
  )
  detail.append(controls, node("small", "分组与收藏属于本次应用体验，不会写回原始记录。"), node("h3", "交往时间线"))
  for (const c of [...p.conversations].sort((a, b) => b.date.localeCompare(a.date))) {
    const el = node("article", "", "entry")
    el.append(node("small", c.date || "时间未记录"), node("p", c.summary), sourceButtons(c.sourceIds))
    detail.append(el)
  }
  if (!p.conversations.length) detail.append(node("p", "暂无相关谈话记录。", "muted"))
  detail.append(node("h3", "约定"))
  for (const c of p.commitments) {
    const el = node("article", "", "entry")
    el.append(node("p", c.text), node("small", c.status || "状态未知"), sourceButtons(c.sourceIds))
    detail.append(el)
  }
  if (!p.commitments.length) detail.append(node("p", "暂无已记录的约定。", "muted"))
}
function updateGroups() {
  const select = get<HTMLSelectElement>("group"),
    previous = select.value
  select.replaceChildren(new Option("所有分组", ""))
  for (const group of [...new Set(Object.values(groups).filter(Boolean))].sort()) select.add(new Option(group, group))
  select.value = Array.from(select.options).some((o) => o.value === previous) ? previous : ""
}
get("request").onclick = async () => {
  clear(false)
  const stamp = epoch
  busy(true)
  status("正在请求资料范围，随后请在 AIOS 中确认授权…")
  const request = requestData<Contacts>(contactsNeed)
  task = request
  try {
    const next = await request.result
    if (stamp !== epoch) return
    validateContacts(next)
    result = next
    get("notices").replaceChildren(
      ...[
        ...next.warnings.filter((s) => s.trim()),
        ...next.data.missing.filter((s) => s.trim()).map((s) => `缺失：${s}`),
        ...next.data.conflicts.filter((s) => s.trim()).map((s) => `有待核对：${s}`),
      ].map((s) => node("p", s, "notice")),
    )
    get("updated").textContent = `资料更新于 ${new Date(next.updatedAt).toLocaleString()}`
    get("request").textContent = "重新选择资料并刷新"
    status(`已整理 ${next.data.people.length} 位联系人 · 更新于 ${new Date(next.updatedAt).toLocaleString()}`)
    updateGroups()
    render()
  } catch (e) {
    if (stamp === epoch) error(e)
  } finally {
    if (stamp === epoch) {
      task = undefined
      busy(false)
    }
  }
}
get("cancel").onclick = () => {
  task?.cancel()
  status("正在取消…")
}
get("clear").onclick = () => {
  clear()
  try {
    revokeData()
  } catch {}
  status("已撤销授权并清除本次资料。")
}
window.addEventListener("aios:data-revoked", () => {
  clear()
  status("资料授权已撤销，已清除本次内容。")
})
window.addEventListener("pagehide", () => clear())
get("search").oninput = render
get("group").onchange = render
