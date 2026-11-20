/**
 * @fileoverview MeetingModule — phone-native meeting (ACS Teams).
 *
 * V1 token pass-through is deliberate technical debt (identity ticket):
 * later, join(meetingUrl, whepUrl) and the host fetches the credential from
 * Porter. Miniapps must not persist the token.
 */
import { MiniappSession } from "../session";
import type { UnsubscribeFn } from "./events";
export declare const MEETING_HOST_UPDATE_MESSAGE = "Update the Aios App to use Teams calling";
export type MeetingProvider = "acs-teams";
export type MeetingPhase = "idle" | "connecting" | "lobby" | "connected" | "disconnected" | "error";
export interface MeetingVideoSource {
    type: "whep";
    url: string;
}
/** Advertised ACS outgoing format. Omitted hosts keep 1280×720@15. */
export interface MeetingOutgoingVideo {
    width: number;
    height: number;
    fps: number;
    maxBitrateBps: number;
}
export interface MeetingJoinOptions {
    provider: MeetingProvider;
    meetingUrl: string;
    videoSource: MeetingVideoSource;
    /** V1-only: Porter-minted ACS guest token. Do not persist. */
    token: string;
    displayName?: string;
    video?: MeetingOutgoingVideo;
}
export type MeetingParticipantState = "idle" | "connecting" | "connected" | "lobby" | "hold" | "disconnected";
/** A remote participant as reported by the phone-native meeting client. */
export interface MeetingParticipant {
    /** Stable provider identifier (ACS raw id). */
    id: string;
    displayName: string | null;
    state: MeetingParticipantState;
    isMuted: boolean;
    isSpeaking: boolean;
}
export interface MeetingState {
    state: MeetingPhase;
    muted: boolean;
    error?: string;
    meetingUrl?: string;
    provider?: MeetingProvider;
    audioSource?: "glasses" | "phone";
    audioSourceReason?: "explicit" | "current-mic" | "ranking" | "fallback-glasses-connected" | "fallback-no-glasses";
    activeStream?: "none" | "virtual" | "local";
    audioSafety?: "safe" | "degraded" | "unsafe";
    /**
     * Health of the glasses video the phone is forwarding into the meeting.
     * `live` means a frame reached the meeting client, so it is the only honest
     * "remote participants can see the camera" signal — the WHEP subscription
     * answers seconds earlier. Omitted by hosts that predate the field, which
     * must be read as "unknown", never as "not live".
     */
    mediaSource?: MeetingMediaSource;
    /** Remote roster. Omitted by hosts that predate participant reporting. */
    participants?: MeetingParticipant[];
}
export type MeetingMediaSource = "idle" | "connecting" | "live" | "failed";
/** Tolerant parse of a host `mediaSource`. Unknown values read as unknown. */
export declare function parseMeetingMediaSource(raw: unknown): MeetingMediaSource | undefined;
/** Tolerant parse of a host `participants` payload. Unknown shapes are skipped. */
export declare function parseMeetingParticipants(raw: unknown): MeetingParticipant[] | undefined;
export type MeetingStateHandler = (state: MeetingState) => void;
export declare class MeetingModule {
    private readonly session;
    private _state;
    constructor(session: MiniappSession);
    get state(): MeetingState;
    /**
     * Join a Teams meeting via the phone ACS client.
     * Resolves once the host has accepted the join (state may still be connecting/lobby).
     */
    join(options: MeetingJoinOptions): Promise<MeetingState>;
    leave(): Promise<void>;
    setMuted(muted: boolean): Promise<void>;
    updateVideoSource(source: MeetingVideoSource): Promise<void>;
    getState(): Promise<MeetingState>;
    onState(handler: MeetingStateHandler): UnsubscribeFn;
    /** @internal — applied by MiniappSession on inbound MEETING_STATE. */
    _applyState(event: MeetingState): void;
}
