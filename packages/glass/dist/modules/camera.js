/**
 * @fileoverview CameraModule — glasses camera control and photo capture.
 */
import { MiniappRequestType } from "../protocol";
export class CameraModule {
    constructor(session) {
        this.session = session;
    }
    /** True iff `CAMERA` is declared in the miniapp's manifest. */
    get hasPermission() {
        return this.session._hasManifestPermission("CAMERA");
    }
    /**
     * Apply a session-owned camera FOV/ROI override on the glasses.
     *
     * Resolves after the ASG client reports that the setting was applied to camera
     * hardware after the restart cooldown. The host restores the prior override or persistent base
     * when this miniapp closes. Requires CAMERA permission declared in miniapp.json.
     */
    async setFov(request) {
        return this.session.sendRequest({
            type: MiniappRequestType.CAMERA_FOV,
            ...request,
        });
    }
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
    async readMediaChunk(assetId, offset = 0, length = 49152) { return this.readPhotoChunk(assetId, offset, length); }
    async cancelVideoRecording(recordingId) { return this.stopVideoRecording(recordingId, { cancel: true }); }
    async readPhotoChunk(requestId, offset = 0, length = 49152) {
        return this.session.sendRequest({ type: MiniappRequestType.PHOTO_READ, assetId: requestId, offset, length });
    }
    async takePhoto(options = {}) {
        return this.session.sendRequest({
            type: MiniappRequestType.PHOTO,
            size: options.size ?? "medium",
            mode: options.mode ?? "photo",
            ...(options.transferMethod !== undefined ? { transferMethod: options.transferMethod } : {}),
            compress: options.compress ?? "none",
            sound: options.sound ?? true,
            saveToGallery: options.saveToGallery ?? false,
            exposureTimeNs: options.exposureTimeNs,
            iso: options.iso,
            aeExposureDivisor: options.aeExposureDivisor,
            isoCap: options.isoCap,
            noiseReduction: options.noiseReduction,
            edgeEnhancement: options.edgeEnhancement,
            zsl: options.zsl,
            mfnr: options.mfnr,
            ispDigitalGain: options.ispDigitalGain,
            ispAnalogGain: options.ispAnalogGain,
        }, options.timeoutMs != null ? { timeoutMs: options.timeoutMs } : undefined);
    }
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
    async warmUp(options = {}) {
        await this.session.sendRequest({
            type: MiniappRequestType.CAMERA_WARM_UP,
            size: options.size ?? "medium",
            mode: options.mode ?? "photo",
            exposureTimeNs: options.exposureTimeNs,
            durationMs: options.durationMs ?? 15000,
            zsl: options.zsl,
            mfnr: options.mfnr,
        });
    }
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
    async startVideoRecording(options = {}) {
        return this.session.sendRequest({
            type: MiniappRequestType.VIDEO_RECORDING_START,
            captureAudio: options.captureAudio,
            width: options.width,
            height: options.height,
            fps: options.fps,
            sound: options.sound ?? true,
            save: options.save ?? false,
        });
    }
    /**
     * Stop an in-progress video recording started with {@link startVideoRecording}.
     *
     * By default the recording stays on the glasses. Pass `uploadUrl` to have the
     * glasses upload the finished clip to your own endpoint.
     *
     * @param recordingId The id returned from `startVideoRecording`.
     * @param options     Optional upload destination for the finished recording.
     */
    async stopVideoRecording(recordingId, options = {}) {
        return this.session.sendRequest({
            type: MiniappRequestType.VIDEO_RECORDING_STOP,
            cancel: options.cancel,
            recordingId,
            uploadUrl: options.uploadUrl,
            uploadAuthToken: options.uploadAuthToken,
        });
    }
}
