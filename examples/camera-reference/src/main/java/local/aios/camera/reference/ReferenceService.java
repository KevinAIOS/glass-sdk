package local.aios.camera.reference;
import local.aios.glass.sdk.*;
import org.json.JSONObject;

/** Independently signed native camera consumer, using only the public SDK. */
public final class ReferenceService extends AIOSAppService {
  static volatile ReferenceService current;
  static volatile AIOSSession active;
  static volatile String status="等待 AIOS 连接";
  private final java.util.concurrent.ConcurrentHashMap<String,String> pending=new java.util.concurrent.ConcurrentHashMap<>();
  protected String trustedHostPackage(){return "local.aios.glass";}
  protected String trustedHostCertificate(){return BuildIdentity.HOST_CERTIFICATE;}
  protected int supportedProtocol(){return BuildIdentity.PROTOCOL;}
  private void record(String key,String value){getSharedPreferences("reference",0).edit().putString(key,value).apply();}
  static void capture() throws Exception {
    ReferenceService service=current;AIOSSession session=active;
    if(service==null||session==null)throw new IllegalStateException("Not connected");
    service.pending.put(session.takePhoto(),"photo");status="正在拍照";
  }
  protected void onAIOSReady(AIOSSession session,JSONObject state)throws Exception {
    current=this;active=session;status="已连接 AIOS";record("ready",state.toString());
  }
  protected void onAIOSEvent(AIOSSession session,JSONObject event)throws Exception {
    if(!event.optString("type").equals("result"))return;
    String op=pending.remove(event.optString("requestId"));if(op==null)return;
    record(op,event.toString());
    if(!event.optBoolean("success")){status="操作失败";return;}
    JSONObject data=event.getJSONObject("data");
    if(op.equals("photo"))pending.put(session.readPhoto(data.getString("requestId"),0,8192),"read");
    else if(op.equals("read")){
      boolean jpeg=data.getString("base64").startsWith("/9j/");
      record("jpeg-readable",String.valueOf(jpeg));status=jpeg?"照片字节已读取":"照片格式错误";
    }
  }
  protected void onAIOSStopped(String reason){active=null;current=null;status="已断开";record("stopped",reason);}
  protected void onAIOSError(Exception error){record("error",error.toString());}
}
