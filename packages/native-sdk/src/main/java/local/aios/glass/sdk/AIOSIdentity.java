package local.aios.glass.sdk;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import java.security.MessageDigest;

/** Identity always comes from Android; shared UIDs and multiple signers are rejected. */
public final class AIOSIdentity {
  private AIOSIdentity() {}
  public static String certificate(Context context, String packageName) {
    try {
      PackageInfo info = context.getPackageManager().getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES);
      if (info.signingInfo == null || info.signingInfo.getApkContentsSigners().length != 1)
        throw new SecurityException("AMBIGUOUS_SIGNER");
      byte[] digest = MessageDigest.getInstance("SHA-256").digest(info.signingInfo.getApkContentsSigners()[0].toByteArray());
      StringBuilder result = new StringBuilder();
      for (byte b : digest) result.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
      return result.toString();
    } catch (Exception error) { throw new SecurityException("INVALID_CERTIFICATE", error); }
  }
  public static void verify(Context context, int uid, String packageName, String certificate) {
    String[] names = context.getPackageManager().getPackagesForUid(uid);
    if (names == null || names.length != 1 || !packageName.equals(names[0]))
      throw new SecurityException("CALLER_IDENTITY_MISMATCH");
    if (!certificate(context, packageName).equals(certificate)) throw new SecurityException("CERTIFICATE_MISMATCH");
  }
}
