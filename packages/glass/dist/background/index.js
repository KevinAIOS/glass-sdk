/**
 * @aios/glass/background — background-side SDK entry point.
 *
 * Imported from a miniapp's `src/background/index.ts` to access the
 * per-miniapp `MiniappSession` and its typed `session.*` module
 * wrappers. This is the **always-running JSContext side** of a two-layer
 * miniapp.
 *
 * What's NOT in this entry point:
 *   - `aios` WebView global (UI-only — import from `@aios/glass/ui`).
 *   - `AiosProvider` / React hooks (UI-only).
 *   - Any DOM-bound API. The JSContext has no DOM.
 *
 * Importing the wrong sub-path is caught at compile time by the
 * separate type-roots on each `exports` entry.
 */
export { MiniappSession } from "../session";
export { registerMiniapp } from "./register";
// Code Experiences (SDK 0.5): `registerApp(defineExperience({...}))`.
export { defineExperience, isExperienceDefinition, AiosCodeError, CODE_SDK_VERSION } from "../experience";
// Public envelope + protocol types so authors can write strongly-typed
// glue when they need to fall back to session.sendOneShot / sendRequest.
export { MiniappRequestType, MiniappResponseType, MiniappStreamType, MiniappErrorCode } from "../protocol";
export { MiniappValidationError, SUPPORTED_LANGUAGE_HINTS, SUPPORTED_TRANSCRIPTION_LANGUAGES, isTranscriptionLanguage, } from "../modules/languages";
export { BlobModule, BlobWriter, BlobReader, BLOB_WRITE_CHUNK_BYTES, BLOB_READ_ALL_MAX_BYTES } from "../modules/blob";
export { bytesToBase64, base64ToBytes } from "../modules/base64";
export { MEETING_HOST_UPDATE_MESSAGE, parseMeetingMediaSource, parseMeetingParticipants } from "../modules/meeting";
export { AiosRpcError, AiosRpcTimeoutError } from "../modules/ui";
// AIOS perception (contracts/perception/v1alpha): stream(), sub(), read().
export { all, any, not, semantic, signal, when } from "../modules/perception";
export { MiniappSession as GlassSession } from "../session";
export { registerMiniapp as registerApp } from "./register";
