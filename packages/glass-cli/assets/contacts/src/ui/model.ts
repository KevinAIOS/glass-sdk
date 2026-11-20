import type {DataNeed, DataSchema, DataResult} from "@aios/glass/ui"
export type Conversation = {id: string; date: string; summary: string; sourceIds: string[]}
export type Commitment = {text: string; status: string; sourceIds: string[]}
export type Person = {
  id: string
  name: string
  relation: string
  notes: string
  sourceIds: string[]
  conversations: Conversation[]
  commitments: Commitment[]
}
export type Contacts = {people: Person[]; missing: string[]; conflicts: string[]}
const str = (maxLength = 1000): DataSchema => ({type: "string", maxLength})
const arr = (items: DataSchema, maxItems = 100): DataSchema => ({type: "array", items, maxItems})
const obj = (properties: Record<string, DataSchema>): DataSchema => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})
const refs = arr(str(160), 30)
export const contactsNeed: DataNeed = {
  need: "我需要用户认识的人、与用户的关系、相关谈话和约定。只使用用户允许的资料，保留每个人及每条记录的来源。缺失信息用空字符串和 missing 说明，矛盾保留在 conflicts 中；不得补造事实。",
  purpose: "建立私人联系人列表与交往时间线，供用户分组、搜索和核对来源。不会修改或发布原始记录。",
  schema: obj({
    people: arr(
      obj({
        id: str(160),
        name: str(120),
        relation: str(300),
        notes: str(2000),
        sourceIds: refs,
        conversations: arr(obj({id: str(160), date: str(80), summary: str(2000), sourceIds: refs})),
        commitments: arr(obj({text: str(1000), status: str(100), sourceIds: refs})),
      }),
    ),
    missing: arr(str()),
    conflicts: arr(str()),
  }),
}
export function validateContacts(result: DataResult<Contacts>): Contacts {
  const refs = new Set(result.sources.map((s) => s.id)),
    ids = new Set<string>()
  for (const person of result.data.people) {
    if (!person.id || !person.name || ids.has(person.id)) throw new Error("invalid_data_result")
    ids.add(person.id)
    for (const item of [person, ...person.conversations, ...person.commitments])
      if (!item.sourceIds.length || item.sourceIds.some((id) => !refs.has(id))) throw new Error("invalid_data_result")
    const events = new Set<string>()
    for (const item of person.conversations) {
      if (!item.id || events.has(item.id)) throw new Error("invalid_data_result")
      events.add(item.id)
    }
  }
  return result.data
}
export function filterPeople(people: Person[], query: string, group: string, groups: Record<string, string>) {
  const term = query.trim().toLocaleLowerCase()
  return people.filter(
    (p) =>
      (!group || groups[p.id] === group) &&
      `${p.name} ${p.relation} ${p.notes} ${p.conversations.map((c) => c.summary).join(" ")} ${p.commitments
        .map((c) => c.text)
        .join(" ")}`
        .toLocaleLowerCase()
        .includes(term),
  )
}
