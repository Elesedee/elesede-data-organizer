/* ELESEDE · 100% local en el navegador: sin APIs, logs, cookies ni almacenamiento. */
(()=>{'use strict';
const $=id=>document.getElementById(id),fields=ElesedeParser.FIELDS;
const labels=['First Name','Last Name','Date of Birth','SSN','Address','City','State','Zip Code','Email'];
const state={files:[],records:[],indices:[],shown:36,duplicates:0,errors:[],editing:new Set(),busy:false,cancelled:false};
let worker=null,jobId=0,pending=new Map(),toastTimer=null;
function startWorker(){
if(worker){worker.terminate();worker=null;}
for(const p of pending.values())p.reject(Error('Cancelado'));pending.clear();
try{if(location.protocol!=='file:'){worker=new Worker('./worker.js?v=20261116-plain-export4');worker.onmessage=e=>{const task=pending.get(e.data.id);if(!task)return;pending.delete(e.data.id);if(e.data.type==='error')task.reject(Error(e.data.error));else task.resolve(e.data);};worker.onerror=()=>{for(const p of pending.values())p.reject(Error('El analizador encontró un error'));pending.clear();worker.terminate();worker=null;};}}catch{worker=null;}
}
async function task(data){
if(worker)return new Promise((resolve,reject)=>{let id=++jobId;pending.set(id,{resolve,reject});try{worker.postMessage({...data,id},data.buffer?[data.buffer]:[]);}catch(e){pending.delete(id);reject(e);}});
if(data.type==='text')return {profiles:ElesedeParser.parseText(data.text,'Texto pegado')};
if(data.type==='parse'){const ext=data.name.toLowerCase().split('.').pop();if(ext==='xlsx'||ext==='xlsm')return {profiles:await ElesedeExcel.readXlsx(data.buffer,data.name)};let raw=new TextDecoder().decode(data.buffer);return {profiles:(ext==='csv'||ext==='tsv')?ElesedeParser.parseRows(ElesedeParser.parseCSV(raw),data.name):ElesedeParser.parseText(raw,data.name)};}
if(data.type==='dedupe'){const profiles=ElesedeParser.dedupe(data.profiles);return {profiles,duplicates:data.profiles.length-profiles.length};}
if(data.type==='export-xlsx')return {buffer:await ElesedeExcel.writeXlsx(data.records)};
throw Error('Tarea inválida');
}
function toast(msg){const box=$('toast');box.textContent=msg;box.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('visible'),3200);}
function el(tag,cls,value){const x=document.createElement(tag);if(cls)x.className=cls;if(value!==undefined)x.textContent=value;return x;}
function button(label,cls,fn){const b=el('button',cls,label);b.type='button';b.addEventListener('click',fn);return b;}
function bytes(n){return n>=1048576?(n/1048576).toFixed(1)+' MB':n>=1024?(n/1024).toFixed(1)+' KB':n+' B';}
function addFiles(list){let bad=0;for(const f of Array.from(list||[])){const ext=f.name.toLowerCase().split('.').pop();if(!['txt','csv','tsv','xlsx','xlsm'].includes(ext)||f.size>80*1024*1024){bad++;continue;}if(!state.files.some(x=>x.name===f.name&&x.size===f.size&&x.lastModified===f.lastModified))state.files.push(f);}
renderFiles();if(bad)toast(bad+' archivo(s) omitidos (formato no válido o >80 MB).');}
function renderFiles(){const target=$('fileList');target.replaceChildren();$('fileCount').textContent=state.files.length+' archivos seleccionados';$('fileCount').hidden=state.files.length===0;$('removeFiles').hidden=state.files.length===0;
for(const f of state.files.slice(0,12)){const d=el('div','file-row');d.append(el('span','file-name',f.name),el('span','file-size',bytes(f.size)));target.append(d);}
if(state.files.length>12)target.append(el('p','quiet','Y '+(state.files.length-12)+' archivos adicionales.'));}
function setTab(mode){const isText=mode==='text';$('fileView').hidden=isText;$('textView').hidden=!isText;$('tabFiles').classList.toggle('active',!isText);$('tabText').classList.toggle('active',isText);}
function setBusy(b){state.busy=b;$('processButton').disabled=b;$('cancelButton').hidden=!b;$('progressWrap').hidden=!b;$('processButton').textContent=b?'Organizando...':'Organizar datos';}
function progress(done,total,label){const p=total?Math.round(100*done/total):0;$('progressBar').style.width=p+'%';$('progressText').textContent=label+' · '+p+'%';}
async function process(){
if(state.busy)return;const text=$('pasteInput').value.trim();if(!state.files.length&&!text){toast('Selecciona archivos o pega texto para empezar.');return;}
state.cancelled=false;state.errors=[];$('searchInput').value='';state.records=[];state.duplicates=0;state.editing.clear();state.shown=36;$('resultSection').hidden=true;setBusy(true);
const jobs=state.files.map(file=>({file}));if(text)jobs.push({text});
let total=jobs.length,done=0,all=[];
for(const job of jobs){if(state.cancelled)break;
progress(done,total,job.file?'Analizando '+job.file.name:'Analizando texto pegado');
try{let r;if(job.file){const buffer=await job.file.arrayBuffer();if(state.cancelled)break;r=await task({type:'parse',name:job.file.name,buffer});}else r=await task({type:'text',text:job.text});all.push(...r.profiles);}
catch(e){if(!state.cancelled)state.errors.push((job.file?.name||'Texto pegado')+': '+(e.message||'Error desconocido'));}
done++;progress(done,total,'Procesando lote');await new Promise(r=>setTimeout(r,0));
}
if(state.cancelled){setBusy(false);toast('Procesamiento cancelado');return;}
if($('dedupe').checked){try{const r=await task({type:'dedupe',profiles:all});state.records=r.profiles;state.duplicates=r.duplicates;}catch{state.records=ElesedeParser.dedupe(all);state.duplicates=all.length-state.records.length;}}else state.records=all;
setBusy(false);renderResults();toast(state.records.length+' perfiles organizados');if(state.records.length){$('resultSection').scrollIntoView({behavior:'smooth',block:'start'});}
}
const missing=p=>fields.filter(f=>!String(p[f]??'').trim());
function problems(p){const issues=(p.issues||[]).filter(x=>!x.startsWith('Campos pendientes:'));if(missing(p).length)issues.unshift('Faltan '+missing(p).length+' campos. Revisa antes de exportar.');return issues;}
function renderResults(){
$('resultSection').hidden=false;$('count').textContent=state.records.length;$('total').textContent=state.records.length.toLocaleString('es');
const completed=state.records.filter(p=>missing(p).length===0&&problems(p).length===0).length;
$('completed').textContent=completed.toLocaleString('es');$('review').textContent=(state.records.length-completed).toLocaleString('es');$('duplicates').textContent=state.duplicates.toLocaleString('es');
$('errors').hidden=!state.errors.length;$('errors').textContent=state.errors.length?'Algunos archivos necesitan revisión: '+state.errors.slice(0,4).join(' · '):'';
filter();
}
function filter(){const q=$('searchInput').value.toLocaleLowerCase().trim();state.indices=[];
for(let i=0;i<state.records.length;i++)if(!q||fields.some(f=>String(state.records[i][f]||'').toLocaleLowerCase().includes(q)))state.indices.push(i);
renderCards();}
function values(p){return fields.map(f=>String(p[f]??''));}
function vertical(p){return values(p).join('\n');}
async function copy(text,label){try{
if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(text);
else{const t=el('textarea');t.value=text;t.style.cssText='position:fixed;opacity:0';document.body.append(t);t.select();if(!document.execCommand('copy'))throw Error();t.remove();}
toast(label||'Copiado correctamente');
}catch{toast('El navegador no permitió copiar; revisa los permisos.');}}
function profileCard(i){
const p=state.records[i],probs=problems(p),editing=state.editing.has(i),card=el('article','profile'+(probs.length?' pending':''));
const head=el('div','profile-head'),name=el('div','profile-name');name.append(el('small','muted','#'+String(i+1).padStart(3,'0')+' · '+(probs.length?'PARA REVISAR':'COMPLETO')),el('h3','',((p.firstName||'Sin nombre')+' '+(p.lastName||'')).trim()));
const acts=el('div','profile-actions');acts.append(button(editing?'Cerrar':'Editar','mini',()=>{if(editing)state.editing.delete(i);else state.editing.add(i);renderCards();}),button('⧉ Copiar perfil','mini red',()=>copy(vertical(p),'Perfil copiado')));
head.append(name,acts);card.append(head);const body=el('div','profile-body');
for(let j=0;j<fields.length;j++){const field=fields[j],line=el('div','line'+(!p[field]?' missing':''));line.append(el('span','line-number',String(j+1).padStart(2,'0')));
if(editing){const input=el('input','field-input');input.value=p[field]||'';input.placeholder=labels[j];input.setAttribute('aria-label',labels[j]);input.dataset.field=field;input.autocomplete='off';line.append(input);}
else{line.append(el('span','line-value',p[field]||'—'));const b=button('Copiar','line-copy',()=>copy(String(p[field]||''),'Línea '+(j+1)+' copiada'));b.title='Copiar '+labels[j];line.append(b);}
body.append(line);}
if(editing){const controls=el('div','edit-actions');controls.append(button('Cancelar','mini',()=>{state.editing.delete(i);renderCards();}),button('Guardar cambios','mini red',()=>{for(const input of body.querySelectorAll('.field-input'))p[input.dataset.field]=input.value.trim();p.issues=[];state.editing.delete(i);renderResults();toast('Cambios guardados en esta pestaña');}));body.append(controls);}
card.append(body);if(probs.length&&!editing)card.append(el('div','warning',probs.join(' · ')));return card;
}
function renderCards(){const root=$('cards');root.replaceChildren();const ids=state.indices.slice(0,state.shown);if(!ids.length)root.append(el('div','empty',state.records.length?'No hay perfiles que coincidan. Borra el texto del buscador para verlos todos.':'No se encontraron perfiles. Revisa el formato del archivo.'));
else{const frag=document.createDocumentFragment();for(const i of ids)frag.append(profileCard(i));root.append(frag);}
$('loadMore').hidden=state.shown>=state.indices.length;$('showing').textContent='Mostrando '+ids.length+' de '+state.indices.length+' perfiles';}
function download(data,name,mime){const blob=data instanceof Blob?data:new Blob([data],{type:mime}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function safeCsv(s){
let v=String(s??'')
  .replace(/["“”«»]/g,'')
  .replace(/[\r\n\t]+/g,' ')
  .replace(/,/g,' ')
  .replace(/\s{2,}/g,' ')
  .trim();
// Un CSV vertical sin comillas necesita sustituir las comas internas.
// Evita fórmulas ejecutables al abrir CSV con Excel sin añadir apóstrofes.
if(/^[=+\-@]/.test(v))v=v.replace(/^[=+\-@]+/,'').trimStart();
return v;
}
function downloadTxt(){if(!state.records.length)return toast('No hay perfiles');download(state.records.map(vertical).join('\r\n\r\n'),'elesede_organizados.txt','text/plain;charset=utf-8');toast('TXT sin comillas descargado');}
function downloadCsv(){if(!state.records.length)return toast('No hay perfiles');const body=state.records.map(p=>values(p).map(safeCsv).join('\r\n')).join('\r\n\r\n');download('\uFEFF'+body,'elesede_organizados.csv','text/csv;charset=utf-8');toast('CSV descargado');}
async function downloadXlsx(){if(!state.records.length)return toast('No hay perfiles');const b=$('downloadExcel');b.disabled=true;try{const r=await task({type:'export-xlsx',records:state.records});download(r.buffer,'elesede_organizados.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');toast('Excel descargado');}catch(e){toast('No se pudo generar Excel: '+e.message);}finally{b.disabled=false;}}
function clearAll(){if(state.busy)return;state.files=[];state.records=[];state.indices=[];state.errors=[];state.editing.clear();$('pasteInput').value='';$('searchInput').value='';$('resultSection').hidden=true;renderFiles();setTab('files');window.scrollTo({top:0,behavior:'smooth'});}
function init(){
startWorker();const dz=$('dropzone');
$('tabFiles').onclick=()=>setTab('files');$('tabText').onclick=()=>setTab('text');
$('fileInput').onchange=e=>{addFiles(e.target.files);e.target.value='';};
$('removeFiles').onclick=()=>{state.files=[];renderFiles();};
dz.onclick=()=>$('fileInput').click();dz.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('fileInput').click();}};
for(const name of ['dragover','dragenter'])dz.addEventListener(name,e=>{e.preventDefault();dz.classList.add('drag');});
for(const name of ['dragleave','drop'])dz.addEventListener(name,e=>{e.preventDefault();dz.classList.remove('drag');});
dz.addEventListener('drop',e=>addFiles(e.dataTransfer.files));window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
$('processButton').onclick=process;$('cancelButton').onclick=()=>{state.cancelled=true;startWorker();setBusy(false);};
$('newBatch').onclick=clearAll;$('searchInput').oninput=()=>{state.shown=36;filter();};
$('loadMore').onclick=()=>{state.shown+=36;renderCards();};
$('copyAll').onclick=()=>copy(state.records.map(vertical).join('\n\n'),'Todos los perfiles copiados');
$('downloadCsv').onclick=downloadCsv;$('downloadExcel').onclick=downloadXlsx;$('downloadTxt').onclick=downloadTxt;
$('privacyButton').onclick=()=>$('privacyDialog').showModal();$('closeDialog').onclick=()=>$('privacyDialog').close();$('closeDialogBottom').onclick=()=>$('privacyDialog').close();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();