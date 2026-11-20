package local.aios.glass.sdk;
import android.os.Bundle;
import local.aios.glass.sdk.IAIOSHost;
interface IAIOSAppService {
  Bundle connect(in Bundle hello, IAIOSHost host);
  oneway void onEvent(String sessionId, String eventJson);
  oneway void stop(String sessionId, String reason);
}
