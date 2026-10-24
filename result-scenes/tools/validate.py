from pathlib import Path
import json,hashlib
P=Path(__file__).resolve().parents[1]
c=json.loads((P/'data/scenes.json').read_text(encoding='utf-8'))
s=(P/'data/scenes.js').read_text(encoding='utf-8').strip()
assert json.loads(s.removeprefix('window.PW_SCENES = ').removesuffix(';'))==c
assert c['classes']['druid']['defaultShot']==2
n=0
for v in c['classes'].values():
 assert 0<=v['defaultShot']<len(v['shots'])
 for shot in v['shots']:
  p=P/shot['scene'];assert p.is_file() and p.stat().st_size>0
  assert p.read_bytes()[:2]==b'\xff\xd8'
  for k in ['focal','origin']:assert all(0<=x<=1 for x in shot[k])
  for x,y,rx,ry in shot['faces']+shot['silhouettes']:assert 0<=x<=1 and 0<=y<=1 and 0<rx<1 and 0<ry<1
  n+=1
assert len(c['launchSequence'])==6
for step in c['launchSequence']:
 p=P/step['src'];assert p.is_file() and p.read_bytes()[:8]==b'\x89PNG\r\n\x1a\n'
 assert step['duration']>0
assert c['preprocessing']['toneTable']==sorted(c['preprocessing']['toneTable'])
assert all(0<=x<=1 for x in c['preprocessing']['toneTable'])
print(f'PASS: JSON/JS match; {n} scene files; druid defaults to screenshot 3; coordinates valid.')
