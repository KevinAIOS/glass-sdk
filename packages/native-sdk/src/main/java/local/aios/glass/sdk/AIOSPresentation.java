package local.aios.glass.sdk;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONException;

/** Serializable scene builder. No Android View or executable object crosses Binder. */
public final class AIOSPresentation {
  public static final String DEVELOPER_MANAGED = "developer_managed";
  public static final String AIOS_MANAGED = "aios_managed";
  public static final String HYBRID = "hybrid";
  private final JSONObject value = new JSONObject();
  private final JSONArray elements = new JSONArray();
  public AIOSPresentation(String id, String mode) {
    put(value, "schema_version", 1); put(value, "id", id); put(value, "mode", mode);
    put(value, "elements", elements);
  }
  public AIOSPresentation content(String title, String text) {
    JSONObject content = new JSONObject(); put(content, "title", title); put(content, "text", text);
    put(value, "content", content); return this;
  }
  public AIOSPresentation duration(int milliseconds) {put(value, "durationMs", milliseconds); return this;}
  public AIOSPresentation urgent(boolean urgent) {put(value, "urgency", urgent ? "urgent" : "normal"); return this;}
  public AIOSPresentation text(String id, int x, int y, int width, int height, String text) {
    JSONObject element = element("text", id, x, y, width, height); put(element, "text", text); elements.put(element); return this;
  }
  public AIOSPresentation image(String id, int x, int y, int width, int height, String base64) {
    JSONObject element = element("image", id, x, y, width, height); put(element, "data", base64); elements.put(element); return this;
  }
  public AIOSPresentation rect(String id, int x, int y, int width, int height, int border, int radius) {
    JSONObject element = element("rect", id, x, y, width, height);
    JSONObject style = new JSONObject(); put(style, "border", border); put(style, "radius", radius);
    put(element, "style", style); elements.put(element); return this;
  }
  public JSONObject toJSON() {
    try {return new JSONObject(value.toString());} catch (JSONException error) {throw new IllegalArgumentException(error);}
  }
  private static JSONObject element(String type, String id, int x, int y, int width, int height) {
    JSONObject box = new JSONObject(); put(box,"x",x); put(box,"y",y); put(box,"w",width); put(box,"h",height);
    JSONObject element = new JSONObject(); put(element,"type",type); put(element,"id",id); put(element,"box",box); return element;
  }
  private static void put(JSONObject object, String key, Object value) {
    try {object.put(key,value);} catch (JSONException error) {throw new IllegalArgumentException(error);}
  }
}
