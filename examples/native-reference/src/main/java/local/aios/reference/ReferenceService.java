package local.aios.reference;
import local.aios.glass.sdk.*;
import org.json.JSONObject;

/** A normal external consumer: business state and Android UI stay in this APK. */
public final class ReferenceService extends AIOSAppService {
  static volatile AIOSSession active;
  static volatile String status="等待 AIOS 连接", lastEvent="", result="", sessionId="";
  protected String trustedHostPackage(){return "local.aios.glass";}
  protected String trustedHostCertificate(){return BuildIdentity.HOST_CERTIFICATE;}
  protected int supportedProtocol(){return BuildIdentity.PROTOCOL;}
  private void record(String key,String value){getSharedPreferences("reference",0).edit().putString(key,value).apply();}
  protected void onAIOSReady(AIOSSession session,JSONObject state) throws Exception {
    active=session;sessionId=session.getId();status="已连接 AIOS";record("session",sessionId);record("ready",state.toString());
    try {session.subscribe("device.battery","device.connection","input.action");}
    catch(SecurityException denied){result=denied.getMessage();record("result",result);}
  }
  protected void onAIOSEvent(AIOSSession session,JSONObject event) throws Exception {
    lastEvent=event.toString();record("event",lastEvent);
    if(event.optString("type").equals("event") && event.optString("event").equals("device.battery")) {
      int battery=event.getJSONObject("data").getInt("level");
      record("battery",String.valueOf(battery));
      try {session.present(new AIOSPresentation("battery", AIOSPresentation.DEVELOPER_MANAGED).text("battery-text",0,0,640,150,"AIOS Native · 电量 "+battery+"%"));}
      catch(SecurityException denied){result=denied.getMessage();record("result",result);}
    }
    if(event.optString("type").equals("event") && event.optString("event").equals("input.action")) {
      record("action",event.getJSONObject("data").toString());
      session.present(new AIOSPresentation("action",AIOSPresentation.HYBRID).duration(60000)
        .content("AIOS Native", "操作："+event.getJSONObject("data").optString("action"))
        .text("action-text",0,0,640,150,"AIOS Native · 操作"));
    }
    if(event.optString("type").equals("permission_changed")) {
      // Repeat exactly the same public request after consent changes.
      try {session.present("AIOS Native · 权限变更后请求");result="accepted";}
      catch(SecurityException denied){result="denied: "+denied.getMessage();}
      record("permissionRequest",result);
      try {
        session.present(new AIOSPresentation("permission",AIOSPresentation.DEVELOPER_MANAGED)
          .text("permission-text",0,0,640,150,"AIOS Native · 场景权限检查"));
        record("scenePermissionRequest","accepted");
      } catch(SecurityException denied){record("scenePermissionRequest","denied: "+denied.getMessage());}
    }
    if(event.optString("type").equals("capabilities_changed") && event.optJSONObject("permissions") != null && event.getJSONObject("permissions").optBoolean("DEVICE_STATE")) session.subscribe("device.battery","device.connection","input.action");
    if(event.optString("type").equals("result")){
      result=event.toString();record("result",result);
      if(event.optJSONObject("data")!=null && event.getJSONObject("data").has("status")) record("presentation",result);
    }
  }
  protected void onAIOSStopped(String reason){active=null;status="已断开："+reason;record("stopped",reason);}
  protected void onAIOSError(Exception error){super.onAIOSError(error);result=error.toString();record("error",result);}
}
