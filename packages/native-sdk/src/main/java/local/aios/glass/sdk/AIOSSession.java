package local.aios.glass.sdk;

import android.os.Bundle;
import android.os.RemoteException;
import org.json.JSONObject;
import java.util.UUID;

/** Java API also callable directly from Kotlin. Results arrive through onEvent. */
public final class AIOSSession {
  public static final int PROTOCOL_VERSION = 1;
  private final IAIOSHost host;
  private final String id;
  private volatile boolean active = true;
  private final java.util.Set<String> revokedPermissions = java.util.concurrent.ConcurrentHashMap.newKeySet();
  void permissionChanged(String scope, boolean allowed) { if (allowed) revokedPermissions.remove(scope); else revokedPermissions.add(scope); }
  boolean acceptsScope(String scope) { return scope == null || !revokedPermissions.contains(scope); }
  AIOSSession(IAIOSHost host, String id) { this.host = host; this.id = id; }
  public String getId() { return id; }
  public boolean isActive() { return active; }
  void close() { active = false; }
  public String request(String operation, JSONObject payload) throws RemoteException {
    if (!active) throw new IllegalStateException("SESSION_CLOSED");
    String requestId = UUID.randomUUID().toString();
    Bundle result = host.request(id, requestId, operation, payload.toString());
    if (!result.getBoolean("accepted")) throw new SecurityException(result.getString("error", "REQUEST_REJECTED"));
    return requestId;
  }
  public String subscribe(String... events) throws RemoteException {
    return request("subscribe", json("events", new org.json.JSONArray(java.util.Arrays.asList(events))));
  }
  public String present(String text) throws RemoteException { return request("presentation.text", json("text", text)); }
  /** Submit a versioned scene or semantic presentation. Results arrive as a result event. */
  public String present(AIOSPresentation presentation) throws RemoteException {return request("presentation.submit", presentation.toJSON());}
  /** Receive normalized actions on the input.action event, scoped to current display focus. */
  public String subscribeActions() throws RemoteException {return subscribe("input.action");}
  public String clearPresentation() throws RemoteException { return request("presentation.clear", new JSONObject()); }
  public String takePhoto() throws RemoteException { return request("camera.photo", new JSONObject()); }
  /** Read a bounded chunk of a photo captured by this application. */
  public String readPhoto(String assetId, int offset, int length) throws RemoteException {
    if (offset < 0 || length < 1 || length > 49152) throw new IllegalArgumentException("Invalid photo read range");
    return request("camera.read", fields("assetId", assetId, "offset", offset, "length", length));
  }
  public String startRecording(String recordingId) throws RemoteException { return request("media.record", json("recordingId", recordingId)); }
  /** Audio support is device-dependent; Meta DAT 0.2.1 supports silent video only. */
  public String startRecording(String recordingId, boolean captureAudio) throws RemoteException { return request("media.record", fields("recordingId", recordingId, "captureAudio", captureAudio)); }
  public String cancelRecording(String recordingId) throws RemoteException { return request("media.stop", fields("recordingId", recordingId, "cancel", true)); }
  public String startStream(String destination, boolean captureAudio) throws RemoteException { return request("media.stream.start", fields("streamUrl", destination, "captureAudio", captureAudio)); }
  public String stopStream(String streamId) throws RemoteException { return request("media.stream.stop", json("streamId", streamId)); }
  public String readMedia(String assetId, int offset, int length) throws RemoteException { return request("media.read", fields("assetId", assetId, "offset", offset, "length", length)); }
  public String stopRecording(String recordingId) throws RemoteException { return request("media.stop", json("recordingId", recordingId)); }
  /** Receives transcription partial/final text. Raw audio uses microphone.audio or microphone.lc3. */
  public String subscribeTranscription() throws RemoteException {return subscribe("transcription");}
  public String speak(String text, double volume) throws RemoteException {
    return request("speaker.speak", fields("text", text, "volume", checkedVolume(volume), "forceLocal", true));
  }
  public String play(String audioUrl, double volume) throws RemoteException {
    return request("speaker.play", fields("audioUrl", audioUrl, "volume", checkedVolume(volume)));
  }
  public String stopAudio() throws RemoteException {return request("speaker.stop", new JSONObject());}
  /** Read result.data.streamId before writing; await each result to honor native backpressure. */
  public String openAudioStream(int sampleRate, double volume) throws RemoteException {
    return request("speaker.stream.open", fields("sampleRate", sampleRate, "channels", 1, "format", "pcm16", "volume", checkedVolume(volume)));
  }
  /** One complete PCM16LE chunk, at most 8192 bytes, fits the public Binder message budget. */
  public String writeAudioStream(String streamId, byte[] pcm) throws RemoteException {
    if (pcm.length == 0 || pcm.length > 8192 || pcm.length % 2 != 0) throw new IllegalArgumentException("PCM_CHUNK_SIZE");
    return request("speaker.stream.write", fields("streamId", streamId, "base64", android.util.Base64.encodeToString(pcm, android.util.Base64.NO_WRAP)));
  }
  public String closeAudioStream(String streamId) throws RemoteException {return request("speaker.stream.close", json("streamId", streamId));}
  public String abortAudioStream(String streamId) throws RemoteException {return request("speaker.stream.abort", json("streamId", streamId));}
  public String getLocation() throws RemoteException {return request("location.get", new JSONObject());}
  public String getStorage(String key) throws RemoteException {return request("storage.get", json("key", key));}
  public String setStorage(String key, String value) throws RemoteException {return request("storage.set", fields("key", key, "value", value));}
  public String getSetting(String key) throws RemoteException {return request("settings.get", json("key", key));}
  public String setSetting(String key, Object value) throws RemoteException {return request("settings.set", fields("key", key, "value", value));}
  private static double checkedVolume(double value) {
    if (Double.isNaN(value) || Double.isInfinite(value) || value < 0 || value > 1) throw new IllegalArgumentException("VOLUME_RANGE");
    return value;
  }
  public static JSONObject fields(Object... pairs) {
    if (pairs.length % 2 != 0) throw new IllegalArgumentException("KEY_VALUE_PAIRS");
    JSONObject result = new JSONObject();
    try {for (int i=0; i<pairs.length; i+=2) result.put((String)pairs[i], pairs[i+1]);}
    catch (org.json.JSONException error) {throw new IllegalArgumentException(error);}
    return result;
  }
  public static JSONObject json(String key, Object value) {
    try { return new JSONObject().put(key, value); }
    catch (org.json.JSONException error) { throw new IllegalArgumentException(error); }
  }
}
