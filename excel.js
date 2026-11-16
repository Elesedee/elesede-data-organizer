/* Excel OOXML: lectura y descarga locales con JSZip empacado durante el build. */
(function(root){
'use strict';
function decode(s){return String(s??'').replace(/&(?:#x([0-9a-f]+)|#(\d+)|amp|lt|gt|quot|apos);/gi,(m,h,d)=>{if(h||d){try{return String.fromCodePoint(parseInt(h||d,h?16:10))}catch{return ''}}return {'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[m.toLowerCase()]||m;});}
function escape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt','"':'&quot;',"'":'&apos;'}[c])).replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g,'');}
function attr(s,k){const m=s.match(new RegExp('(?:^|\\s)'+k.replace(':','\\:')+'\\s*=\\s*["\x27]([^"\x27]+)["\x27]','i'));return m?.[1]||'';}
function textTags(s){let all=[],m;const rx=/<(?:[A-Za-z0-9_]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?t>/gi;while((m=rx.exec(s))!==null)all.push(decode(m[1]));return all.join('');}
function col(ref){let n=0;for(const c of (ref.match(/^[A-Z]+/i)?.[0]||'').toUpperCase())n=n*26+c.charCodeAt(0)-64;return Math.max(0,n-1);}
function rowsFromXml(xml,shared){
let rows=[],match,rx=/<row\b([^>]*?)>([\s\S]*?)<\/row>/gi;
while((match=rx.exec(xml))!==null){let cells=[],c,cx=/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi,index=0;
while((c=cx.exec(match[2]))!==null){const i=attr(c[1],'r')?col(attr(c[1],'r')):index;if(i>2048)continue;const type=attr(c[1],'t'),body=c[2]||'';let value='';
if(type==='inlineStr')value=textTags(body);else {value=decode(body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1]||'');if(type==='s')value=shared[Number(value)]??'';if(type==='str'&&!value)value=textTags(body);}
cells[i]=value;index=i+1;}
if(cells.length)rows.push(cells);if(rows.length>250000)throw Error('Excel demasiado grande: divide el lote en archivos más pequeños.');
}return rows;}
async function readXlsx(data,source){
if(typeof JSZip==='undefined')throw Error('No se cargó el módulo Excel.');
const zip=await JSZip.loadAsync(data);
const shared=[];const f=zip.file('xl/sharedStrings.xml');if(f){const s=await f.async('string'),rx=/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/gi;let m;while((m=rx.exec(s))!==null)shared.push(textTags(m[1]));}
const workbook=zip.file('xl/workbook.xml')?await zip.file('xl/workbook.xml').async('string'):'';
const rels=zip.file('xl/_rels/workbook.xml.rels')?await zip.file('xl/_rels/workbook.xml.rels').async('string'):'';
const relMap={};for(const m of rels.matchAll(/<Relationship\b([^>]*?)\/?\s*>/gi))relMap[attr(m[1],'Id')]=attr(m[1],'Target');
let sheets=[];for(const m of workbook.matchAll(/<sheet\b([^>]*?)\/?\s*>/gi)){
const id=attr(m[1],'r:id'),target=relMap[id]||'',name=decode(attr(m[1],'name'));
let path=target.startsWith('/')?target.slice(1):(target.startsWith('xl/')?target:'xl/'+target.replace(/^\.\//,''));
if(!zip.file(path)){const p='xl/worksheets/sheet'+(sheets.length+1)+'.xml';if(zip.file(p))path=p;}
if(zip.file(path))sheets.push({name,path});}
if(!sheets.length)for(const p of Object.keys(zip.files).sort())if(/^xl\/worksheets\/sheet\d+\.xml$/i.test(p))sheets.push({name:p,path:p});
if(!sheets.length)throw Error('No se encontraron hojas de Excel legibles.');
let out=[];for(const sh of sheets){const xml=await zip.file(sh.path).async('string');out.push(...ElesedeParser.parseRows(rowsFromXml(xml,shared),source+' · '+sh.name));}
return out;
}
async function writeXlsx(profiles){
if(typeof JSZip==='undefined')throw Error('No se cargó el módulo Excel.');
const zip=new JSZip();
zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
zip.file('xl/workbook.xml','<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Organizados" sheetId="1" r:id="rId1"/></sheets></workbook>');
zip.file('xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
let lines=[],r=1;for(let i=0;i<profiles.length;i++){for(const v of ElesedeParser.values(profiles[i])){lines.push('<row r="'+r+'"><c r="A'+r+'" t="inlineStr"><is><t xml:space="preserve">'+escape(v)+'</t></is></c></row>');r++;}if(i!==profiles.length-1)r++;}
zip.file('xl/worksheets/sheet1.xml','<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:A'+Math.max(1,r-1)+'"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="17"/><cols><col min="1" max="1" width="51" customWidth="1"/></cols><sheetData>'+lines.join('')+'</sheetData></worksheet>');
return zip.generateAsync({type:'arraybuffer',compression:'DEFLATE',compressionOptions:{level:5}});
}
root.ElesedeExcel={readXlsx,writeXlsx};
if(typeof module==='object'&&module.exports)module.exports=root.ElesedeExcel;
})(typeof self!=='undefined'?self:globalThis);