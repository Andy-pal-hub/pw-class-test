"""Build a self-contained preview.html using only Python's standard library."""
from pathlib import Path
import base64,json
P=Path(__file__).resolve().parents[1]
c=json.loads((P/'data/scenes.json').read_text(encoding='utf-8'))
for v in c['classes'].values():
 for shot in v['shots']:shot['scene']='data:image/jpeg;base64,'+base64.b64encode((P/shot['scene']).read_bytes()).decode('ascii')
 v['scene']=v['shots'][v['defaultShot']]['scene']
for step in c.get('launchSequence',[]):step['src']='data:image/png;base64,'+base64.b64encode((P/step['src']).read_bytes()).decode('ascii')
html=(P/'index.html').read_text(encoding='utf-8')
html=html.replace('<link rel="stylesheet" href="scene.css">','<style>'+(P/'scene.css').read_text(encoding='utf-8')+'</style>')
for file,text in [('data/scenes.js','window.PW_SCENES='+json.dumps(c,ensure_ascii=False)+';'),('soundscape.js',(P/'soundscape.js').read_text(encoding='utf-8')),('scene-engine.js',(P/'scene-engine.js').read_text(encoding='utf-8')),('demo.js',(P/'demo.js').read_text(encoding='utf-8'))]:html=html.replace(f'<script src="{file}"></script>','<script>'+text+'</script>')
(P/'preview.html').write_text(html,encoding='utf-8')
print('Built self-contained preview.html')
