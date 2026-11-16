/* ELESEDE Data Organizer — parser local, sin conexiones remotas. */
(function(root){
'use strict';
const FIELDS=['firstName','lastName','dob','ssn','address','city','state','zip','email'];
const STATES={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'District of Columbia',PR:'Puerto Rico'};
const STATE_NAMES=Object.fromEntries(Object.entries(STATES).map(([k,v])=>[v.toLowerCase(),k]));
const EMAIL=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-ZÀ-ÖØ-öø-ÿ]{2,}/gi;
const SSN=/(?<!\d)\d{3}[\s-]?\d{2}[\s-]?\d{4}(?!\d)/g;
const DATE=/\b(?:0?[1-9]|1[0-2])[\/.-](?:0?[1-9]|[12]\d|3[01])[\/.-](?:19|20)\d{2}\b/;
const ZIP=/(?<!\d)\d{5}(?:-\d{4})?(?!\d)/;
const ALIASES={
firstName:['first name','firstname','first_name','given name','nombre de pila','primer nombre','nombres'],
lastName:['last name','lastname','last_name','surname','family name','apellido','apellidos'],
name:['full name','fullname','nombre completo','client name','customer name','nombre del cliente','name','nombre','cliente'],
dob:['date of birth','birth date','dob','birth','fecha de nacimiento','fecha nacimiento','f nacimiento','nacimiento','fecha nac'],
ssn:['social security number','social security','ssn number','ssn','nss','numero de seguro social','número de seguro social','num seguro social','custom'],
address:['primary address','possible primary address','mailing address','residential address','street address','physical address','direccion principal','dirección principal','direccion posible principal','dirección posible principal','address','direccion','dirección','domicilio','calle','street'],
city:['city','ciudad','localidad','municipio'],
state:['state','estado','province','provincia'],
county:['county','condado'],
zip:['zip code','zipcode','zip','postal code','postal','codigo postal','código postal','cp'],
email:['primary email','possible primary email','email principal','correo principal','correo posible principal','email','e-mail','mail','correo electronico','correo electrónico','correo'],
phone:['phone','phone number','telefono movil','teléfono móvil','telefono','teléfono','mobile','cell','celular'],
other:['driving licence','driver license','estado civil','dependientes','empleador','puesto','ingreso mensual','años empleado','meses empleado','frecuencia de pago','monto solicitado','plazo de pago','ingreso del hogar','proposito','propósito','bank','banco','cuenta','routing number','sort code','lic','exp','pin','jobs','parent_name','parent name','account number','fecha de expiracion','ssn finder']
};
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[_-]/g,' ').replace(/\s+/g,' ').trim();
const clean=v=>String(v??'').replace(/\\\*/g,'').replace(/\r/g,'').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/^\s*[•*|]+\s*/,'').trim();
const aliases=Object.entries(ALIASES).flatMap(([kind,terms])=>terms.map(term=>({kind,term:norm(term)}))).sort((a,b)=>b.term.length-a.term.length);
function kindFor(label){let n=norm(label).replace(/\b(posible|potential|likely|probable|principal|primary|main|preferred|preferido|preferida|possible)\b/g,'').trim();return aliases.find(x=>x.term===n)?.kind||null;}
function rankFor(label){const n=norm(label);if(/\b(posible principal|possible primary|potential primary|likely primary|probable principal|posiblemente principal|probable primary)\b/.test(n))return 2;if(/\b(principal|primary|preferred|predeterminado|main|preferido|preferida)\b/.test(n))return 3;return 1;}
function stateOf(v){const n=norm(v);return n.length===2?(STATES[n.toUpperCase()]?n.toUpperCase():''):STATE_NAMES[n]||'';}
function validDate(s){const m=String(s).match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-]((?:19|20)\d{2})$/);if(!m)return false;const d=new Date(Date.UTC(+m[3],+m[1]-1,+m[2]));return d.getUTCFullYear()===+m[3]&&d.getUTCMonth()===+m[1]-1&&d.getUTCDate()===+m[2]&&+m[3]<=new Date().getUTCFullYear();}
function normalizeDate(value){
const s=String(value??'').trim();
if(/^(?:19|20)\d{2}-\d{2}-\d{2}$/.test(s)){const [y,m,d]=s.split('-');return validDate(m+'/'+d+'/'+y)?m+'/'+d+'/'+y:'';}
if(/^\d{5}(?:\.\d+)?$/.test(s)){const n=Number(s);if(n>=18000&&n<=80000){const d=new Date(Date.UTC(1899,11,30)+Math.floor(n)*86400000);return normalizeDate((d.getUTCMonth()+1)+'/'+d.getUTCDate()+'/'+d.getUTCFullYear());}}
const m=s.match(DATE);if(!m||!validDate(m[0]))return '';const [mon,day,year]=m[0].split(/[\/.-]/);return mon.padStart(2,'0')+'/'+day.padStart(2,'0')+'/'+year;
}
function formatSSN(s){const m=String(s??'').match(SSN);return m?m[0].replace(/\D/g,'').replace(/^(\d{3})(\d{2})(\d{4})$/,'$1-$2-$3'):'';}
function splitName(raw){
let s=clean(raw).replace(/^\d+\.\s*/,'').replace(/\s+(?:\(|\[).*$/,'').replace(/\s*\|.*$/,'').replace(/\s+\d{1,2}[\/.-]\d{1,2}[\/.-](?:19|20)\d{2}.*$/,'').replace(/\s+\d{3}[- ]?\d{2}[- ]?\d{4}.*$/,'').replace(/[,*]+$/,'').trim();
if(!s||/\d/.test(s)||s.length>90||/^ssn finder|^valid\b/i.test(s))return ['',''];
if(s.includes(',')){let [last,first]=s.split(',').map(x=>x.trim());return [first?.split(/\s+/)[0]||'',last||''];}
let parts=s.split(/\s+/).filter(Boolean);if(parts.length<2||parts.length>7)return ['',''];
let last=parts.pop();while(parts.length>1&&/^(de|del|la|las|los|van|von|da|dos|do|di|der)$/i.test(parts.at(-1)))last=parts.pop()+' '+last;
return [parts[0],last];
}
function parseAddress(raw){
let t=clean(raw).replace(/[,.;\s]+$/,'');let result={address:t,city:'',state:'',zip:''};if(!t)return result;
let p=t.split(/\s*;\s*/).filter(Boolean);
if(p.length>=4){return {address:p.slice(0,-3).join('; '),city:p.at(-3),state:stateOf(p.at(-2)),zip:(p.at(-1).match(ZIP)||[])[0]||''};}
let m=t.match(/^(.+?)[,;]\s*([^,;]{2,65})[,;]\s*([A-Za-z ]{2,24})\s*[,;]?\s*(\d{5}(?:-\d{4})?)\s*$/);
if(m&&stateOf(m[3]))return {address:m[1].trim(),city:m[2].trim(),state:stateOf(m[3]),zip:m[4]};
m=t.match(/^(.+?)\s+([A-Za-z][A-Za-z.'\- ]{1,50})\s*,?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
if(m&&stateOf(m[3]))return {address:m[1].trim(),city:m[2].trim(),state:stateOf(m[3]),zip:m[4]};
return result;
}
const ALL_LABELS=[...new Set(Object.values(ALIASES).flat())].sort((a,b)=>b.length-a.length);
function escapeReg(s){return [...s].map(c=>'.*+?^$()[]{}|\\'.includes(c)?'\\'+c:c).join('');}
const INLINE_RX=new RegExp('\\b(?:'+ALL_LABELS.map(x=>escapeReg(x).replace(/\s+/g,'\\s+')).join('|')+')\\s*[:：]','gi');
function splitInline(s){const cuts=[];let m;INLINE_RX.lastIndex=0;while((m=INLINE_RX.exec(s))!==null){if(m.index>0&&!/[\r\n]/.test(s[m.index-1]))cuts.push(m.index);}for(let i=cuts.length-1;i>=0;i--)s=s.slice(0,cuts[i])+'\n'+s.slice(cuts[i]);return s;}
function labelAt(line){let m=line.match(/^\s*(?:[-•*]\s*)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ _\-/]{1,55}?)\s*[:：]\s*(.*)$/);if(!m)return null;let type=kindFor(m[1]);return type?{type,label:m[1],value:m[2]}:null;}
function preprocess(text){
let s=String(text??'').replace(/\r\n?/g,'\n').replace(/\\\*/g,'').replace(/\t/g,' ');
s=s.replace(/(?:^|\n)\s*\d{1,3}\.\s+(\d{3}[- ]?\d{2}[- ]?\d{4})\s+(?=NAME\s*:)/gi,'\nSSN: $1\n');
s=s.replace(/\\\s*\\/g,' ');
s=s.replace(/(?:^|\n)\s*(?:[━─\-]{4,}\s*)?(?:SEARCH RESULTS|RESULTADOS DE B[ÚU]SQUEDA)(?:\s*[━─\-]{4,})?[^\n]*\n[\s\S]*$/im,'');
s=s.replace(/(?:^|\n)\s*(?:[━─\-]{4,}\s*)?PHONES\s*[━─\-]{3,}[^\n]*(?:\n(?:\s*[•*]\s*)?\(?\d[^\n]*)*/gi,'\n');
return splitInline(s);
}
function splitBlocks(text){
let s=preprocess(text).replace(/\s*(?:={6,}|\.{8,}|\*{8,}|_{8,})\s*(?:-{2,}\s*)?/g,'\n§§CUT§§\n').replace(/\n\s*[-━─]{12,}\s*\n/g,'\n§§CUT§§\n');
let result=[];
for(let b of s.split('§§CUT§§').map(x=>x.trim()).filter(Boolean)){
let lines=b.split('\n'),part=[],seenName=false,seenSSN=false,seenEmail=false;
for(const line of lines){
const k=labelAt(line)?.type;
const newName=k==='name'&&seenName&&(seenSSN||seenEmail||part.length>=5);
const newSSN=k==='ssn'&&seenSSN&&(seenName||seenEmail)&&part.length>=4;
if((newName||newSSN)&&part.length){result.push(part.join('\n'));part=[];seenName=false;seenSSN=false;seenEmail=false;}
part.push(line);if(k==='name')seenName=true;if(k==='ssn')seenSSN=true;if(k==='email')seenEmail=true;
}
if(part.length)result.push(part.join('\n'));
}
return result.filter(s=>s.trim().length>3);
}
const IGNORE=/^(?:ssn finder|valid:|emisi[oó]n:|score\s|→|usphonebook|account number|routing number|sort code|cuenta\s|banco\s|lic\s*:|exp\s*:|pin\s*:|jobs\s*:|parent.name\s*:|phone\s*:|tel[eé]fono|mobile\s*:|password\s*:|clave\s*:|\d{1,4}\.\s+\S+@\S+:|[\-=_.•*\s]{4,})/i;
function parseBlock(block,source=''){
const c=Object.fromEntries(FIELDS.map(f=>[f,[]])),issues=[];let at=0,emailsSection=false;
function push(field,value,rank=1){value=clean(value);if(!FIELDS.includes(field)||!value||/^(?:-|null|undefined|unknown|n\/a|none|no disponible|\?+)$/i.test(value))return;c[field].push({value,rank,at:at++});}
function addName(v,r=1){let [f,l]=splitName(v);push('firstName',f,r);push('lastName',l,r);}
function addAddress(v,r=1){const p=parseAddress(v);push('address',p.address,r);push('city',p.city,r);push('state',p.state,r);push('zip',p.zip,r);}
const lines=block.split(/\n+/).map(clean).filter(Boolean);
for(let i=0;i<lines.length;i++){
const line=lines[i];
if(/^(?:-{3,}|━{3,}|─{3,})?\s*EMAILS\b/i.test(line)){emailsSection=true;continue;}
if(/^(?:-{3,}|━{3,}|─{3,})?\s*(?:PHONES|SEARCH RESULTS|RESULTS|TELEFONOS)\b/i.test(line)){emailsSection=false;continue;}
const tag=labelAt(line);
if(tag){
const {type,label}=tag;let value=clean(tag.value);const rank=rankFor(label);
if(!value&&i+1<lines.length&&!labelAt(lines[i+1]))value=clean(lines[++i]);
if(type==='name')addName(value,rank);
else if(type==='firstName'||type==='lastName')push(type,value,rank);
else if(type==='dob')push('dob',normalizeDate(value),rank);
else if(type==='ssn')push('ssn',formatSSN(value),rank);
else if(type==='address')addAddress(value,rank);
else if(type==='city')push('city',value,rank);
else if(type==='state'||type==='county')push('state',stateOf(value),rank);
else if(type==='zip')push('zip',(value.match(ZIP)||[])[0]||'',rank);
else if(type==='email'){(value.match(EMAIL)||[]).forEach(v=>push('email',v,rank));}
emailsSection=false;continue;
}
const e=line.match(EMAIL)||[];
if(e.length&&(emailsSection||!IGNORE.test(line))){e.forEach(v=>push('email',v,rankFor(line.replace(EMAIL,' '))));continue;}
if(IGNORE.test(line))continue;
if(normalizeDate(line)&&/^\d{1,2}[\/.-]\d{1,2}[\/.-](?:19|20)\d{2}$/.test(line)){push('dob',normalizeDate(line));continue;}
if(/^\d{3}[- ]?\d{2}[- ]?\d{4}$/.test(line)){push('ssn',formatSSN(line));continue;}
const p=parseAddress(line);
if(p.zip&&p.state){addAddress(line);continue;}
let m=line.match(/^(.+?),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
if(m&&stateOf(m[2])&&!/\d/.test(m[1])){push('city',m[1]);push('state',m[2]);push('zip',m[3]);continue;}
if(/^\d{1,7}\s+\S+/.test(line)&&!/\b(cell|wireless|landline)\b/i.test(line)){
if(i+1<lines.length){const next=lines[i+1].match(/^([A-Z][A-Z\s.'-]+),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);if(next&&stateOf(next[2])){push('address',line);push('city',next[1]);push('state',next[2]);push('zip',next[3]);i++;continue;}}
if(/\b(st|street|road|rd|ave|avenue|dr|drive|ln|lane|blvd|boulevard|ct|court|pl|place|way|trail|apt|unit|cir)\b/i.test(line))push('address',line);
continue;
}
if((i===0||(!c.firstName.length&&i<3))&&!line.includes(':')&&!line.includes('@'))addName(line);
}
const out={};for(let f of FIELDS){const ranked=c[f].sort((a,b)=>b.rank-a.rank||a.at-b.at);out[f]=ranked[0]?.value||'';}
if(out.state)out.state=stateOf(out.state)||out.state;
if(out.address&&out.city){const n=out.address.toLowerCase(),needle=out.city.toLowerCase();const j=n.lastIndexOf(needle);if(j>0&&/[\s,]/.test(n[j-1])&&n.slice(j+needle.length).replace(/[\s,;.]/g,'').length<=2)out.address=out.address.slice(0,j).replace(/[\s,;.]+$/,'');}
const missing=FIELDS.filter(f=>!out[f]);if(missing.length)issues.push('Campos pendientes: '+missing.map(f=>({firstName:'nombre',lastName:'apellido',dob:'nacimiento',ssn:'SSN',address:'dirección',city:'ciudad',state:'estado',zip:'ZIP',email:'correo'})[f]).join(', '));
if(out.email&& !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(out.email))issues.push('Correo con formato no habitual');
const useful=FIELDS.filter(f=>out[f]).length;if(useful<3||(!out.firstName&&!out.lastName))return null;
return {...out,issues,source,completeness:useful};
}
function parseVerticalRows(rows,source){
if(rows.length<9||!rows.every(r=>Array.isArray(r)&&r.slice(1).every(x=>!String(x??'').trim())))return null;
const vals=rows.map(r=>clean(r[0]??''));
function valid(group){
if(group.length!==9)return false;
const [first,last,dob,ssn,address,city,state,zip,email]=group;
if(!first&&!last)return false;
if(first&&(/[:\/@]/.test(first)||first.length>100))return false;
if(last&&(/[:\/@]/.test(last)||last.length>100))return false;
if(dob&&!normalizeDate(dob))return false;
if(ssn&&!formatSSN(ssn))return false;
if(state&&!stateOf(state))return false;
if(zip&&!/^\d{5}(?:-\d{4})?$/.test(zip))return false;
if(email&&!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email))return false;
return [dob&&normalizeDate(dob),ssn&&formatSSN(ssn),state&&stateOf(state),zip&&ZIP.test(zip),email&&/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)].filter(Boolean).length>=2;
}
const profiles=[];let i=0;
while(i<vals.length){
if(vals.slice(i).every(x=>!x))break;
let group=vals.slice(i,i+9);
if(!valid(group)){
if(!vals[i]&&valid(vals.slice(i+1,i+10))){i++;continue;}
return null;
}
const entry=parseBlock(FIELDS.map((field,k)=>field+': '+group[k]).join('\n'),source);
if(!entry)return null;
profiles.push(entry);i+=9;
while(i<vals.length&&!vals[i]&&valid(vals.slice(i+1,i+10)))i++;
}
return profiles.length?profiles:null;
}
function parseText(text,source='Texto pegado'){
const lines=String(text??'').split(/\r?\n/);
const vertical=parseVerticalRows(lines.map(line=>[line]),source);
if(vertical)return vertical;
return splitBlocks(text).map(b=>parseBlock(b,source)).filter(Boolean);
}
function parseCSV(text){
let src=String(text??'').replace(/^\uFEFF/,'');
let head=src.split(/\r?\n/).slice(0,4).join('\n');
let sep=[',',';','\t','|'].map(s=>({s,n:head.split(s).length-1})).sort((a,b)=>b.n-a.n)[0]?.s||',';
let rows=[],row=[],v='',quote=false;
for(let i=0;i<src.length;i++){const ch=src[i];if(quote){if(ch==='"'&&src[i+1]==='"'){v+='"';i++;}else if(ch==='"')quote=false;else v+=ch;}else if(ch==='"')quote=true;else if(ch===sep){row.push(v);v='';}else if(ch==='\n'){row.push(v.replace(/\r$/,''));rows.push(row);row=[];v='';}else v+=ch;}
row.push(v);rows.push(row);return rows;
}
function parseRows(rows,source='Archivo'){
if(!rows.length)return [];
const vertical=parseVerticalRows(rows,source);
if(vertical)return vertical;
rows=rows.filter(r=>Array.isArray(r)&&r.some(c=>String(c??'').trim()));if(!rows.length)return [];
const head=rows[0].map(v=>String(v??'').trim()),types=head.map(kindFor);
const recognized=types.filter(x=>x&&x!=='other'&&x!=='phone').length;
if(recognized>=2&&rows.length>1){let out=[];for(const row of rows.slice(1)){let fields=[];for(let i=0;i<head.length;i++)if(types[i]&&row[i]!=null&&String(row[i]).trim())fields.push(head[i]+': '+String(row[i]));const p=parseBlock(fields.join('\n'),source);if(p)out.push(p);}return out;}
if(rows.length>=3&&rows.filter(r=>r.length>=2&&kindFor(r[0])).length>=3){return parseText(rows.map(r=>r.length>1?String(r[0])+': '+r.slice(1).join(' '):String(r[0]||'')).join('\n'),source);}
if(rows.length>1&&rows.filter(r=>r.length>=5&&r.some(x=>String(x).includes('@'))&&r.some(x=>normalizeDate(String(x)))).length>=Math.max(1,Math.floor(rows.length*.65))){
let out=[];for(const row of rows){let words=[],labels=[];for(const x of row){const v=clean(x);if(!v)continue;if(v.match(EMAIL)){labels.push('Email: '+v);continue;}if(normalizeDate(v)){labels.push('DOB: '+normalizeDate(v));continue;}if(/^\d{3}[- ]?\d{2}[- ]?\d{4}$/.test(v)){labels.push('SSN: '+v);continue;}if(stateOf(v)){labels.push('State: '+v);continue;}if(/^\d{5}(?:-\d{4})?$/.test(v)){labels.push('Zip: '+v);continue;}if(/^\d+\s+\S+/.test(v)){labels.push('Address: '+v);continue;}words.push(v);}
const names=words.filter(v=>/^[A-Za-zÀ-ÿ' .-]{2,70}$/.test(v));const multi=names.find(v=>v.split(/\s+/).length>=2);
if(multi){labels.push('Name: '+multi);words.splice(words.indexOf(multi),1);}else if(names.length>=2){labels.push('First Name: '+names[0]);labels.push('Last Name: '+names[1]);words.splice(words.indexOf(names[0]),1);words.splice(words.indexOf(names[1]),1);}
let city=words.find(v=>/^[A-Za-zÀ-ÿ .'-]{2,50}$/.test(v));if(city)labels.push('City: '+city);
const p=parseBlock(labels.join('\n'),source);if(p)out.push(p);}
if(out.length)return out;
}
return parseText(rows.map(r=>r.map(x=>String(x??'')).filter(Boolean).join('  ')).join('\n'),source);
}
function dedupe(profiles){const seen=new Set(),out=[];for(const p of profiles){const key=p.ssn&&p.dob?'S|'+p.ssn+'|'+p.dob:p.email&&p.dob?'E|'+p.email.toLowerCase()+'|'+p.dob:'N|'+p.firstName.toLowerCase()+'|'+p.lastName.toLowerCase()+'|'+p.address.toLowerCase();if(!seen.has(key)){seen.add(key);out.push(p);}}return out;}
const values=p=>FIELDS.map(f=>String(p[f]??''));
root.ElesedeParser={FIELDS,parseText,parseCSV,parseRows,parseBlock,splitBlocks,values,dedupe,kindFor,normalizeDate};
if(typeof module==='object'&&module.exports)module.exports=root.ElesedeParser;
})(typeof self!=='undefined'?self:globalThis);