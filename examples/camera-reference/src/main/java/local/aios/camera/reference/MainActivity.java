package local.aios.camera.reference;
import android.app.Activity;
import android.os.Bundle;
import android.widget.*;
public final class MainActivity extends Activity {
  protected void onCreate(Bundle state){super.onCreate(state);
    LinearLayout layout=new LinearLayout(this);layout.setOrientation(1);layout.setPadding(32,48,32,32);
    TextView text=new TextView(this);text.setText("AIOS Native Camera\n"+ReferenceService.status);text.setTextSize(22);layout.addView(text);
    Button photo=new Button(this);photo.setText("拍照并读取");layout.addView(photo);
    photo.setOnClickListener(v->{try{ReferenceService.capture();text.setText(ReferenceService.status);}catch(Exception error){text.setText(error.toString());}});
    Button refresh=new Button(this);refresh.setText("刷新结果");layout.addView(refresh);refresh.setOnClickListener(v->text.setText(ReferenceService.status));setContentView(layout);
  }
}
