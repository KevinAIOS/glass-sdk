package local.aios.bluetooth.audio.reference;

import android.app.Activity;
import android.os.*;
import android.widget.*;

public final class MainActivity extends Activity {
  private final Handler timer=new Handler();
  private TextView state;
  private final Runnable refresh=new Runnable(){public void run(){String next=ReferenceService.status;if(!next.contentEquals(state.getText()))state.setText(next);timer.postDelayed(this,500);}};
  interface Action {void run(ReferenceService service)throws Exception;}
  private void button(LinearLayout body,String label,Action action){
    Button b=new Button(this);b.setText(label);body.addView(b);
    b.setOnClickListener(v->{try{ReferenceService service=ReferenceService.current;if(service==null)throw new IllegalStateException("请先在 AIOS 中启用并启动本应用");action.run(service);}catch(Exception e){ReferenceService.status=e.getMessage();}});
  }
  public void onCreate(Bundle saved){
    super.onCreate(saved);
    LinearLayout body=new LinearLayout(this);body.setOrientation(1);body.setPadding(32,100,32,32);setContentView(body);
    TextView title=new TextView(this);title.setText("AIOS 蓝牙音频验证");title.setTextSize(26);body.addView(title);
    button(body,"录音 15 秒",s->s.begin());button(body,"结束录音",s->s.finishRecording());
    button(body,"回放录音",s->s.replay());button(body,"播放本地语音",s->s.speak());
    state=new TextView(this);state.setTextSize(18);body.addView(state);
  }
  protected void onResume(){super.onResume();timer.post(refresh);}
  protected void onPause(){timer.removeCallbacks(refresh);super.onPause();}
}
