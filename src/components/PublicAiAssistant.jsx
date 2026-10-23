import {useState} from 'react';
import {Link,useLocation} from 'react-router';
import {getPublicQuoteEstimate} from '../api/publicQuotes';
import {extractShipment,shipmentQuoteHref} from '../lib/assistantShipment';
export default function PublicAiAssistant({locale='en'}){
 const zh=locale==='zh',t=(a,b)=>zh?a:b,location=useLocation();
 const [open,setOpen]=useState(false),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[shipment,setShipment]=useState({}),[messages,setMessages]=useState([]);
 async function send(value=input){
  if(busy||!value.trim())return;
  const content=value.trim();setInput('');setBusy(true);
  let draft={};try{draft=JSON.parse(localStorage.getItem('eurasiago:unified-quote')||'{}');}catch{}
  const params=Object.fromEntries(new URLSearchParams(location.search));
  const next=extractShipment(content,{...draft,...params,...shipment});
  setShipment(next);setMessages(old=>[...old.slice(-11),{role:'user',text:content}]);
  let reply;
  try{
   if(/运踪|单号|订单|track|tracking|order status/i.test(content))reply=t('我目前不能直接读取实时运踪。请把订单号或箱号写入补充要求，转人工查询；我会保留这段对话。','Live shipment tracking is not connected. Add your order or container number to the request for our team to check.');
   else if(/资料|文件|documents|paperwork/i.test(content))reply=t('查参考运费先提供起始地、目的地和整箱/拼箱。拼箱总价需要体积与毛重；正式运输资料由销售按货物和服务范围确认。','For an estimate, provide origin, destination and FCL/LCL. LCL totals need both volume and gross weight. Sales will confirm shipment documents for your cargo and scope.');
   else if(!next.pol||!next.pod)reply=t('请补充'+(!next.pol?'起始城市':'')+(!next.pol&&!next.pod?'和':'')+(!next.pod?'目的城市':'')+'。例如：上海到汉堡，拼箱 8 CBM、5000 KG。','Please provide the missing origin or destination city. For example: Shanghai to Hamburg, LCL 8 CBM, 5000 KG.');
   else if(Number(next.volume)<0||Number(next.weight)<0)reply=t('体积和重量不能为负数，请更正。','Volume and weight cannot be negative. Please correct them.');
   else{
    const result=await getPublicQuoteEstimate(next);
    const route=next.pol+' → '+next.pod;
    if(result)reply=route+'\n'+t('参考','Indicative ')+(result.rateOnly?t('单价：','unit rate: '):t('总价：','total: '))+result.currency+' '+result.low.toFixed(2)+'–'+result.high.toFixed(2)+(result.rateOnly?t('/计费方。请补充体积和毛重后核算总价。',' / chargeable CBM. Add both volume and weight for a total.'):t('。计费数量：','; chargeable quantity: ')+result.quantity)+(next.serviceScope==='port_to_port'?t(' 仅铁路站到站。',' Rail terminal to terminal only.'):t(' 国内提货 + 铁路至目的站。',' Origin pickup + rail to destination terminal.'))+t(' 可继续修改条件，或点击下方转人工确认。',' Update the details or open the quote form for confirmation.');
    else reply=route+t(' 当前服务范围暂无可用售价。我已整理货物信息，点击下方进入统一报价/人工询盘，无需重新填写。',' has no published price for this service scope. Open the quote form below; your shipment details and conversation will carry over.');
   }
  }catch{reply=t('报价服务暂时无法连接，不能确认价格。信息已保留，可转人工核价。','The rate service is unavailable. Your details are preserved for a manual quote.');}
  setMessages(old=>[...old,{role:'assistant',text:reply}]);setBusy(false);
 }
 const notes=messages.filter(m=>m.role==='user').map(m=>m.text).join('\n');
 return <div className="fixed bottom-5 right-4 z-50">
  {open?<section aria-label={t('AI 报价助手','AI quote assistant')} className="flex max-h-[75dvh] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
   <header className="flex items-center justify-between bg-slate-950 px-4 py-3 text-white"><strong>{t('AI 报价助手','AI quote assistant')}</strong><button onClick={()=>setOpen(false)} aria-label={t('关闭客服','Close assistant')} className="px-2 py-1">×</button></header>
   <div role="log" aria-live="polite" className="space-y-3 overflow-y-auto p-4 text-sm">
    <p className="text-slate-600">{t('告诉我线路和货物信息，我会查询已发布的价格；没有价格时帮你转人工。','Share your route and cargo. I check published prices and prepare a manual inquiry when none match.')}</p>
    {messages.map((m,i)=><p key={i} className={'whitespace-pre-wrap rounded-xl p-3 '+(m.role==='user'?'ml-6 bg-blue-600 text-white':'mr-3 bg-slate-50 text-slate-700')}>{m.text}</p>)}
    {busy&&<p>{t('正在查询…','Checking…')}</p>}
    {!messages.length&&<button disabled={busy} onClick={()=>send(t('上海到汉堡，拼箱 8cbm 5000kg','Shanghai to Hamburg, LCL 8cbm 5000kg'))} className="rounded-xl border px-3 py-2 text-left">{t('试试：上海 → 汉堡，拼箱 8 方 / 5 吨','Try: Shanghai → Hamburg, LCL 8 CBM / 5 tons')}</button>}
   </div>
   <form onSubmit={e=>{e.preventDefault();send();}} className="flex gap-2 border-t p-3"><input aria-label={t('咨询内容','Your question')} value={input} onChange={e=>setInput(e.target.value)} placeholder={t('输入线路、货重或问题','Route, cargo or question')} className="min-w-0 flex-1 rounded-xl border px-3 py-2"/><button disabled={busy||!input.trim()} className="rounded-xl bg-blue-600 px-3 py-2 text-white disabled:opacity-50">{t('发送','Send')}</button></form>
   <Link onClick={()=>setOpen(false)} className="mx-3 mb-3 rounded-xl bg-slate-100 px-3 py-3 text-center text-sm font-semibold" to={shipmentQuoteHref(shipment,notes)}>{t('带入信息，报价 / 转人工','Continue to quote / sales')}</Link>
  </section>:<button onClick={()=>setOpen(true)} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg">{t('AI 客服','AI support')}</button>}
 </div>;
}
