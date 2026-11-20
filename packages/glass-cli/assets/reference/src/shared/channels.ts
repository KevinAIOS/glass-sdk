import type {AiosTyped, Rpc} from "@aios/glass/ui"
export interface Channels {
  counter: Rpc<{increment: boolean}, {count: number; hostReady: boolean}>
}
declare global {
  var aios: AiosTyped<Channels>
}
