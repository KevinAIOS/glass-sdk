/** Public, versioned input and presentation values shared by both app transports. */
import type {RenderElement} from "./display"

export type SemanticActionName =
  | "activate"
  | "back"
  | "next"
  | "previous"
  | "scroll_forward"
  | "scroll_backward"
  | "confirm"
  | "cancel"
  | "open_menu"
  | "play"
  | "pause"
  | "adjust"
  | "capture"
  | "invoke_ai"
export interface SemanticActionEvent {
  schema_version: 1
  action: SemanticActionName
  phase: "start" | "update" | "end" | "cancel"
  control_id: string
  delta: number
  velocity: number
  duration_ms: number
  timestamp: number
  sequence: number
  device_session: string
  source_capability: "button" | "touch" | "head" | "imu"
  simulated: boolean
}
export type PresentationMode = "developer_managed" | "aios_managed" | "hybrid"
export interface PresentationRequest {
  schema_version: 1
  id: string
  mode: PresentationMode
  /** Only main glance display is currently scheduled. */
  view?: "main" | "dashboard"
  elements?: RenderElement[]
  content?: {title?: string; text: string}
  /** Host caps urgency; this never grants system-overlay privileges. */
  urgency?: "normal" | "urgent"
  durationMs?: number
}
