package local.aios.glass.sdk;
import android.os.Bundle;
/** Each callback is bound to one authenticated application incarnation. */
interface IAIOSHost {
  Bundle request(String sessionId, String requestId, String operation, String payloadJson);
}
