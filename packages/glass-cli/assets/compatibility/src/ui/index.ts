import {onHostReady} from "@aios/glass/ui/bridge"
import type {Channels} from "../shared/channels"
onHostReady<Channels>((aios) => {
  const faces = ["づ(^_^)づ", "ᕕ(^_^)ᕗ", "ᕙ(^_^)ᕗ", "٩(^‿^)۶", "\\(^o^)/", "b(^_^)d"]
  let index = 0
  const showFace = (face: string) => {
    const nextIndex = faces.indexOf(face)
    if (nextIndex >= 0) index = nextIndex
    const faceEl = document.getElementById("face")!
    faceEl.textContent = face
    faceEl.classList.remove("bump")
    void faceEl.offsetWidth
    faceEl.classList.add("bump")
  }
  document.getElementById("next")!.addEventListener("click", () => {
    index = (index + 1) % faces.length
    const face = faces[index]
    aios?.send?.("kawaii:set-face", {face})
  })
  aios?.on?.("kawaii:face", ({face}) => {
    showFace(face)
    document.getElementById("bridge")!.textContent = "Background confirmed"
    ;(document.getElementById("next") as HTMLButtonElement).disabled = false
  })
  aios?.ready?.()
})
