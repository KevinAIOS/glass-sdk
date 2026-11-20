/**
 * @aios/glass — SDK for building AIOSGlass local miniapps.
 *
 * Public entry point. Consumers do:
 *
 *   import {MiniappSession} from "@aios/glass"            // background JSContext
 *   import {useColorScheme} from "@aios/glass/react"      // UI WebView hooks
 *   import {MiniappRequestType} from "@aios/glass/protocol"
 */
import { installDevReloadListenerIfDevMode } from "./dev-reload";
// Auto-install the dev-reload listener on module import so authors get live
// reload for free in dev builds. No-op in production (gated on
// window.AIOSGlass.miniappDeveloperMode).
installDevReloadListenerIfDevMode();
export { MiniappSession, NotConnectedError } from "./session";
export { makeRequestId, parseEnvelope, serializeEnvelope } from "./envelope";
export { getAIOSGlassGlobals } from "./globals";
export { MiniappErrorCode, MiniappRequestType, MiniappResponseType, MiniappStreamType } from "./protocol";
export { CLOUD_STATUS_STREAM } from "./modules/cloud";
// Language registry (issue 021): canonical language types + the validation
// error the typed transcription/translation surfaces throw.
export { MiniappValidationError, SUPPORTED_LANGUAGE_HINTS, SUPPORTED_TRANSCRIPTION_LANGUAGES, isTranscriptionLanguage, } from "./modules/languages";
// Canonical miniapp manifest hardware contract.
export { HardwareType, HardwareRequirementLevel } from "./hardware";
// Transports — exported for advanced uses (forced transport injection, tests)
export { createTransport } from "./transport/auto";
export { PostMessageTransport } from "./transport/postmessage";
export { LocalSocketTransport } from "./transport/local-socket";
export { MockTransport, isMockExplicitlyRequested } from "./transport/mock";
export { SpeakerStreamWriter, SPEAKER_STREAM_MAX_BUFFERED_MS, SPEAKER_WRITE_CHUNK_BYTES } from "./modules/speaker";
export { MEETING_HOST_UPDATE_MESSAGE, parseMeetingMediaSource, parseMeetingParticipants } from "./modules/meeting";
// AIOS perception (contracts/perception/v1alpha): stream(), sub(), read().
export { all, any, not, semantic, signal, when } from "./modules/perception";
export * from "./manifest";
export { MiniappSession as GlassSession } from "./session";
export { registerMiniapp as registerApp } from "./background/register";
