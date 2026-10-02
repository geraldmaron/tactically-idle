"""Rebuild the original Tactically Idle vector brand; uses system DejaVu Sans Condensed."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
import subprocess
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/brand'; OUT.mkdir(parents=True,exist_ok=True)
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf'
font=TTFont(FONT); glyphs=font.getGlyphSet(); cmap=font.getBestCmap(); upm=font['head'].unitsPerEm
NAVY='#0e1624'; AMBER='#f3b432'; CHALK='#f3f7ff'; BLUE='#1f55b8'; MUTED='#aab7ca'
def word(text,x,y,size,color,track=0):
    scale=size/upm; cur=0; parts=[]
    for c in text:
        glyph=glyphs[cmap[ord(c)]]; p=SVGPathPen(glyphs); glyph.draw(p)
        parts.append(f'<path d="{p.getCommands()}" transform="translate({x+cur:.3f},{y}) scale({scale},-{scale})"/>')
        cur+=glyph.width*scale+track
    return f'<g fill="{color}">'+''.join(parts)+'</g>'
def mark(ink=CHALK,accent=AMBER,bg=None):
    return (f'<rect width="100" height="100" rx="22" fill="{bg}"/>' if bg else '')+f'''<path d="M19 34V19h16M65 81h16V66" fill="none" stroke="{accent}" stroke-width="5" stroke-linecap="square"/><path d="M28 28h30v12H49v34H37V40h-9zM65 28h12v46H65z" fill="{ink}"/>'''
def svg(name,w,h,body):
    (OUT/name).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img"><title>Tactically Idle</title>{body}</svg>')
def group(x,y,scale,body):return f'<g transform="translate({x},{y}) scale({scale})">{body}</g>'
def lockup(color=CHALK,accent=AMBER):
    return group(0,0,.9,mark(color,accent))+word('TACTICALLY',110,42,42,color,.45)+word('IDLE',110,88,42,color,6)
for theme,ink,accent in [('dark',CHALK,AMBER),('light',NAVY,'#a96a00'),('mono-white',CHALK,CHALK),('mono-dark',NAVY,NAVY)]:
    svg(f'mark-{theme}.svg',100,100,mark(ink,accent))
    svg(f'header-lockup-{theme}.svg',408,96,lockup(ink,accent))
    svg(f'wordmark-{theme}.svg',544,68,word('TACTICALLY IDLE',0,52,52,ink,.3))
    svg(f'stacked-lockup-{theme}.svg',360,260,group(130,0,1,mark(ink,accent))+word('TACTICALLY',10,176,49,ink,.6)+word('IDLE',106,244,67,ink,5))
svg('mark.svg',100,100,mark())
svg('icon.svg',1024,1024,group(0,0,10.24,mark(CHALK,AMBER,NAVY)))
svg('icon-maskable.svg',1024,1024,f'<rect width="1024" height="1024" fill="{NAVY}"/>'+group(192,192,6.4,mark()))
svg('favicon.svg',32,32,group(0,0,.32,mark(CHALK,AMBER,NAVY)))
svg('loading-mark.svg',100,100,mark())
def floorplan(w,h):
    lines=''.join(f'<path d="M{x} 0v{h}"/>' for x in range(0,w,40))+''.join(f'<path d="M0 {y}h{w}"/>' for y in range(0,h,40))
    plan=f'<path d="M{w*.47} {h*.18}h{w*.40}v{h*.64}H{w*.35}v-{h*.36}h{w*.12}zM{w*.65} {h*.18}v{h*.34}h{w*.22}M{w*.35} {h*.67}h{w*.30}v{h*.15}"/>'
    return f'<g stroke="{CHALK}" stroke-width="1" opacity=".035">{lines}</g><g fill="none" stroke="{CHALK}" stroke-width="3" opacity=".065">{plan}</g>'
svg('social-card.svg',1200,630,f'<rect width="1200" height="630" fill="{NAVY}"/>'+floorplan(1200,630)+f'<rect x="64" y="62" width="50" height="7" fill="{AMBER}"/>'+group(90,183,2.5,lockup())+word('A TACTICAL MANAGEMENT GAME',90,505,25,MUTED,2))
svg('title-screen.svg',1200,800,f'<rect width="1200" height="800" fill="{NAVY}"/>'+floorplan(1200,800)+group(90,243,2.5,lockup())+f'<path d="M90 564h1020" stroke="{AMBER}" stroke-width="2"/>'+word('A TACTICAL MANAGEMENT GAME',90,615,25,MUTED,2))
svg('splash-mobile.svg',390,844,f'<rect width="390" height="844" fill="{NAVY}"/>'+floorplan(390,844)+group(117,229,1.56,mark())+word('TACTICALLY',48,453,43,CHALK,0)+word('IDLE',124,515,56,CHALK,3)+f'<path d="M151 569h88" stroke="{AMBER}" stroke-width="3"/>')
for size in [16,32,48,64,128,180,192,256,512,1024]:
    name='apple-touch-icon.png' if size==180 else f'icon-{size}.png'
    subprocess.run(['inkscape',str(OUT/'icon.svg'),f'--export-filename={OUT/name}',f'--export-width={size}',f'--export-height={size}'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
for name in ['social-card','title-screen','splash-mobile','header-lockup-dark','stacked-lockup-dark']:
    subprocess.run(['inkscape',str(OUT/f'{name}.svg'),f'--export-filename={OUT/f"{name}.png"}'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
subprocess.run(['magick',*[str(OUT/f'icon-{s}.png') for s in [16,32,48]],str(OUT/'favicon.ico')],check=True)
print('Brand vectors and raster exports built:',len(list(OUT.iterdir())))
body=f'<rect width="1600" height="1140" fill="{NAVY}"/>'+floorplan(1600,530)
body+=word('BRAND SYSTEM / 01',64,58,20,MUTED,3)+group(72,140,2.2,lockup())
body+=word('PLAN WITH INTENT. KEEP IT HUMAN.',75,436,20,MUTED,2)
body+=f'<rect x="1110" y="0" width="490" height="530" fill="{CHALK}"/>'+group(1237,112,2.36,mark(NAVY,'#a96a00'))+word('THE COMMAND MARK',1176,436,18,NAVY,1)
body+=f'<rect x="0" y="530" width="1600" height="610" fill="#e5eaf0"/>'
body+=word('CLEAR ON EVERY SURFACE',64,592,23,NAVY,1)
body+=f'<rect x="64" y="630" width="710" height="234" rx="18" fill="{NAVY}"/>'+group(115,687,1.4,lockup())
body+=f'<rect x="804" y="630" width="732" height="234" rx="18" fill="white"/>'+group(855,687,1.4,lockup(NAVY,'#a96a00'))
body+=word('DARK / PRIMARY',64,903,17,NAVY,1)+word('LIGHT / PRIMARY',804,903,17,NAVY,1)
colors=[('NAVY',NAVY),('CHALK',CHALK),('AMBER',AMBER),('BLUEPRINT',BLUE)]
for i,(name,c) in enumerate(colors):
 x=64+i*255;body+=f'<rect x="{x}" y="952" width="220" height="68" rx="8" fill="{c}" stroke="#c6cfda"/>'+word(name,x,1051,17,NAVY,1)+word(c.upper(),x,1083,15,'#526176',.4)
body+=group(1130,956,.93,mark(NAVY,NAVY))+group(1277,956,.93,mark(CHALK,CHALK,NAVY))+word('ONE-COLOR READY',1118,1090,17,NAVY,.7)
svg('brand-preview.svg',1600,1140,body)
subprocess.run(['inkscape',str(OUT/'brand-preview.svg'),f'--export-filename={OUT/"brand-preview.png"}'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
