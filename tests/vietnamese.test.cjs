const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const root=path.resolve(__dirname,'..');
const context=vm.createContext({window:{},document:{documentElement:{lang:'vi'},createElement:()=>({getContext:()=>({measureText:()=>({width:100})})})},console,Intl,URL,Map,Set,TextEncoder,TextDecoder,performance:{now:()=>0}});
for(const file of fs.readdirSync(path.join(root,'src')).filter(f=>f.endsWith('.js')&&f!=='12_ui.js').sort()) vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),context,{filename:file});
for(const file of ['app/english.js','app/vietnamese.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const J=context.window.J, parts=JSON.parse(fs.readFileSync(path.join(root,'app/vietnamese-parts.json'),'utf8'));
let labels=0, plans=0;
for(const g of J.GROUP_KEYS) for(const id of J.order(g)) {
 assert.ok(parts[g][id],`Missing translation ${g}.${id}`);
 assert.equal(J.registry(g)[id].name,parts[g][id]); labels++;
}
assert.equal(labels,860);
for(const text of ['Tiếng Việt đậm đà','Đường về quê hương','Anh yêu em','Tôi vẫn nhớ','Ước mơ và nắng', 'Tiếng Việt'.normalize('NFD')]) assert.equal(J.detectLang(text),'vi',text);
for(const [text,lang] of [['Hello world','en'],['夜明けの色を','ja'],['사랑 노래','ko']]) assert.equal(J.detectLang(text),lang);
assert.equal(J.resolveLang({lang:'vi',lyrics:'khong dau'}),'vi');
J.setLang('vi'); assert.equal(J.segLocale(),'vi');
for(const id of Object.keys(J.FONTS)) {const face=J.faceOf(id); assert.ok(J.LOCAL_FONT_FAMILIES.has(face.family.replaceAll('"','')),id); assert.ok(!face.gf,id);}
assert.ok(J.varFontCSS('gothic_bold',100,0.5).includes('"Noto Sans"'));
assert.ok(J.varFontCSS('mincho',100,0.5).includes('"Noto Serif"'));
const fixture='Đường về quê hương\nTiếng Việt đậm đà, ước mơ sáng ngời!';
assert.equal(JSON.stringify(J.parseLyrics(fixture)),JSON.stringify(J.parseLyrics(fixture.normalize('NFD'))));
for(const style of J.STYLE_ORDER) for(const aspect of ['16:9','9:16','1:1']) {
 const p=Object.assign(J.defaultProject(),{lang:'vi',lyrics:fixture,style,aspect,seed:42});
 const a=J.plan(p), b=J.plan(p); assert.equal(JSON.stringify(a),JSON.stringify(b));
 assert.equal(a.lang,'vi'); assert.ok(a.cuts.length); plans++;
}
for(const g of J.GROUP_KEYS) for(const id of J.order(g)) {
 const p=J.previewPlan(Object.assign(J.defaultProject(),{lang:'vi'}),g,id); assert.equal(p.lang,'vi');
 for(const cut of p.cuts) assert.ok(!/[\u3040-\u30ff\u4e00-\u9fff]/u.test(cut.text),`${g}.${id}`);
}
for(const file of ['index.html','en/index.html','vi/index.html']) {
 const html=fs.readFileSync(path.join(root,file),'utf8');
 for(const [,script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script,{filename:file});
 assert.ok(html.includes('data:font/ttf;base64,'));
}
console.log(JSON.stringify({status:'PASS',effectLabels:labels,deterministicStyleAspectPlans:plans,languageDetection:'PASS',unicodeNFC_NFD:'PASS',localFontMapping:'PASS',effectPreviewLanguage:'PASS',builtJavaScript:'PASS'},null,2));
