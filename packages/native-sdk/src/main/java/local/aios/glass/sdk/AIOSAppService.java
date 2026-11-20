package local.aios.glass.sdk;

import android.app.Service;
import android.content.Intent;
import android.os.Binder;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Handler;
import android.os.HandlerThread;
import org.json.JSONObject;

/** Export this service with local.aios.permission.BIND_APP and the AIOS_APP intent.
 * Pin the Host certificate supplied by the platform distributor, never a caller's claims.
 * Business callbacks run serially on the application's worker, outside Binder threads.
 */
public abstract class AIOSAppService extends Service {
  public static final String ACTION = "local.aios.glass.AIOS_APP";
  public static final String PERMISSION = "local.aios.permission.BIND_APP";
  private final HandlerThread worker = new HandlerThread("AIOS-App");
  private Handler handler;
  private int queuedEvents, queuedBytes;
  private long droppedAudioEvents;
  private static String eventScope(String event) {
    if (event.startsWith("microphone.") || event.equals("transcription")) return "MICROPHONE";
    if (event.equals("location")) return "LOCATION";
    if (event.startsWith("notification.")) return "READ_NOTIFICATIONS";
    if (event.startsWith("device.") || event.startsWith("input.")) return "DEVICE_STATE";
    return null;
  }

  private volatile AIOSSession session;
  private IBinder hostBinder;
  private IBinder.DeathRecipient death;
  protected abstract String trustedHostPackage();
  protected abstract String trustedHostCertificate();
  protected abstract void onAIOSReady(AIOSSession session, JSONObject state) throws Exception;
  protected abstract void onAIOSEvent(AIOSSession session, JSONObject event) throws Exception;
  protected void onAIOSStopped(String reason) {}
  protected void onAIOSError(Exception error) { android.util.Log.e("AIOS-App", "Application callback failed", error); }
  protected int supportedProtocol() { return AIOSSession.PROTOCOL_VERSION; }
  private void verifyCaller() { AIOSIdentity.verify(this, Binder.getCallingUid(), trustedHostPackage(), trustedHostCertificate()); }
  @Override public void onCreate() { super.onCreate(); worker.start(); handler = new Handler(worker.getLooper()); }
  private synchronized void close(String reason) {
    AIOSSession old = session; session = null;
    if (hostBinder != null && death != null) try { hostBinder.unlinkToDeath(death, 0); } catch (java.util.NoSuchElementException ignored) {}
    hostBinder = null; death = null;
    if (old != null) { old.close(); handler.post(() -> onAIOSStopped(reason)); }
  }
  private final IAIOSAppService.Stub binder = new IAIOSAppService.Stub() {
    @Override public Bundle connect(Bundle hello, IAIOSHost host) {
      verifyCaller();
      Bundle reply = new Bundle(); reply.putInt("protocol", supportedProtocol());
      if (hello.getInt("protocol") != supportedProtocol()) { reply.putString("error", "PROTOCOL_INCOMPATIBLE"); return reply; }
      String id = hello.getString("sessionId", "");
      if (id.length() < 20 || host == null) throw new SecurityException("INVALID_HANDSHAKE");
      synchronized (AIOSAppService.this) {
        close("replaced");
        session = new AIOSSession(host, id); hostBinder = host.asBinder();
        death = () -> close("HOST_DIED");
        try { hostBinder.linkToDeath(death, 0); }
        catch (android.os.RemoteException error) { close("HOST_DIED"); throw new IllegalStateException(error); }
      }
      reply.putBoolean("accepted", true);
      reply.putString("packageName", getPackageName());
      return reply;
    }
    @Override public void onEvent(String id, String raw) {
      verifyCaller();
      if (raw == null || raw.length() > 65536) throw new IllegalArgumentException("EVENT_TOO_LARGE");
      AIOSSession current = session;
      if (current == null || !current.getId().equals(id)) return;
      final JSONObject event;
      try { event = new JSONObject(raw); } catch (Exception error) { throw new IllegalArgumentException("INVALID_EVENT", error); }
      String type = event.optString("type");
      if (type.equals("permission_changed")) current.permissionChanged(event.optString("permission"), event.optBoolean("allowed"));
      boolean stream = type.equals("event");
      String scope = stream ? eventScope(event.optString("event")) : null;
      int bytes = raw.length() * 2;
      if (stream) synchronized (AIOSAppService.this) {
        if (!current.acceptsScope(scope)) return;
        if (queuedEvents >= 64 || queuedBytes + bytes > 262144) {
          if ("MICROPHONE".equals(scope)) droppedAudioEvents++;
          return;
        }
        queuedEvents++; queuedBytes += bytes;
      }
      handler.post(() -> {
        try {
          if (session != current || !current.isActive() || !current.acceptsScope(scope)) return;
          long dropped = 0;
          synchronized (AIOSAppService.this) { if (stream) { dropped = droppedAudioEvents; droppedAudioEvents = 0; } }
          if (dropped > 0 && current.acceptsScope("MICROPHONE")) onAIOSEvent(current,
            AIOSSession.fields("type","event","event","microphone.health","data",AIOSSession.fields("reason","consumer_overflow","droppedChunks",dropped)));
          if (type.equals("ping")) current.request("pong", new JSONObject());
          else if (type.equals("ready")) onAIOSReady(current, event);
          else onAIOSEvent(current, event);
        } catch (Exception error) { onAIOSError(error); }
        finally { if (stream) synchronized (AIOSAppService.this) { queuedEvents--; queuedBytes -= bytes; } }
      });
    }
    @Override public void stop(String id, String reason) {
      verifyCaller();
      AIOSSession current = session;
      if (current != null && current.getId().equals(id)) close(reason);
    }
  };
  @Override public IBinder onBind(Intent intent) { return ACTION.equals(intent.getAction()) ? binder : null; }
  @Override public boolean onUnbind(Intent intent) { close("UNBOUND"); return false; }
  @Override public void onDestroy() { close("DESTROYED"); worker.quitSafely(); super.onDestroy(); }
}
