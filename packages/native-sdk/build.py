#!/usr/bin/env python3
"""Build the public AAR with an installed Android SDK and JDK 17; no Host source required."""
from pathlib import Path
import argparse,os,subprocess,shutil,zipfile
p=argparse.ArgumentParser();p.add_argument('--sdk',default=os.environ.get('ANDROID_HOME'));p.add_argument('--output',default='dist/aios-native-sdk-1.0.0.aar');a=p.parse_args()
ROOT=Path(__file__).resolve().parent;SDK=Path(a.sdk);TOOLS=SDK/'build-tools/36.0.0';ANDROID=SDK/'platforms/android-35/android.jar'
WORK=ROOT/'build';shutil.rmtree(WORK,ignore_errors=True)
for name in ['generated','classes']:(WORK/name).mkdir(parents=True)
def run(args):subprocess.run([str(x) for x in args],check=True,cwd=ROOT)
for f in (ROOT/'src/main/aidl').rglob('*.aidl'):run([TOOLS/'aidl',f'-p{SDK}/platforms/android-35/framework.aidl',f'-I{ROOT}/src/main/aidl',f'-o{WORK}/generated',f])
run(['javac','-source','8','-target','8','-cp',ANDROID,'-d',WORK/'classes',*list((ROOT/'src/main/java').rglob('*.java')),*list((WORK/'generated').rglob('*.java'))])
run(['jar','cf',WORK/'classes.jar','-C',WORK/'classes','.'])
out=Path(a.output).resolve();out.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 z.write(WORK/'classes.jar','classes.jar')
 z.write(ROOT/'LICENSE','META-INF/LICENSE')
 z.writestr('META-INF/NOTICE','AIOS Glass Native SDK. Apache-2.0.\nPart of the AIOS Glass project, which derives from MentraOS.\nUpstream: https://github.com/Mentra-Community/MentraOS\nBaseline: 5ae6d6bf777ef7343c4c7d16d6145404d619e2de\n')
 z.writestr('AndroidManifest.xml','<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="local.aios.glass.sdk"><uses-sdk android:minSdkVersion="28"/></manifest>')
 for f in (ROOT/'src/main/aidl').rglob('*.aidl'):z.write(f,'aidl/'+str(f.relative_to(ROOT/'src/main/aidl')))
print(out)
