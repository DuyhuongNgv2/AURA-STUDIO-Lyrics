"""Font glyph coverage and real Chrome Canvas regression checks, without extra packages.
Run: python tools/qa_vietnamese.py [--browser C:/path/to/chrome.exe]
Reports and isolated browser profile are written only inside .qa/.
"""
import argparse, hashlib, html, json, re, struct, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent

def font_codepoints(data):
    u16=lambda off:struct.unpack_from('>H',data,off)[0]
    u32=lambda off:struct.unpack_from('>I',data,off)[0]
    tables={data[12+i*16:16+i*16].decode('ascii'):u32(20+i*16) for i in range(u16(4))}
    cmap=tables['cmap']; result=set()
    for i in range(u16(cmap+2)):
        off=cmap+u32(cmap+4+i*8+4); fmt=u16(off)
        if fmt==12:
            for j in range(u32(off+12)):
                start,end,gid=struct.unpack_from('>III',data,off+16+j*12)
                result.update(range(start+(gid==0),end+1))
        elif fmt==4:
            n=u16(off+6)//2; ends=off+14; starts=ends+2*n+2; deltas=starts+2*n; ranges=deltas+2*n
            for j in range(n):
                for cp in range(u16(starts+2*j),min(u16(ends+2*j),65534)+1):
                    delta=u16(deltas+2*j); ro=u16(ranges+2*j)
                    gid=u16(ranges+2*j+ro+2*(cp-u16(starts+2*j))) if ro else (cp+delta)%65536
                    if gid:result.add(cp)
    return result

JS=r"""
(async()=>{
 const out={status:'RUNNING',fonts:[],effectCases:0,frames:0,styleFontAspectCases:0,errors:[],warnings:[],blankFrames:[]};
 const box=document.getElementById('results');
 const err=console.error,warn=console.warn;
 console.error=(...a)=>out.errors.push(a.map(String).join(' '));
 console.warn=(...a)=>out.warnings.push(a.map(String).join(' '));
 try {
  J.setLang('vi');
  const fixture='Đường về quê hương\nTiếng Việt đậm đà, ước mơ sáng ngời!';
  for(const f of ['Be Vietnam Pro','Montserrat','Lexend','Noto Sans','Noto Serif','Oswald']) {
   const loaded=await document.fonts.load('400 64px "'+f+'"',fixture);
   if(!loaded.length)throw Error('Font failed to load: '+f);
   out.fonts.push(f);
  }
  await J.ensureFonts(fixture, Object.keys(J.FONTS));
  const cv=document.getElementById('proof'),ctx=cv.getContext('2d'),renderer=new J.Renderer();
  function draw(plan,t){
   cv.width=Math.round(plan.W*0.2);cv.height=Math.round(plan.H*0.2);
   renderer.frame(ctx,plan,t,{scale:0.2});out.frames++;
  }
  for(const group of J.GROUP_KEYS){
   for(const id of J.order(group)){
    try{
     const plan=J.previewPlan(Object.assign(J.defaultProject(),{lang:'vi',style:'noir'}),group,id);
     for(const t of group==='fx'?[0.06,0.12,0.2]:group==='trans'?[0.2,1.3,2.2]:[0.15,1.2,2.2])draw(plan,t);
     out.effectCases++;
    }catch(e){out.errors.push(group+'.'+id+': '+e.stack);}
   }
   await new Promise(r=>setTimeout(r,0));
  }
  for(const style of J.STYLE_ORDER) for(const aspect of ['16:9','9:16','1:1']) for(const font of ['vi_be_bold','vi_montserrat','vi_lexend','vi_noto_sans','vi_noto_serif','vi_oswald']) {
   for(const lyrics of [fixture,fixture.normalize('NFD')]){
    try{
     const p=Object.assign(J.defaultProject(),{lang:'vi',lyrics,style,aspect,seed:73,fonts:{display:font,body:font,serif:font}});
     const plan=J.plan(p);
     for(const t of [0.25,1,Math.max(1,plan.duration-0.3)])draw(plan,t);
     out.styleFontAspectCases++;
    }catch(e){out.errors.push(style+' '+aspect+' '+font+': '+e.stack);}
   }
   await new Promise(r=>setTimeout(r,0));
  }
  out.status=out.errors.length?'FAIL':'PASS';
 }catch(e){out.status='FAIL';out.errors.push(e.stack);}
 console.error=err;console.warn=warn;
 box.textContent=JSON.stringify(out);document.title='QA '+out.status;
})();
"""

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--browser',default='C:/Program Files/Google/Chrome/Application/chrome.exe');args=parser.parse_args()
    qa=ROOT/'.qa';qa.mkdir(exist_ok=True)
    alphabet='AĂÂBCDĐEÊGHIKLMNOÔƠPQRSTUƯVXYaăâbcdđeêghiklmnoôơpqrstuưvxyàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ'
    chars=set(alphabet+alphabet.upper())
    fonts=[]
    for entry in json.loads((ROOT/'fonts/manifest.json').read_text(encoding='utf-8')):
        data=(ROOT/entry['path']).read_bytes();assert hashlib.sha256(data).hexdigest()==entry['sha256']
        missing=sorted(c for c in chars if ord(c) not in font_codepoints(data))
        fonts.append({'file':entry['path'],'missing':missing,'testedCharacters':len(chars)})
        assert not missing,(entry['path'],missing)
    page=(ROOT/'index.html').read_text(encoding='utf-8')
    styles='\n'.join(re.findall(r'<style>(.*?)</style>',page,re.S))
    scripts=re.findall(r'<script>(.*?)</script>',page,re.S)
    # The real UI is intentionally absent: only the engine and its locale scripts start.
    test='<!doctype html><html lang="vi"><meta charset="utf-8"><style>'+styles+'</style><title>QA running</title><pre id="results">RUNNING</pre><canvas id="proof"></canvas>'
    test+=''.join('<script>'+s+'</script>' for s in scripts)+'<script>'+JS+'</script></html>'
    target=qa/'render.html';target.write_text(test,encoding='utf-8')
    proc=subprocess.run([args.browser,'--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--host-resolver-rules=MAP * ~NOTFOUND','--user-data-dir='+str(qa/'chrome-profile'),'--virtual-time-budget=300000','--dump-dom',target.as_uri()],capture_output=True,timeout=300)
    dom=proc.stdout.decode('utf-8',errors='replace');found=re.search(r'<pre id="results">(.*?)</pre>',dom,re.S)
    assert found,'Chrome did not return a test report: '+proc.stderr.decode('utf-8',errors='replace')[-1000:]
    result=json.loads(html.unescape(found.group(1)));result['glyphCoverage']=fonts
    (qa/'vietnamese-report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k not in ('glyphCoverage',)},ensure_ascii=True,indent=2))
    print('Glyph coverage: PASS for',len(fonts),'files;',len(chars),'Vietnamese characters each.')
    sys.exit(0 if result['status']=='PASS' else 1)
if __name__=='__main__':main()
