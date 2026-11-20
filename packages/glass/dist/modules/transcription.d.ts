/**
 * @fileoverview TranscriptionModule — top-level transcription API.
 *
 * Mirrors cloud SDK v3's TranscriptionManager:
 *
 *   session.transcription.on(handler)                                // auto-detect
 *   session.transcription.forLanguage("en-US", handler)              // single language
 *   session.transcription.forLanguage(["en-US", "es-ES"], handler)   // multi-language
 *   session.transcription.configure({languageHints, vocabulary, diarization})
 *   session.transcription.stop()                                     // tear down all
 *
 * Hoisted to top-level (vs. nested under `session.mic`) because transcription
 * is a domain in its own right, not a microphone-input event. The `mic`
 * module still exposes lower-level audio chunks + VAD; this module is for
 * "give me text from speech."
 *
 * MICROPHONE permission must be declared in miniapp.json. The phone runtime
 * rejects with PERMISSION_NOT_DECLARED otherwise.
 */
import { MiniappSession } from "../session";
import type { TranscriptionData, UnsubscribeFn } from "./events";
import type { LanguageHint, TranscriptionLanguage } from "./languages";
/** Configuration for cloud-side transcription behavior. */
export interface TranscriptionConfig {
    /**
     * Language hints to improve auto-detection accuracy. Bare ISO 639-1 codes
     * from the registry (e.g. ["en", "ja"]); registry BCP-47 tags are accepted
     * and normalized ("en-US" -> "en"). Anything else throws
     * `MiniappValidationError`.
     */
    languageHints?: LanguageHint[];
    /** Custom vocabulary / boosted terms (e.g. ["AIOSGlass", "HIPAA"]). */
    vocabulary?: string[];
    /** Enable speaker diarisation. Defaults vary by provider. */
    diarization?: boolean;
}
export interface TranscriptionOptions {
    /**
     * Use only on-device STT for this listener; never deliver cloud transcripts.
     * Other listeners on the same stream keep their own routing choice. Requires
     * a downloaded local STT model.
     */
    forceLocal?: boolean;
}
export declare class TranscriptionModule {
    private readonly session;
    private readonly unsubs;
    private currentConfig;
    constructor(session: MiniappSession);
    /**
     * Subscribe to all transcription events (auto-detect language). The
     * detected language is in `data.language`.
     *
     * Wire-level: subscribes to `transcription:auto`. Today's wildcard fan-out
     * (handlers on `transcription:auto` receive any `transcription:<lang>`
     * event) preserves existing semantics.
     */
    on(handler: (data: TranscriptionData) => void, options?: TranscriptionOptions): UnsubscribeFn;
    /**
     * Subscribe to transcription for one or more specific languages. Each call
     * is independent; multiple can be active simultaneously.
     *
     * Languages are validated against the platform registry
     * (`SUPPORTED_TRANSCRIPTION_LANGUAGES`): registry BCP-47 tags pass through,
     * bare registry codes canonicalize ("fr" -> "fr-FR"), anything else throws
     * `MiniappValidationError` immediately — an invalid language must never
     * become a subscription that silently transcribes the wrong thing
     * (OS-1746 / issue 021).
     *
     * @param language - Registry tag(s), e.g. `"en-US"` or `["en-US", "es-ES"]`.
     * @param handler  - Called for every event in any of the listed languages.
     */
    forLanguage(language: TranscriptionLanguage | TranscriptionLanguage[], handler: (data: TranscriptionData) => void, options?: TranscriptionOptions): UnsubscribeFn;
    /**
     * Apply transcription configuration (language hints, custom vocabulary,
     * diarisation toggle). Hints are validated against the registry and
     * normalized to bare codes ("en-US" -> "en"); unknown values throw
     * `MiniappValidationError` synchronously.
     *
     * Sent to the phone runtime as a REQUEST (not a one-shot) so the returned
     * promise rejects if the runtime cannot apply it — a config that the
     * platform ignores must be loud, not silent (issue 021 S3). Cached locally
     * so the runtime can re-apply on reconnect.
     */
    configure(config: TranscriptionConfig): Promise<void>;
    /** Tear down every transcription subscription this module owns. */
    stop(): void;
    /** True iff `MICROPHONE` is declared in the miniapp's manifest. */
    get hasPermission(): boolean;
    /** @internal — current config, read by tests / future reconnect logic. */
    _getConfig(): TranscriptionConfig | null;
    private track;
}
