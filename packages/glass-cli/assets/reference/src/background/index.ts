import {registerApp} from "@aios/glass/background"
import type {Channels} from "../shared/channels"

registerApp<Channels>((session) => {
  let queue = Promise.resolve()
  session.ui.handle("counter", ({increment}) => {
    const result = queue.then(async () => {
      await session.waitForReady()
      const previous = Number((await session.storage.get("counter")) ?? 0)
      const count = previous + (increment ? 1 : 0)
      if (increment) await session.storage.set("counter", String(count))
      return {count, hostReady: session.ready}
    })
    queue = result.then(
      () => {},
      () => {},
    )
    return result
  })
})
