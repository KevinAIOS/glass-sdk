import type {AiosTyped} from "@aios/glass/ui"
export interface Channels {
  "kawaii:set-face": {face: string}
  "kawaii:face": {face: string}
}
declare global {
  var aios: AiosTyped<Channels>
}
