#!/usr/bin/env bun
import {main} from "./commands"
try {
  await main(process.argv.slice(2))
} catch (error) {
  console.error(`AIOS: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
