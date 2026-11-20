package local.aios.bluetooth.audio.reference;

import local.aios.glass.sdk.*;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.FileOutputStream;
import java.util.concurrent.ConcurrentHashMap;
import android.os.Handler;
import android.os.Looper;

/** Bounded physical-audio consumer, built only against the public AIOS Native SDK. */
public final class ReferenceService extends AIOSAppService {
  static volatile ReferenceService current;
  static volatile String status="等待 AIOS 连接";
  private AIOSSession session;
  private final Handler timer=new Handler(Looper.getMainLooper());
  private final ByteArrayOutputStream pcm=new ByteArrayOutputStream();
  private final AudioTiming timing=new AudioTiming();
  private final ConcurrentHashMap<String,String> requests=new ConcurrentHashMap<>();
  private boolean recording;
  private int chunks,lc3Chunks,lc3Bytes,offset;
  private String stream;
  private byte[] playback;
  private final Runnable finish=()->{try{finishRecording();}catch(Exception e){fail(e);}};
  protected String trustedHostPackage(){return "local.aios.glass";}
  protected String trustedHostCertificate(){return BuildIdentity.HOST_CERTIFICATE;}
  protected int supportedProtocol(){return BuildIdentity.PROTOCOL;}
  private void save(String key,Object value){getSharedPreferences("reference",0).edit().putString(key,String.valueOf(value)).apply();}
  private void fail(Exception e){status=e.toString();save("error",status);}
  protected void onAIOSReady(AIOSSession s,JSONObject state)throws Exception {
    current=this;session=s;status="已连接，可以开始录音";save("ready",state);s.subscribe("microphone.health");
  }
  synchronized void begin()throws Exception {
    if(recording)return;
    if(session==null)throw new IllegalStateException("尚未连接");
    pcm.reset();chunks=0;lc3Chunks=0;lc3Bytes=0;recording=true;status="正在录音，请说话（15 秒）";
    save("startedAt",System.currentTimeMillis());
    timing.start(android.os.SystemClock.elapsedRealtimeNanos());
    session.subscribe("microphone.audio","microphone.lc3","microphone.health");timer.postDelayed(finish,15000);
  }
  synchronized void finishRecording()throws Exception {
    timer.removeCallbacks(finish);recording=false;
    if(session!=null)session.subscribe("microphone.health");
    byte[] data=pcm.toByteArray();
    try(FileOutputStream file=openFileOutput("captured.pcm",0)){file.write(data);}
    save("chunks",chunks);save("bytes",data.length);save("finishedAt",System.currentTimeMillis());
    save("lc3Chunks",lc3Chunks);save("lc3Bytes",lc3Bytes);
    JSONObject measured=new JSONObject();
    measured.put("firstPacketMs",timing.firstPacketMs()==null?JSONObject.NULL:timing.firstPacketMs());
    measured.put("callbackSpanMs",timing.callbackSpanMs()==null?JSONObject.NULL:timing.callbackSpanMs());
    measured.put("chunks",timing.chunks);measured.put("bytes",timing.bytes);measured.put("audioDurationMs",timing.audioMs);
    measured.put("intervalsMs",new org.json.JSONArray(timing.intervalsMs));
    measured.put("spacingErrorMs",new org.json.JSONArray(timing.spacingErrorMs));
    measured.put("scope","Public Native SDK callback timing; packet loss and radio jitter are not directly observable.");
    save("timing",measured);
    status="录音结束："+chunks+" 块，"+data.length+" 字节";
  }
  synchronized void replay()throws Exception {
    if(recording)finishRecording();
    playback=pcm.toByteArray();offset=0;
    if(playback.length==0)throw new IllegalStateException("没有录到音频");
    requests.put(session.openAudioStream(16000,0.35),"open");status="正在回放";
  }
  void speak()throws Exception { requests.put(session.speak("你好，这是 AIOS 眼镜的本地语音测试。",0.35),"speak"); }
  protected synchronized void onAIOSEvent(AIOSSession s,JSONObject event)throws Exception {
    if("event".equals(event.optString("type"))) {
      JSONObject data=event.getJSONObject("data");
      if("microphone.audio".equals(event.optString("event")) && recording) {
        long arrived=android.os.SystemClock.elapsedRealtimeNanos();
        byte[] bytes=android.util.Base64.decode(data.getString("data"),android.util.Base64.DEFAULT);
        timing.packet(arrived,bytes.length,data.optInt("sampleRate",16000),1,2);
        if(pcm.size()+bytes.length<=640000){pcm.write(bytes);chunks++;}
        if(chunks==1)save("format",data.optInt("sampleRate")+"/"+data.optString("format"));
      } else if("microphone.lc3".equals(event.optString("event")) && recording) {
        lc3Chunks++;lc3Bytes+=android.util.Base64.decode(data.getString("data"),android.util.Base64.DEFAULT).length;
        if(lc3Chunks==1)save("lc3Format",data.toString());
      } else if("microphone.health".equals(event.optString("event"))) save("health",data);
      return;
    }
    if(!"result".equals(event.optString("type")))return;
    String op=requests.remove(event.optString("requestId"));if(op==null)return;
    save(op,event);
    if(!event.optBoolean("success")){status=event.toString();return;}
    if(op.equals("open"))stream=event.getJSONObject("data").getString("streamId");
    if(op.equals("open")||op.equals("write")) {
      if(offset<playback.length){int end=Math.min(offset+8192,playback.length);requests.put(s.writeAudioStream(stream,java.util.Arrays.copyOfRange(playback,offset,end)),"write");offset=end;}
      else requests.put(s.closeAudioStream(stream),"close");
    } else if(op.equals("close")) {status="回放完成";save("playedBytes",playback.length);}
    else if(op.equals("speak"))status="本地语音播放完成";
  }
  protected synchronized void onAIOSStopped(String reason){timer.removeCallbacks(finish);recording=false;session=null;current=null;status="已停止："+reason;save("stopped",reason);}
  protected void onAIOSError(Exception e){fail(e);}
}
