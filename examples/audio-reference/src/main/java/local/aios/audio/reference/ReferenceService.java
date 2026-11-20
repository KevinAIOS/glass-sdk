package local.aios.audio.reference;
import local.aios.glass.sdk.*;
import org.json.JSONObject;
import java.util.HashMap;

/** Independent audio consumer. Only the public AAR is required to build this app. */
public final class ReferenceService extends AIOSAppService {
  static volatile AIOSSession active;
  static volatile String status="等待 AIOS 连接",lastEvent="",result="",sessionId="";
  private final java.util.concurrent.ConcurrentHashMap<String,String> pending=new java.util.concurrent.ConcurrentHashMap<>();
  static volatile ReferenceService current;
  static void beginOutput() throws Exception {ReferenceService service=current;if(service==null||active==null)throw new IllegalStateException("Not connected");service.pending.put(active.speak("你好，这是本地语音测试。",0.35),"speaker.speak");}
  private final HashMap<String,Integer> counts=new HashMap<>();
  private String streamId;
  private int writes;
  private boolean outputStarted;
  protected String trustedHostPackage(){return "local.aios.glass";}
  protected String trustedHostCertificate(){return BuildIdentity.HOST_CERTIFICATE;}
  protected int supportedProtocol(){return BuildIdentity.PROTOCOL;}
  private void record(String key,String value){getSharedPreferences("reference",0).edit().putString(key,value).apply();}
  private void request(AIOSSession s,String op,JSONObject data)throws Exception {pending.put(s.request(op,data),op);}
  protected void onAIOSReady(AIOSSession s,JSONObject state)throws Exception {
    current=this;active=s;sessionId=s.getId();status="已连接 AIOS";record("session",sessionId);record("ready",state.toString());
    s.subscribe("microphone.audio","microphone.lc3","microphone.health","microphone.vad","transcription","notification.posted","notification.dismissed","input.action");
    request(s,"storage.set",AIOSSession.fields("key","independent","value","native-local"));
  }
  protected void onAIOSEvent(AIOSSession s,JSONObject event)throws Exception {
    lastEvent=event.toString();record("event",lastEvent);
    if(event.optString("type").equals("permission_changed")){record("permission-changed",lastEvent);return;}
    if(event.optString("type").equals("event")) {
      String name=event.optString("event");JSONObject data=event.getJSONObject("data");
      int count=counts.containsKey(name)?counts.get(name)+1:1;counts.put(name,count);record(name+".count",String.valueOf(count));
      if(name.equals("transcription")){record(data.optBoolean("isFinal")?"final":"partial",data.toString());status=data.optString("text");}
      else if(name.equals("microphone.audio")||name.equals("microphone.lc3")){if(count==1)record(name,data.toString());}
      else record(name,data.toString());
      if(name.equals("microphone.health") && data.optString("reason").equals("consumer_overflow"))record("consumer-overflow",data.toString());
      // Exercise bounded SDK delivery with a deliberately slow consumer.
      if(name.equals("microphone.audio") && count==1)Thread.sleep(3000);
      if(name.equals("input.action")&&!outputStarted&&data.optString("action").equals("activate")) {
        outputStarted=true;pending.put(s.speak("你好，这是本地语音测试。",0.35),"speaker.speak");
      }
      return;
    }
    if(!event.optString("type").equals("result"))return;
    String op=pending.remove(event.optString("requestId"));if(op==null)return;
    record(op,event.toString());result=event.toString();if(!event.optBoolean("success"))return;
    JSONObject data=event.optJSONObject("data");
    switch(op){
      case "storage.set": request(s,"storage.get",AIOSSession.json("key","independent"));break;
      case "storage.get": request(s,"settings.set",AIOSSession.fields("key","volume","value",0.35));break;
      case "settings.set": request(s,"settings.get",AIOSSession.json("key","volume"));break;
      case "settings.get": request(s,"blob.create",AIOSSession.fields("key","test","mimeType","application/octet-stream"));break;
      case "blob.create": request(s,"blob.write",AIOSSession.fields("key","test","base64","AQIDBA=="));break;
      case "blob.write": request(s,"blob.commit",AIOSSession.json("key","test"));break;
      case "blob.commit": request(s,"blob.openRead",AIOSSession.json("key","test"));break;
      case "blob.openRead": request(s,"blob.read",AIOSSession.fields("handle",data.getString("handle"),"maxBytes",8192));break;
      case "blob.read": request(s,"location.get",new JSONObject());break;
      case "speaker.speak": pending.put(s.openAudioStream(16000,0.2),"speaker.stream.open");break;
      case "speaker.stream.open": streamId=data.getString("streamId");writeTone(s);break;
      case "speaker.stream.write": if(++writes<12)writeTone(s);else pending.put(s.closeAudioStream(streamId),"speaker.stream.close");break;
      case "speaker.stream.close": pending.put(s.openAudioStream(16000,0.2),"abort.open");break;
      case "abort.open": streamId=data.getString("streamId");pending.put(s.writeAudioStream(streamId,new byte[8192]),"abort.write");break;
      case "abort.write": pending.put(s.abortAudioStream(streamId),"speaker.stream.abort");break;
      case "speaker.stream.abort": record("output-complete","true");break;
      default: break;
    }
  }
  private void writeTone(AIOSSession s)throws Exception {
    byte[] pcm=new byte[8192];for(int i=0;i<pcm.length/2;i++){short sample=(short)(Math.sin(2*Math.PI*440*(i+writes*4096)/16000)*5000);pcm[2*i]=(byte)sample;pcm[2*i+1]=(byte)(sample>>8);}
    pending.put(s.writeAudioStream(streamId,pcm),"speaker.stream.write");
  }
  protected void onAIOSStopped(String reason){active=null;status="已断开："+reason;record("stopped",reason);}
  protected void onAIOSError(Exception error){super.onAIOSError(error);record("error",error.toString());}
}
