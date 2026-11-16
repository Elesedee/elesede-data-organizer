/* Worker: analiza lotes y genera XLSX sin congelar la interfaz. */
'use strict';
importScripts('./vendor/jszip.min.js','./parser.js','./excel.js');
self.onmessage=async({data})=>{
const {type,id}=data;
try{
if(type==='parse'){
const {name,buffer}=data,ext=name.toLowerCase().split('.').pop();let profiles=[];
if(ext==='xlsx'||ext==='xlsm')profiles=await ElesedeExcel.readXlsx(buffer,name);
else if(ext==='xls')throw Error('Los archivos .xls antiguos no están soportados. Conviértelos a .xlsx o CSV.');
else {
let text=new TextDecoder('utf-8').decode(buffer);
if(text.includes('\ufffd'))try{let latin=new TextDecoder('windows-1252').decode(buffer);if((latin.match(/\ufffd/g)||[]).length<(text.match(/\ufffd/g)||[]).length)text=latin;}catch{}
profiles=(ext==='csv'||ext==='tsv')?ElesedeParser.parseRows(ElesedeParser.parseCSV(text),name):ElesedeParser.parseText(text,name);
}
postMessage({type:'parsed',id,profiles});
}else if(type==='text')postMessage({type:'parsed',id,profiles:ElesedeParser.parseText(data.text,'Texto pegado')});
else if(type==='dedupe'){
let profiles=ElesedeParser.dedupe(data.profiles);
postMessage({type:'deduped',id,profiles,duplicates:data.profiles.length-profiles.length});
}else if(type==='export-xlsx'){
const buffer=await ElesedeExcel.writeXlsx(data.records);
postMessage({type:'xlsx-done',id,buffer},[buffer]);
}
}catch(e){postMessage({type:'error',id,error:e?.message||'Error local de procesamiento'});}
};