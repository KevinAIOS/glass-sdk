/**
 * @fileoverview CameraModule — glasses camera control and photo capture.
 */
import { MiniappSession } from "../session";
export type CameraRoiPosition = "center" | "bottom" | "top";
export type CameraFovPreset = "narrow" | "standard" | "wide";
export type CameraFovRequest = {
    /** Horizontal FOV, degrees. */
    fov: number;
    /** Crop/region position: center, bottom, or top. Defaults to center. */
    roiPosition?: CameraRoiPosition;
} | {
    /** Named FOV preset. Presets use center ROI. */
    preset: CameraFovPreset;
};
export type SetCameraFovOptions = CameraFovRequest;
export interface CameraFovResult {
    requestId: string;
    fov: number;
    roiPosition: CameraRoiPosition;
    timestamp: number;
}
export interface TakePhotoOptions {
    size?: "low" | "medium" | "high" | "max";
    /** Capture at maximum source quality and optimize BLE delivery for readable text. */
    mode?: "photo" | "text";
    /**
     * Image delivery path. `auto` tries direct Wi-Fi upload and falls back to
     * BLE; `direct` disables BLE fallback; `ble` always relays through the phone.
     */
    transferMethod?: "auto" | "direct" | "ble";
    compress?: "none" | "low" | "medium" | "high";
    sound?: boolean;
    saveToGallery?: boolean;
    /**
     * Manual shutter / exposure time in nanoseconds. Omit (or pass undefined)
     * to let the glasses auto-expose. Honored only on cameras that support
     * manual exposure; ignored otherwise.
     */
    exposureTimeNs?: number;
    /** Sensor ISO for this capture only. Only used when `exposureTimeNs` enables manual exposure. */
    iso?: number | null;
    /** After AE convergence, divide the metered exposure by this factor (scan mode). */
    aeExposureDivisor?: number;
    /** Cap ISO after AE metering (scan mode). */
    isoCap?: number;
    /** Request per-capture noise reduction. Sent on the wire; glasses may log `not_implemented`. */
    noiseReduction?: boolean;
    /** Request per-capture edge enhancement. Sent on the wire; glasses may log `not_implemented`. */
    edgeEnhancement?: boolean;
    /**
     * ZSL buffering. Manual and scan stills force it off because fixed sensor controls take priority.
     */
    zsl?: boolean;
    /**
     * MFNR still capture. Manual and scan stills force it off because fixed sensor controls take priority.
     */
    mfnr?: boolean;
    /** ISP digital gain hint. */
    ispDigitalGain?: number;
    /** ISP analog gain hint. */
    ispAnalogGain?: string;
    /**
     * Override the SDK's default 60s request timeout for this capture only.
     * Leave unset for a normal user-triggered capture (the full 60s ceiling is
     * appropriate there). Callers that speculatively fire a capture and may
     * abandon it if the result isn't needed (e.g. a short-lived non-visual
     * assistant turn racing a capture against a ~1s latency cap) should pass a
     * short value here so the abandoned `takePhoto()` promise settles quickly
     * instead of sitting on the default 60s ceiling.
     */
    timeoutMs?: number;
}
export interface PhotoTaken {
    /** Capture provenance when provided by the device adapter. */
    source?: "video_frame" | "native_photo";
    width?: number;
    height?: number;
    elapsedMs?: number;
    frameAgeMs?: number;
    deviceId?: string;
    sdkVersion?: string;
    /** Stable capture identity. */
    requestId: string;
    photoUrl: string;
    mimeType: string;
    size: number;
}
export interface WarmUpCameraOptions {
    size?: "low" | "medium" | "high" | "max";
    /** Match the upcoming capture mode so warm-up and capture share one ASG camera session. */
    mode?: "photo" | "text";
    exposureTimeNs?: number;
    /** Ready-state hold in milliseconds. Defaults to 15 seconds and is capped at 60 seconds. */
    durationMs?: number;
    /** ZSL preview buffering for the warm-up session. */
    zsl?: boolean;
    /** MFNR still capture for the warm-up session. */
    mfnr?: boolean;
}
export interface StartVideoRecordingOptions {
    /** Audio is device-dependent. Meta DAT 0.2.1 defaults to silent video and rejects true. */
    captureAudio?: boolean;
    /** Video width in pixels. Omit to use the device's saved button-video default. */
    width?: number;
    /** Video height in pixels. Omit to use the device's saved button-video default. */
    height?: number;
    /**
     * Frames per second. Lower frame rates keep the glasses cooler and produce
     * smaller files — useful for long recordings where smooth motion isn't needed.
     * Omit to use the device default.
     */
    fps?: number;
    /** Play start/stop capture sounds. Defaults to true. */
    sound?: boolean;
    /** Keep the recording on the glasses after it finishes. Defaults to false. */
    save?: boolean;
}
export interface VideoRecordingStarted {
    /** Identifier for this recording session; pass to {@link stopVideoRecording}. */
    recordingId: string;
    /** Whether the device adapter includes audio, when reported. */
    captureAudio?: boolean;
}
export interface StopVideoRecordingOptions {
    /** Discard an AIOS phone-owned recording instead of adding it to Gallery. */
    cancel?: boolean;
    /**
     * Upload the finished recording to this URL with a multipart POST (the file is
     * the `video` part). The glasses upload it directly. Omit to keep the recording
     * on the glasses instead.
     */
    uploadUrl?: string;
    /** Bearer token sent as the `Authorization` header on the upload, if your endpoint needs one. */
    uploadAuthToken?: string;
}
export declare class CameraModule {
    private readonly session;
    constructor(session: MiniappSession);
    /** True iff `CAMERA` is declared in the miniapp's manifest. */
    get hasPermission(): boolean;
    /**
     * Apply a session-owned camera FOV/ROI override on the glasses.
     *
     * Resolves after the ASG client reports that the setting was applied to camera
     * hardware after the restart cooldown. The host restores the prior override or persistent base
     * when this miniapp closes. Requires CAMERA permission declared in miniapp.json.
     */
    setFov(request: CameraFovRequest): Promise<CameraFovResult>;
    /**
     * Take a photo via the glasses camera. Returns a URL to the captured image.
     * Requires CAMERA permission declared in miniapp.json.
     *
     * The Host determines whether the URL is local or remotely delivered. AIOS
     * returns a local asset; capture alone does not upload it. If the glasses
     * do not expose a camera, the phone-side handler rejects. Check
     * `session.capabilities.hasCamera` before calling.
     */
    /** Read only an asset owned by this MiniApp, without granting filesystem access. */
    readMediaChunk(assetId: string, offset?: number, length?: number): Promise<{
        base64: string;
        offset: number;
        totalBytes: number;
        done: boolean;
        mimeType: string;
    }>;
    cancelVideoRecording(recordingId: string): Promise<{
        asset?: {
            id: string;
            uri: string;
            mime_type: string;
            bytes: number;
            elapsed_ms: number;
        };
    } | undefined>;
    readPhotoChunk(requestId: string, offset?: number, length?: number): Promise<{
        base64: string;
        offset: number;
        totalBytes: number;
        done: boolean;
        mimeType: string;
    }>;
    takePhoto(options?: TakePhotoOptions): Promise<PhotoTaken>;
    /**
     * Pre-warm the glasses camera so the next takePhoto() is near-instant.
     * The camera stays warm for ~durationMs (default 15s, maximum 60s); call warmUp() again to
     * extend it. Warm with the same `size` you'll capture with — a mismatched size
     * forces the camera to reconfigure and loses the speedup. Requires CAMERA
     * permission in miniapp.json. Resolves once the camera reports ready. The host automatically
     * releases this miniapp's request-owned lease when the miniapp closes.
     *
     * Warm-ups are serialized: only one runs at a time and none may start while a
     * photo is being captured. If the camera is busy (a capture is in flight, or
     * another warm-up is still opening) this rejects with `camera_busy` — retry
     * shortly, or just call takePhoto() (it works regardless, only slower). The
     * normal warmUp() → takePhoto() sequence never hits this.
     */
    warmUp(options?: WarmUpCameraOptions): Promise<void>;
    /**
     * Start recording video on the glasses camera. Returns a `recordingId` to pass
     * to {@link stopVideoRecording} after the glasses report that recording
     * started. Requires CAMERA permission declared in miniapp.json. Check
     * `session.capabilities.hasCamera` before calling.
     *
     * Resolution and frame rate are optional — omit them to use the device's saved
     * button-video settings. Lowering `fps` (e.g. to 5) keeps the glasses cooler
     * during long recordings.
     */
    startVideoRecording(options?: StartVideoRecordingOptions): Promise<VideoRecordingStarted>;
    /**
     * Stop an in-progress video recording started with {@link startVideoRecording}.
     *
     * By default the recording stays on the glasses. Pass `uploadUrl` to have the
     * glasses upload the finished clip to your own endpoint.
     *
     * @param recordingId The id returned from `startVideoRecording`.
     * @param options     Optional upload destination for the finished recording.
     */
    stopVideoRecording(recordingId: string, options?: StopVideoRecordingOptions): Promise<{
        asset?: {
            id: string;
            uri: string;
            mime_type: string;
            bytes: number;
            elapsed_ms: number;
        };
    } | undefined>;
}
