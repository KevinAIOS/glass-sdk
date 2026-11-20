package local.aios.bluetooth.audio.reference;

import java.util.ArrayList;
import java.util.List;

/** Callback timing only. A gap is not proof of radio packet loss. Stores no audio samples. */
public final class AudioTiming {
  private long started, first, previous;
  private double previousAudioMs;
  public int chunks;
  public long bytes;
  public double audioMs;
  public final List<Double> intervalsMs = new ArrayList<>();
  public final List<Double> spacingErrorMs = new ArrayList<>();

  public void start(long nanos) {
    started=nanos;first=0;previous=0;previousAudioMs=0;chunks=0;bytes=0;audioMs=0;
    intervalsMs.clear();spacingErrorMs.clear();
  }

  public void packet(long nanos,int size,int sampleRate,int channels,int bytesPerSample) {
    if(size<=0 || sampleRate<=0 || channels<=0 || bytesPerSample<=0 || nanos<started || (chunks>0 && nanos<previous)) return;
    double durationMs=1000.0*size/sampleRate/channels/bytesPerSample;
    if(chunks==0) first=nanos;
    else if(intervalsMs.size()<2048) {
      double interval=(nanos-previous)/1_000_000.0;
      intervalsMs.add(interval);
      spacingErrorMs.add(interval-previousAudioMs);
    }
    previous=nanos;previousAudioMs=durationMs;chunks++;bytes+=size;audioMs+=durationMs;
  }

  public Double firstPacketMs(){return chunks==0?null:(first-started)/1_000_000.0;}
  public Double callbackSpanMs(){return chunks==0?null:(previous-first)/1_000_000.0;}
}
