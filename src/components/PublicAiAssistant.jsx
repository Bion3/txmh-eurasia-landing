import {useEffect,useRef,useState} from 'react';
import {Link,useLocation} from 'react-router';
import {getPublicQuoteEstimate} from '../api/publicQuotes';
import {extractShipment,shipmentQuoteHref} from '../lib/assistantShipment';
import {businessAnswer,isShipmentQuestion,quoteAnswer,readAssistantSession} from '../lib/businessAssistant';
const storageKey='eurasiago:business-assistant';
export default function PublicAiAssistant({locale='en'}){
 const zh=locale==='zh',t=(a,b)=>zh?a:b,location=useLocation();
 const [initial]=useState(()=>{try{return readAssistantSession(sessionStorage.getItem(storageKey));}catch{return {shipment:{},messages:[]};}});
 const [open,setOpen]=useState(false),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[shipment,setShipment]=useState(initial.shipment),[messages,setMessages]=useState(initial.messages);
 const ignoreUrl=useRef(false),locked=useRef(false),inputRef=useRef(null),logRef=useRef(null),launcherRef=useRef(null);
 useEffect(()=>{try{sessionStorage.setItem(storageKey,JSON.stringify({shipment,messages:messages.slice(-12)}));}catch{}},[shipment,messages]);
 useEffect(()=>{if(open)inputRef.current?.focus();},[open]);
 useEffect(()=>{if(open&&logRef.current)logRef.current.scrollTop=logRef.current.scrollHeight;},[messages,busy,open]);
 function close(){setOpen(false);launcherRef.current?.focus();}
 async function send(value=input){
  const content=value.trim();if(locked.current||!content||content.length>2000)return;
  locked.current=true;setInput('');setBusy(true);
  // Only explicit URL shipment fields are used; stale local form drafts are not reimported.
  const params=Object.fromEntries(new URLSearchParams(location.search));
  const seed={};for(const key of ['pol','pod','containerType','serviceScope','containerSize','quantity','volume','weight'])if(!ignoreUrl.current&&params[key]!==undefined)seed[key]=params[key];
  if(seed.containerType==='FCL'||seed.containerType==='LCL')seed.containerTypeExplicit=true;
  const next=extractShipment(content,{...seed,...shipment});
  setShipment(next);setMessages(old=>[...old.slice(-10),{role:'user',text:content}]);
  let reply;
  try{
   const answer=businessAnswer(content,locale);
   if(answer)reply=answer;
   else if(!isShipmentQuestion(content))reply=t('暂时没有匹配到这个问题。可以选择“查询运费”“服务范围”“常用单证”或“运踪查询”；其他问题请通过下方表单转人工。','I could not match that question. Choose “Check rates”, “Services”, “Documents” or “Tracking”; use the form below for other questions.');
   else if(!next.pol||!next.pod)reply=t('请补充'+(!next.pol?'起始城市':'')+(!next.pol&&!next.pod?'和':'')+(!next.pod?'目的城市':'')+'。已识别的线路和货物信息会保留，也可打开下方报价表选择其他城市。','Please provide the missing origin or destination. Your existing cargo details are retained. Use the quote form below to choose other cities.');
   else if(Number(next.volume)<0||Number(next.weight)<0)reply=t('体积和重量不能为负数，请更正。','Volume and weight cannot be negative. Please correct them.');
   else reply=quoteAnswer(await getPublicQuoteEstimate(next),next,locale);
  }catch{reply=t('报价服务暂时无法连接，不能确认价格。可携带当前信息转人工核价。','The rate service is unavailable. Carry the current details to the form below for a manual quote.');}
  finally{setMessages(old=>[...old,{role:'assistant',text:reply}]);locked.current=false;setBusy(false);}
 }
 function reset(){if(locked.current)return;ignoreUrl.current=true;setShipment({});setMessages([]);setInput('');inputRef.current?.focus();}
 const notes=messages.filter(m=>m.role==='user').map(m=>m.text).join('\n');
 const shortcuts=[['查询运费','Check rates'],['服务范围','Services'],['常用单证','Documents'],['运踪查询','Tracking']];
 return <div className="fixed bottom-5 right-4 z-50">
  <button ref={launcherRef} hidden={open} onClick={()=>setOpen(true)} aria-expanded={open} aria-controls="public-business-assistant" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg">{t('报价 / 客服','Quote / Support')}</button>
  {open&&<section id="public-business-assistant" aria-label={t('报价与业务助手','Quote and freight assistant')} onKeyDown={e=>{if(e.key==='Escape')close();}} className="flex max-h-[80dvh] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
   <header className="flex shrink-0 items-center justify-between bg-slate-950 px-4 py-3 text-white"><div><strong>{t('报价与业务助手','Quote and freight assistant')}</strong><p className="mt-1 text-xs text-slate-300">{t('快捷问答 · 运费查询 · 人工询盘','Quick answers · Rates · Sales inquiry')}</p></div><button onClick={close} aria-label={t('关闭客服','Close assistant')} className="px-2 py-1">×</button></header>
   <div className="flex shrink-0 flex-wrap gap-2 border-b p-3">{shortcuts.map(([cn,en])=><button key={en} disabled={busy} onClick={()=>send(t(cn,en))} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-50">{t(cn,en)}</button>)}</div>
   <div ref={logRef} role="log" aria-live="polite" className="min-h-0 space-y-3 overflow-y-auto p-4 text-sm">
    <p className="text-slate-600">{t('选择快捷问题，或告诉我线路和货物信息。运费取自系统已发布价格；没有匹配时可转人工。','Choose a quick question or share your route and cargo. Rates come from published system prices; unmatched requests can go to our team.')}</p>
    {messages.map((m,i)=><p key={i} className={'whitespace-pre-wrap break-words rounded-xl p-3 '+(m.role==='user'?'ml-6 bg-blue-600 text-white':'mr-3 bg-slate-50 text-slate-700')}>{m.text}</p>)}
    {busy&&<p>{t('正在查询…','Checking…')}</p>}
    {!messages.length&&<button disabled={busy} onClick={()=>send(t('上海到汉堡，拼箱 8cbm 5000kg','Shanghai to Hamburg, LCL 8cbm 5000kg'))} className="rounded-xl border px-3 py-2 text-left">{t('试试：上海 → 汉堡，拼箱 8 方 / 5 吨','Try: Shanghai → Hamburg, LCL 8 CBM / 5 tons')}</button>}
   </div>
   <form onSubmit={e=>{e.preventDefault();send();}} className="flex shrink-0 gap-2 border-t p-3"><input ref={inputRef} maxLength={2000} aria-label={t('咨询内容','Your question')} value={input} onChange={e=>setInput(e.target.value)} placeholder={t('输入线路、货重或问题','Route, cargo or question')} className="min-w-0 flex-1 rounded-xl border px-3 py-2"/><button disabled={busy||!input.trim()} className="rounded-xl bg-blue-600 px-3 py-2 text-white disabled:opacity-50">{t('发送','Send')}</button></form>
   <Link onClick={close} className="mx-3 mb-2 shrink-0 rounded-xl bg-slate-100 px-3 py-3 text-center text-sm font-semibold" to={shipmentQuoteHref(shipment,notes)}>{t('带入信息，报价 / 人工询盘','Continue to quote / sales inquiry')}</Link>
   <button onClick={reset} disabled={busy} className="mb-3 text-xs text-slate-500 disabled:opacity-50">{t('重新开始','Start over')}</button>
  </section>}
 </div>;
}
