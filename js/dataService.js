// طبقة بيانات موحدة: كاش محلي سريع + قاعدة بيانات المطعم المركزية.
// تعمل أيضاً بدون سيرفر (وضع طوارئ)، ثم ترفع التغييرات تلقائياً عند عودته.
import { fetchFileFromGitHub, saveFileToGitHub, getGitHubConfig } from './githubSync.js';

export const DOMAINS = {
  categories:{key:'cs_cats',file:'data/catalog/categories.json'}, items:{key:'cs_items',file:'data/catalog/items.json'}, recipes:{key:'cs_recipes',file:'data/catalog/recipes.json'}, stock:{key:'cs_stock',file:'data/inventory/stock.json'}, tables:{key:'cs_tables',file:'data/tables/tables.json'}, customers:{key:'cs_customers',file:'data/crm/customers.json'}, suppliers:{key:'cs_suppliers',file:'data/crm/suppliers.json'}, captains:{key:'cs_captains',file:'data/crm/captains.json'}, staff:{key:'cs_staff',file:'data/crm/staff.json'}, users:{key:'cs_users',file:'data/settings/users.json'}, storeConfig:{key:'cs_configs',file:'data/settings/store-config.json',isObject:true}, orders:{key:'cs_orders',file:'data/transactions/orders.json'}, expenses:{key:'cs_expenses',file:'data/transactions/expenses.json'}, guardLogs:{key:'cs_guard_logs',file:'data/transactions/guard-logs.json'}, shiftsLog:{key:'cs_shifts_log',file:'data/transactions/shifts-log.json'}, activeShift:{key:'cs_active_shift',file:'data/transactions/active-shift.json',isObject:true,nullable:true}
};
export const DEFAULT_CATEGORIES=[{id:1,name:'مشويات'},{id:2,name:'مقبلات وسلطات'},{id:3,name:'مشروبات'},{id:4,name:'حلويات'},{id:5,name:'ساندوتشات ووجبات سريعة'}];
const clientId=sessionStorage.getItem('cs_client_id')||crypto.randomUUID(); sessionStorage.setItem('cs_client_id',clientId);
const dirty=new Set(), initialized=new Set(); let refreshTimer;
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('cashier-data'):null;
function readCache(key){try{const raw=localStorage.getItem(key);return raw===null?null:JSON.parse(raw)}catch{return null}}
function writeCache(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(err){console.warn('تعذر حفظ البيانات محلياً',err)}}
function emptyFor(d){return d.isObject?(d.nullable?null:{}):[]}
function emit(name,value,remote=false,refresh=false){window.dispatchEvent(new CustomEvent('cs:datachange',{detail:{domain:name,value,remote}}));if(remote&&refresh){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>location.reload(),350)}}
function serverBase(){const saved=localStorage.getItem('cs_server_url');if(saved)return saved.replace(/\/$/,'');if(location.protocol==='http:'||location.protocol==='https:')return location.origin.replace(/:\\d+$/,':4000');return null}
async function api(path,options={}){const base=serverBase();if(!base)throw new Error('السيرفر غير متاح');const key=localStorage.getItem('cs_access_key')||'';const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),3500);try{const res=await fetch(base+path,{...options,signal:controller.signal,headers:{'Content-Type':'application/json',...(key?{'x-access-key':key}:{}),...(options.headers||{})}});if(!res.ok)throw new Error('HTTP '+res.status);return res.json()}finally{clearTimeout(timeout)}}
async function fetchServer(name){return (await api('/api/data/'+encodeURIComponent(name))).value}
async function saveServer(name,value){await api('/api/data/'+encodeURIComponent(name),{method:'PUT',body:JSON.stringify({value,clientId})});dirty.delete(name)}
async function loadDomain(name){const d=DOMAINS[name];if(!d)return[];let cached=readCache(d.key);if(cached===null){try{const r=await fetch('/'+d.file);if(r.ok)cached=await r.json()}catch{}if(cached===null)cached=name==='categories'?DEFAULT_CATEGORIES:emptyFor(d);writeCache(d.key,cached)}if(name==='categories'&&Array.isArray(cached)&&!cached.length){cached=DEFAULT_CATEGORIES;writeCache(d.key,cached)}return cached}
async function syncFromServer(names,refresh=false){for(const name of names){if(!DOMAINS[name]||dirty.has(name))continue;try{const value=await fetchServer(name);if(value!==undefined&&JSON.stringify(value)!==JSON.stringify(get(name))){writeCache(DOMAINS[name].key,value);emit(name,value,true,refresh)}}catch{}}}
async function syncFromGitHubQuietly(names=[]){const cfg=getGitHubConfig();if(!cfg.token||!cfg.repo||!cfg.autoSync)return;for(const name of(names.length?names:Object.keys(DOMAINS))){const d=DOMAINS[name];try{const r=await fetchFileFromGitHub(d.file);if(r?.content!==undefined){writeCache(d.key,r.content);emit(name,r.content,true,true)}}catch{}}}
async function init(names=[]){const selected=names.length?names:Object.keys(DOMAINS);await Promise.all(selected.map(loadDomain));selected.forEach(x=>initialized.add(x));await syncFromServer(selected);syncFromGitHubQuietly(selected)}
function get(name){const d=DOMAINS[name];if(!d)return[];const value=readCache(d.key);return value===null?emptyFor(d):value}
function set(name,value){const d=DOMAINS[name];if(!d)return;dirty.add(name);writeCache(d.key,value);emit(name,value);channel?.postMessage({name,value,clientId});saveServer(name,value).catch(()=>{});schedulePushToGitHub(name,value)}
const pendingSyncTimers={};
function schedulePushToGitHub(name,value){const cfg=getGitHubConfig(),d=DOMAINS[name];if(!cfg.token||!cfg.repo||!cfg.autoSync||!d)return;clearTimeout(pendingSyncTimers[name]);pendingSyncTimers[name]=setTimeout(()=>saveFileToGitHub(d.file,value,`Auto update: ${name}`).catch(()=>{}),2000)}
async function pushAllToGitHub(){const cfg=getGitHubConfig();if(!cfg.token||!cfg.repo)throw new Error('يرجى ضبط بيانات GitHub أولاً');return Promise.all(Object.entries(DOMAINS).map(async([name,d])=>({name,ok:await saveFileToGitHub(d.file,get(name),`Initial Push: ${name}`)})))}
async function pullAllFromGitHub(){const cfg=getGitHubConfig();if(!cfg.token||!cfg.repo)throw new Error('يرجى ضبط بيانات GitHub أولاً');const results=[];for(const[name,d]of Object.entries(DOMAINS)){const r=await fetchFileFromGitHub(d.file);if(r?.content!==undefined){writeCache(d.key,r.content);emit(name,r.content,true,true);results.push({name,ok:true})}}return results}
channel?.addEventListener('message',e=>{if(e.data?.clientId!==clientId&&DOMAINS[e.data?.name]){writeCache(DOMAINS[e.data.name].key,e.data.value);emit(e.data.name,e.data.value,true,true)}});
window.addEventListener('storage',e=>{for(const[name,d]of Object.entries(DOMAINS))if(e.key===d.key&&e.newValue)emit(name,readCache(d.key),true,true)});
setInterval(()=>{const names=[...initialized];if(names.length)syncFromServer(names,true)},4000);
export const DataService={init,loadDomain,get,set,DOMAINS,pushAllToGitHub,pullAllFromGitHub,syncFromGitHubQuietly,syncFromServer};
export default DataService;
