import json,sys
r=json.load(open(sys.argv[1]))
for w,screens in r.items():
  print("== width",w,"errors:",len(screens.get('errors',[])))
  for name,e in screens.items():
    if name=='errors': continue
    if name.endswith('-error'): print(f"  {name}: {e[:90]}"); continue
    segs=e['segments']; p=[s['probe'] for s in segs]
    st=max(x['smallTargets'] for x in p); tx=max(x['smallText'] for x in p)
    sizes=sorted({s for x in p for s in x['smallTextSizes']})
    ov=any(x['docOverflow'] or x['overflowing'] for x in p)
    c=p[0]['chrome']; pr=p[0]['primary']
    print(f"  {name:28} scrollH={e['scrollHeight']} client={e['clientHeight']} small<44={st:3} text<13={tx:3} sizes={sizes[:4]} overflow={ov} top={c['topbar']} nav={c['bottomnav']} foot={c['stickyFoot'] or c['sheetFoot']} primary={pr['label'][:22]+'@'+str(pr['top']) if pr else '-'}")
