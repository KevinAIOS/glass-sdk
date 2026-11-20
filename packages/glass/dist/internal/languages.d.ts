/**
 * @fileoverview The canonical language registry (issue 021, WP1).
 *
 * Single source of truth for every language value that crosses a layer
 * boundary: miniapp SDK types, miniapp UI pickers, engine validation, cloud
 * subscription validation, and STT provider config all derive from THIS
 * module. Per-miniapp mapping tables are banned; the captions bugbash
 * (OS-1746) traced directly to two hand-maintained registries disagreeing.
 *
 * Two vocabularies exist on purpose:
 *   - `TranscriptionLanguage`: BCP-47 tags ("en-US") used in subscriptions and
 *     stream keys. What a miniapp asks for.
 *   - `LanguageHint`: bare ISO 639-1 codes ("en") — the only format the STT
 *     provider (Soniox) accepts as language hints. Passing a BCP-47 tag kills
 *     the session with "Invalid language hint." (verified live 2026-07-21).
 *
 * Design doc: docs/issues/021-typed-language-subscriptions/README.md
 */
/**
 * Bare ISO 639-1 code -> canonical default BCP-47 tag. One entry per language
 * the platform offers. The key set doubles as the supported-hints list; the
 * value set doubles as the supported-subscription-tags list.
 *
 * Seeded from the 63 languages the captions UI offers (all Soniox stt-rt-v4
 * supported); regional variants beyond the default (e.g. "en-GB", "zh-TW",
 * "pt-PT") are listed in EXTRA_REGIONAL_TAGS below.
 */
declare const CANONICAL_TAG_BY_CODE: {
    readonly af: "af-ZA";
    readonly am: "am-ET";
    readonly ar: "ar-AE";
    readonly az: "az-AZ";
    readonly be: "be-BY";
    readonly bg: "bg-BG";
    readonly bn: "bn-IN";
    readonly bs: "bs-BA";
    readonly ca: "ca-ES";
    readonly cs: "cs-CZ";
    readonly cy: "cy-GB";
    readonly da: "da-DK";
    readonly de: "de-DE";
    readonly el: "el-GR";
    readonly en: "en-US";
    readonly es: "es-ES";
    readonly et: "et-EE";
    readonly eu: "eu-ES";
    readonly fa: "fa-IR";
    readonly fi: "fi-FI";
    readonly fr: "fr-FR";
    readonly gl: "gl-ES";
    readonly gu: "gu-IN";
    readonly he: "he-IL";
    readonly hi: "hi-IN";
    readonly hr: "hr-HR";
    readonly hu: "hu-HU";
    readonly hy: "hy-AM";
    readonly id: "id-ID";
    readonly it: "it-IT";
    readonly ja: "ja-JP";
    readonly ka: "ka-GE";
    readonly kk: "kk-KZ";
    readonly kn: "kn-IN";
    readonly ko: "ko-KR";
    readonly lt: "lt-LT";
    readonly lv: "lv-LV";
    readonly mk: "mk-MK";
    readonly ml: "ml-IN";
    readonly mr: "mr-IN";
    readonly ms: "ms-MY";
    readonly nb: "nb-NO";
    readonly ne: "ne-NP";
    readonly nl: "nl-NL";
    readonly no: "nb-NO";
    readonly pa: "pa-IN";
    readonly pl: "pl-PL";
    readonly pt: "pt-BR";
    readonly ro: "ro-RO";
    readonly ru: "ru-RU";
    readonly sk: "sk-SK";
    readonly sl: "sl-SI";
    readonly sq: "sq-AL";
    readonly sr: "sr-RS";
    readonly sv: "sv-SE";
    readonly sw: "sw-KE";
    readonly ta: "ta-IN";
    readonly te: "te-IN";
    readonly th: "th-TH";
    readonly tl: "fil-PH";
    readonly tr: "tr-TR";
    readonly uk: "uk-UA";
    readonly ur: "ur-IN";
    readonly vi: "vi-VN";
    readonly zh: "zh-CN";
};
/**
 * Regional variants accepted IN ADDITION to the canonical defaults above.
 * A tag listed here is a valid `TranscriptionLanguage` but is never produced
 * by bare-code canonicalization.
 */
declare const EXTRA_REGIONAL_TAGS: readonly ["ar-EG", "ar-SA", "de-AT", "de-CH", "en-AU", "en-CA", "en-GB", "en-IN", "es-419", "es-MX", "es-US", "fr-CA", "nl-BE", "pt-PT", "zh-HK", "zh-TW"];
type CodeMap = typeof CANONICAL_TAG_BY_CODE;
/** Bare ISO 639-1 hint codes the STT provider accepts ("en", "fr", ...). */
export type LanguageHint = keyof CodeMap;
/** BCP-47 tags valid in transcription subscriptions and stream keys. */
export type TranscriptionLanguage = CodeMap[LanguageHint] | (typeof EXTRA_REGIONAL_TAGS)[number];
/** Every supported hint code, sorted, deduped. */
export declare const SUPPORTED_LANGUAGE_HINTS: readonly LanguageHint[];
/** Every supported subscription tag, sorted, deduped. */
export declare const SUPPORTED_TRANSCRIPTION_LANGUAGES: readonly TranscriptionLanguage[];
/** Type guard: is `value` a supported subscription tag? */
export declare function isTranscriptionLanguage(value: string): value is TranscriptionLanguage;
/** Type guard: is `value` a supported bare hint code? */
export declare function isLanguageHint(value: string): value is LanguageHint;
/**
 * Canonicalize developer input to a subscription tag:
 *   - a supported tag passes through ("fr-FR" -> "fr-FR")
 *   - a bare supported code maps to its canonical default ("fr" -> "fr-FR")
 *   - anything else returns null (caller decides how loudly to fail)
 *
 * Per issue 021 open question 1, bare codes are accepted and canonicalized
 * rather than rejected: it matches user intent and the canonicalization table
 * lives HERE, nowhere else.
 */
export declare function toTranscriptionLanguage(value: string): TranscriptionLanguage | null;
/**
 * Reduce a subscription tag (or bare code) to the hint format the STT
 * provider accepts. "en-US" -> "en", "fil-PH" -> "tl" is NOT attempted (the
 * primary subtag is what providers key on), so "fil-PH" -> "fil" falls back
 * to null and the caller simply omits the hint. Null means "no valid hint";
 * never pass the raw value through on null (that is the exact Soniox
 * session-killer this registry exists to prevent).
 */
export declare function toLanguageHint(value: string): LanguageHint | null;
/**
 * Nearest valid tag for an invalid input, for error messages
 * ("unknown language \"fr_FR\", did you mean \"fr-FR\"?"). Cheap heuristics
 * only: underscore/case fixes, then primary-subtag canonical default.
 */
export declare function suggestTranscriptionLanguage(value: string): TranscriptionLanguage | null;
export {};
