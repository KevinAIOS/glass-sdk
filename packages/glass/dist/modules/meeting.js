/**
 * @fileoverview MeetingModule — phone-native meeting (ACS Teams).
 *
 * V1 token pass-through is deliberate technical debt (identity ticket):
 * later, join(meetingUrl, whepUrl) and the host fetches the credential from
 * Porter. Miniapps must not persist the token.
 */
import { MiniappErrorCode, MiniappRequestType } from "../protocol";
export const MEETING_HOST_UPDATE_MESSAGE = "Update the Aios App to use Teams calling";
const PARTICIPANT_STATES = new Set(["idle", "connecting", "connected", "lobby", "hold", "disconnected"]);
const MEDIA_SOURCES = new Set(["idle", "connecting", "live", "failed"]);
/** Tolerant parse of a host `mediaSource`. Unknown values read as unknown. */
export function parseMeetingMediaSource(raw) {
    return MEDIA_SOURCES.has(String(raw)) ? raw : undefined;
}
/** Tolerant parse of a host `participants` payload. Unknown shapes are skipped. */
export function parseMeetingParticipants(raw) {
    if (!Array.isArray(raw))
        return undefined;
    const result = [];
    for (const entry of raw) {
        if (!entry || typeof entry !== "object")
            continue;
        const value = entry;
        if (typeof value.id !== "string" || !value.id)
            continue;
        result.push({
            id: value.id,
            displayName: typeof value.displayName === "string" && value.displayName ? value.displayName : null,
            state: PARTICIPANT_STATES.has(String(value.state)) ? value.state : "idle",
            isMuted: Boolean(value.isMuted),
            isSpeaking: Boolean(value.isSpeaking),
        });
    }
    return result;
}
function isMiniappRequestError(error) {
    return Boolean(error && typeof error === "object" && "code" in error);
}
function mapHostError(error) {
    if (isMiniappRequestError(error) && error.code === MiniappErrorCode.NOT_IMPLEMENTED) {
        throw { code: MiniappErrorCode.NOT_IMPLEMENTED, message: MEETING_HOST_UPDATE_MESSAGE };
    }
    throw error;
}
export class MeetingModule {
    constructor(session) {
        this.session = session;
        this._state = { state: "idle", muted: false };
    }
    get state() {
        return { ...this._state };
    }
    /**
     * Join a Teams meeting via the phone ACS client.
     * Resolves once the host has accepted the join (state may still be connecting/lobby).
     */
    async join(options) {
        if (options.provider !== "acs-teams") {
            throw { code: MiniappErrorCode.INVALID_ARGUMENT, message: `Unsupported meeting provider: ${options.provider}` };
        }
        if (!options.meetingUrl?.trim()) {
            throw { code: MiniappErrorCode.INVALID_ARGUMENT, message: "meetingUrl is required" };
        }
        if (options.videoSource?.type !== "whep" || !options.videoSource.url?.trim()) {
            throw { code: MiniappErrorCode.INVALID_ARGUMENT, message: "videoSource must be a WHEP URL" };
        }
        if (!options.token?.trim()) {
            throw { code: MiniappErrorCode.INVALID_ARGUMENT, message: "token is required" };
        }
        try {
            const result = await this.session.sendRequest({
                type: MiniappRequestType.MEETING_JOIN,
                provider: options.provider,
                meetingUrl: options.meetingUrl,
                videoSource: options.videoSource,
                token: options.token,
                displayName: options.displayName,
                ...(options.video ? { video: options.video } : {}),
            }, { timeoutMs: 0 });
            if (result)
                this._applyState(result);
            return this.state;
        }
        catch (error) {
            mapHostError(error);
        }
    }
    async leave() {
        try {
            await this.session.sendRequest({ type: MiniappRequestType.MEETING_LEAVE });
        }
        catch (error) {
            mapHostError(error);
        }
    }
    async setMuted(muted) {
        try {
            const result = await this.session.sendRequest({
                type: MiniappRequestType.MEETING_SET_MUTED,
                muted,
            });
            if (result)
                this._applyState(result);
        }
        catch (error) {
            mapHostError(error);
        }
    }
    async updateVideoSource(source) {
        if (source?.type !== "whep" || !source.url?.trim()) {
            throw { code: MiniappErrorCode.INVALID_ARGUMENT, message: "videoSource must be a WHEP URL" };
        }
        try {
            await this.session.sendRequest({
                type: MiniappRequestType.MEETING_UPDATE_VIDEO_SOURCE,
                videoSource: source,
            });
        }
        catch (error) {
            mapHostError(error);
        }
    }
    async getState() {
        try {
            const result = await this.session.sendRequest({
                type: MiniappRequestType.MEETING_GET_STATE,
            });
            if (result)
                this._applyState(result);
            return this.state;
        }
        catch (error) {
            mapHostError(error);
        }
    }
    onState(handler) {
        return this.session.on("meetingState", handler);
    }
    /** @internal — applied by MiniappSession on inbound MEETING_STATE. */
    _applyState(event) {
        this._state = {
            state: event.state,
            muted: Boolean(event.muted),
            error: event.error,
            meetingUrl: event.meetingUrl,
            provider: event.provider,
            audioSource: event.audioSource,
            audioSourceReason: event.audioSourceReason,
            activeStream: event.activeStream,
            audioSafety: event.audioSafety,
            mediaSource: parseMeetingMediaSource(event.mediaSource),
            participants: parseMeetingParticipants(event.participants),
        };
    }
}
