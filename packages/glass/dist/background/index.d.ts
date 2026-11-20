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
export { MiniappSession, type MiniappSessionOptions } from "../session";
export { registerMiniapp, type MiniappInitHandler, type TypedMiniappSession } from "./register";
export { defineExperience, isExperienceDefinition, AiosCodeError, CODE_SDK_VERSION } from "../experience";
export type { CodeEvent, ExperienceDefinition, ExperienceHandlers, Session as ExperienceSession } from "../experience";
export type { TranscriptionData, TranslationData, ButtonPressData, AudioChunkData, VadData, BatteryData, ConnectionData, WifiData, HeadPositionData, AccelData, LocationData, PhoneNotificationData, NotificationDismissedData, HeadingData, TouchData, UnsubscribeFn, } from "../modules/events";
export type { CalendarEvent, CalendarListOptions, CalendarListResult } from "../modules/phone";
export { MiniappRequestType, MiniappResponseType, MiniappStreamType, MiniappErrorCode } from "../protocol";
export { MiniappValidationError, SUPPORTED_LANGUAGE_HINTS, SUPPORTED_TRANSCRIPTION_LANGUAGES, isTranscriptionLanguage, } from "../modules/languages";
export type { LanguageHint, TranscriptionLanguage } from "../modules/languages";
export type { ActionContext, ActionHandler, InvokeOptions } from "../modules/actions";
export type { DisplayManager } from "../modules/display";
export type { CameraFovPreset, CameraFovRequest, CameraFovResult, CameraModule, CameraRoiPosition, SetCameraFovOptions, } from "../modules/camera";
export type { CloudClientAudioTransport, CloudClientConnectionStatus, CloudClientStatus, CloudModule, } from "../modules/cloud";
export type { DashboardAPI } from "../modules/dashboard";
export type { GlassesModule } from "../modules/glasses";
export type { HeadingModule } from "../modules/heading";
export type { ImuModule } from "../modules/imu";
export type { InputModule } from "../modules/input";
export type { LedModule } from "../modules/led";
export type { LocationModule } from "../modules/location";
export type { MicModule } from "../modules/mic";
export type { NavigationModule } from "../modules/navigation";
export type { PermissionsModule } from "../modules/permissions";
export type { PhoneModule } from "../modules/phone";
export type { SimpleStorage } from "../modules/storage";
export { BlobModule, BlobWriter, BlobReader, BLOB_WRITE_CHUNK_BYTES, BLOB_READ_ALL_MAX_BYTES } from "../modules/blob";
export type { BlobMeta, BlobSetOptions, BlobSetFromUrlOptions, BlobImportOptions } from "../modules/blob";
export { bytesToBase64, base64ToBytes } from "../modules/base64";
export type { SpeakerModule } from "../modules/speaker";
export type { MeetingModule, MeetingJoinOptions, MeetingState, MeetingPhase, MeetingProvider, MeetingVideoSource, MeetingParticipant, MeetingParticipantState, MeetingMediaSource, } from "../modules/meeting";
export { MEETING_HOST_UPDATE_MESSAGE, parseMeetingMediaSource, parseMeetingParticipants } from "../modules/meeting";
export type { StreamModule } from "../modules/stream";
export type { SystemModule } from "../modules/system";
export type { TranscriptionModule } from "../modules/transcription";
export type { TranslationModule } from "../modules/translation";
export type { UIModule, UIChannelHandler, UIUnsubscribe } from "../modules/ui";
export type { Rpc, IsRpc, RpcReq, RpcRes, RpcRequestOptions, RpcHandlerContext } from "../modules/ui";
export { AiosRpcError, AiosRpcTimeoutError } from "../modules/ui";
export type { LedColor, LedControlOptions } from "../modules/led";
export type { ViewType, DisplayBreakMode, RenderBox, RenderElement, RenderOptions, RenderRectStyle, RenderResult, RenderTextStyle, } from "../modules/display";
export type { DashboardMode } from "../modules/dashboard";
export type { PlayAudioOptions, SpeakOptions, SpeakResult, SpeakerState, SpeakerStateEvent } from "../modules/speaker";
export type { ShareOptions, ShareResult, DownloadOptions, DownloadResult, ScanQrOptions, ScanQrResult, } from "../modules/system";
export type { TranscriptionConfig, TranscriptionOptions } from "../modules/transcription";
export type { PermissionErrorEvent } from "../modules/permissions";
export type { AuthUpdatePayload, MiniappVisibility, PermissionType, PermissionRecord, GlassesCapabilities, ConnectAckPayload, HostFeatures, MiniappAuthState, MiniappRequestError, } from "../session";
export type { AuthFetchOptions, AuthModule } from "../modules/auth";
export type { MiniappColorScheme } from "../globals";
export type { LatLng, TravelMode, ManeuverKind, RouteAvoidances, NavManeuver, NavOffRoute, NavRerouting, NavArrived, NavError, NavUpdate, NavRoute, PivotOptions, Pivot, PivotEvent, NavStep, NavigationDev, StartNavigationOptions, NavState, NavPermissionResult, ComputeRouteOptions, ComputedRouteStep, ComputedRoute, ComputeRouteResult, } from "../modules/navigation";
export type { SemanticActionEvent, SemanticActionName, PresentationMode, PresentationRequest } from "../modules/interaction";
export type { SettingValue } from "../modules/settings";
export { all, any, not, semantic, signal, when } from "../modules/perception";
export type { PerceptionModule, PerceptionAudioChunkMs, PerceptionAudioOptions, PerceptionCondition, PerceptionEvent, PerceptionExpr, PerceptionLeaf, PerceptionOperator, PerceptionRequestError, PerceptionSemanticCondition, PerceptionSignalCondition, PerceptionSignalReading, PerceptionSignalValue, PerceptionStateChange, PerceptionStreamChunk, PerceptionStreamHandle, PerceptionStreamOpened, PerceptionStreamRequest, PerceptionSubscription, PerceptionSubscriptionHandle, PerceptionSubscriptionStatus, PerceptionVideoFps, PerceptionVideoOptions, PerceptionVideoResolution, } from "../modules/perception";
export { MiniappSession as GlassSession } from "../session";
export { registerMiniapp as registerApp } from "./register";
