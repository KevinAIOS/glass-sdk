#!/usr/bin/env python3
"""Standalone reference build. Inputs: public SDK AAR, Android SDK, Host certificate and your signing key."""
from pathlib import Path
import argparse,subprocess,zipfile,shutil,os,re
p=argparse.ArgumentParser();p.add_argument('--sdk',default=os.environ.get('ANDROID_HOME'));p.add_argument('--aios-sdk',required=True);p.add_argument('--host-certificate',required=True);p.add_argument('--keystore',required=True);p.add_argument('--key-alias',default='androiddebugkey');p.add_argument('--password-env',default='AIOS_REFERENCE_KEY_PASSWORD');p.add_argument('--output',default='dist/aios-native-reference.apk');a=p.parse_args()
assert re.fullmatch('[0-9a-f]{64}',a.host_certificate),'Expected Host signing certificate SHA-256'
ROOT=Path(__file__).resolve().parent;WORK=ROOT/'build';SDK=Path(a.sdk);TOOLS=SDK/'build-tools/36.0.0';ANDROID=SDK/'platforms/android-35/android.jar'
shutil.rmtree(WORK,ignore_errors=True)
for d in ['classes','dex','generated']:(WORK/d).mkdir(parents=True)
def run(args):subprocess.run([str(x) for x in args],check=True,cwd=ROOT)
with zipfile.ZipFile(a.aios_sdk) as z:(WORK/'sdk.jar').write_bytes(z.read('classes.jar'))
(WORK/'generated/BuildIdentity.java').write_text('package local.aios.audio.reference; public final class BuildIdentity { public static final String HOST_CERTIFICATE="'+a.host_certificate+'"; public static final int PROTOCOL=1; }')
run(['javac','-source','8','-target','8','-cp',str(ANDROID)+os.pathsep+str(WORK/'sdk.jar'),'-d',WORK/'classes',*list((ROOT/'src/main/java').rglob('*.java')),WORK/'generated/BuildIdentity.java'])
run(['jar','cf',WORK/'reference.jar','-C',WORK/'classes','.'])
run([TOOLS/'d8','--min-api','28','--lib',ANDROID,'--output',WORK/'dex',WORK/'sdk.jar',WORK/'reference.jar'])
run([TOOLS/'aapt2','link','-I',ANDROID,'--manifest',ROOT/'AndroidManifest.xml','-o',WORK/'unsigned.apk'])
with zipfile.ZipFile(WORK/'unsigned.apk','a') as z:z.write(WORK/'dex/classes.dex','classes.dex')
run([TOOLS/'zipalign','-f','4',WORK/'unsigned.apk',WORK/'aligned.apk'])
out=Path(a.output).resolve();out.parent.mkdir(parents=True,exist_ok=True)
run([TOOLS/'apksigner','sign','--ks',Path(a.keystore).resolve(),'--ks-key-alias',a.key_alias,'--ks-pass','env:'+a.password_env,'--key-pass','env:'+a.password_env,'--out',out,WORK/'aligned.apk'])
run([TOOLS/'apksigner','verify',out]);print(out)
