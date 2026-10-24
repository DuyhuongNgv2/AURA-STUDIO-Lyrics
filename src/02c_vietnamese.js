/* Vietnamese lyric fonts and language support. Fonts are embedded by build.py. */
(() => {
'use strict';
J.LANGS.push('vi');
J.LANG_LABEL.vi = 'Tiếng Việt';
const originalDetect = J.detectLang;
J.detectLang = text => {
 const s = String(text || '').normalize('NFC');
 const l = originalDetect(s);
 return (l === 'en' || l === 'ja') && /[ăâđêôơư\u1ea0-\u1ef9]/i.test(s) && !/[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/u.test(s) ? 'vi' : l;
};
const fbSans='"Be Vietnam Pro","Noto Sans",Arial,sans-serif';
const fbSerif='"Noto Serif",Georgia,serif';
const F=(family,weight)=>({family,weight});
const map={};
for (const [key,f] of Object.entries(J.FONTS)) {
 const serif=['mincho','brush','hand'].includes(f.kind);
 const family=serif?'Noto Serif':f.kind==='round'?'Lexend':f.kind==='display'?'Montserrat':f.kind==='pixel'?'Oswald':'Be Vietnam Pro';
 const weight=family==='Be Vietnam Pro'?(f.weight>=800?900:f.weight>=600?700:400):family==='Oswald'?Math.min(700,f.weight):f.weight;
 map[key]=F(family,weight);
}
J.LANG_FACES.vi={sans:F('Be Vietnam Pro',400),serif:F('Noto Serif',400),fbSans,fbSerif,map};
const extra={vi_be_regular:['Be Vietnam Pro',400],vi_be_bold:['Be Vietnam Pro',700],vi_be_black:['Be Vietnam Pro',900],vi_montserrat:['Montserrat',800],vi_lexend:['Lexend',600],vi_noto_sans:['Noto Sans',500],vi_noto_serif:['Noto Serif',600],vi_oswald:['Oswald',600]};
for(const [key,[family,weight]] of Object.entries(extra)) {
 J.FONTS[key]={label:family+' '+weight,family:'"'+family+'"',weight,kind:family==='Noto Serif'?'mincho':'gothic',fb:family==='Noto Serif'?fbSerif:fbSans};
 map[key]=F(family,weight);
}
J.LOCAL_FONT_FAMILIES=new Set(['Be Vietnam Pro','Montserrat','Lexend','Noto Sans','Noto Serif','Oswald']);
const originalLocale=J.segLocale;
J.segLocale=()=>J.lang==='vi'?'vi':originalLocale();
const originalLatin=J.isLatin;
J.isLatin=c=>originalLatin(c)||/[\u00c0-\u024f\u1e00-\u1eff]/u.test(c);
J.POOLS.vi={kana:'AĂÂBCDĐEÊGHIKLMNOÔƠPQRSTUƯVXY',hira:'aăâbcdđeêghiklmnoôơpqrstuưvxy',half:'0123456789ABCDEF',reel:'TIẾNGVIỆTÂMNHẠC'+ '0123456789',scramble:'AĂÂBCDĐEÊGHIKLMNOÔƠPQRSTUƯVXY0123456789★◆▲●■',signs:'AĂÂĐEÊOÔƠUƯ#*+=/<>01'};
})();
