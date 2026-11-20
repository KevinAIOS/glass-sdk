package local.aios.audio.reference;
import android.app.*;
import android.os.*;
import android.content.*;
import android.content.res.Configuration;
import android.graphics.Color;
import android.view.*;
import android.widget.*;
import local.aios.glass.sdk.AIOSSession;

public final class MainActivity extends Activity {
  private final Handler handler=new Handler();private TextView state;
  private final Runnable update=new Runnable(){public void run(){state.setText(ReferenceService.status+"\n\n"+ReferenceService.result);handler.postDelayed(this,500);}};
  public void onCreate(Bundle saved){
    boolean dark=(getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)==Configuration.UI_MODE_NIGHT_YES;
    setTheme(dark ? android.R.style.Theme_Material_NoActionBar : android.R.style.Theme_Material_Light_NoActionBar);
    super.onCreate(saved);
    int background=dark ? Color.rgb(24,28,26) : Color.rgb(244,245,242);
    int ink=dark ? Color.rgb(233,237,234) : Color.rgb(29,33,31);
    ScrollView scroll=new ScrollView(this);LinearLayout body=new LinearLayout(this);body.setOrientation(1);int pad=(int)(24*getResources().getDisplayMetrics().density);body.setPadding(pad,pad,pad,pad);body.setBackgroundColor(background);scroll.setBackgroundColor(background);scroll.addView(body);setContentView(scroll);
    scroll.setOnApplyWindowInsetsListener((v,insets)->{
      if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());v.setPadding(bars.left,bars.top,bars.right,bars.bottom);}
      else v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
      return insets;
    });scroll.requestApplyInsets();
    getWindow().getDecorView().setSystemUiVisibility(dark ? 0 : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
    TextView title=new TextView(this);title.setText("AIOS Audio");title.setTextSize(30);title.setTextColor(ink);body.addView(title);
    TextView note=new TextView(this);note.setText("独立 Android 示例应用\n请在 AIOS 中启用，并授予麦克风权限。");note.setTextSize(16);note.setTextColor(ink);note.setPadding(0,pad,0,pad);body.addView(note);
    Button open=new Button(this);open.setText("打开 AIOS");body.addView(open);open.setOnClickListener(v->{Intent launch=getPackageManager().getLaunchIntentForPackage("local.aios.glass");if(launch!=null)startActivity(launch);else new AlertDialog.Builder(this).setMessage("请先安装 AIOS Host").setPositiveButton("知道了",null).show();});
    Button present=new Button(this);present.setText("播放本地语音");body.addView(present);present.setOnClickListener(v->new Thread(()->{try{AIOSSession s=ReferenceService.active;if(s==null)throw new IllegalStateException("尚未连接");ReferenceService.beginOutput();}catch(Exception e){ReferenceService.result=e.getMessage();}}).start());
    state=new TextView(this);state.setTextSize(16);state.setTextColor(ink);state.setPadding(0,pad,0,pad);body.addView(state);
  }
  protected void onResume(){super.onResume();handler.post(update);}
  protected void onPause(){handler.removeCallbacks(update);super.onPause();}
}
