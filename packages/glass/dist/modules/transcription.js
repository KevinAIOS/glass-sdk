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
import { MiniappRequestType, MiniappStreamType } from "../protocol";
import { requireLanguageHint, requireTranscriptionLanguage } from "./languages";
export class TranscriptionModule {
    constructor(session) {
        this.session = session;
        this.unsubs = new Set();
        this.currentConfig = null;
    }
    /**
     * Subscribe to all transcription events (auto-detect language). The
     * detected language is in `data.language`.
     *
     * Wire-level: subscribes to `transcription:auto`. Today's wildcard fan-out
     * (handlers on `transcription:auto` receive any `transcription:<lang>`
     * event) preserves existing semantics.
     */
    on(handler, options = {}) {
        return this.track(this.session._subscribe(`${MiniappStreamType.TRANSCRIPTION}:auto`, handler, options));
    }
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
    forLanguage(language, handler, options = {}) {
        const langs = (Array.isArray(language) ? language : [language]).map((lang) => requireTranscriptionLanguage(lang, "transcription.forLanguage(language)"));
        if (langs.length === 0)
            return () => { };
        const unsubs = [];
        for (const lang of langs) {
            unsubs.push(this.session._subscribe(`${MiniappStreamType.TRANSCRIPTION}:${lang}`, handler, options));
        }
        const combined = () => {
            for (const u of unsubs) {
                try {
                    u();
                }
                catch {
                    /* ignore */
                }
            }
        };
        return this.track(combined);
    }
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
    configure(config) {
        const normalized = {
            ...config,
            languageHints: config.languageHints?.map((hint) => requireLanguageHint(hint, "transcription.configure(languageHints)")),
        };
        this.currentConfig = { ...normalized };
        return this.session
            .sendRequest({
            type: MiniappRequestType.TRANSCRIPTION_CONFIG,
            config: { ...normalized },
        })
            .then(() => undefined);
    }
    /** Tear down every transcription subscription this module owns. */
    stop() {
        for (const u of this.unsubs) {
            try {
                u();
            }
            catch {
                /* ignore */
            }
        }
        this.unsubs.clear();
    }
    /** True iff `MICROPHONE` is declared in the miniapp's manifest. */
    get hasPermission() {
        return this.session._hasManifestPermission("MICROPHONE");
    }
    /** @internal — current config, read by tests / future reconnect logic. */
    _getConfig() {
        return this.currentConfig ? { ...this.currentConfig } : null;
    }
    // ------------------------------------------------------------------------
    track(unsub) {
        this.unsubs.add(unsub);
        return () => {
            this.unsubs.delete(unsub);
            unsub();
        };
    }
}
