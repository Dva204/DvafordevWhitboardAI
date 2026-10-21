import json,os,subprocess
from pathlib import Path
engine=Path(r'D:\TestTTS\_whiteboard_engine_lab\.venv\Scripts\whiteboard.exe')
dest=Path(r'D:\TestTTS\DvaForDev_TTS_Dev\Apps\WhiteboardStudioNext\src\engine-catalog.json')
env=dict(os.environ,PYTHONIOENCODING='utf-8')
commands=['doctor','list-hands','list-styles','recommend-styles','plan-script','analyze-image','normalize-lineart','extract-lineart','render-photo','render-image','compose','run']
payload={'commands':{},'styles':[],'hands':[]}
for command in commands:
 p=subprocess.run([str(engine),command,'--help'],capture_output=True,encoding='utf-8',errors='replace',env=env)
 payload['commands'][command]={'help':p.stdout,'exitCode':p.returncode}
for name,args in [('styles',['list-styles','--json']),('hands',['list-hands'])]:
 p=subprocess.run([str(engine),*args],capture_output=True,encoding='utf-8',errors='replace',env=env)
 if p.returncode==0:
  try:payload[name]=json.loads(p.stdout) if name=='styles' else p.stdout.splitlines()
  except ValueError: pass
dest.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
print('Commands:',len(payload['commands']),'styles:',len(payload['styles']),'hands:',len(payload['hands']),'bytes:',dest.stat().st_size)
