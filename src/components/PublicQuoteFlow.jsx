import {useEffect, useRef, useState} from 'react';
import {useLocation} from 'react-router';
import {getPublicQuoteEstimate} from '../api/publicQuotes';
import {leadsApi} from '../api/leads';
import {usePersistentFormDraft} from '../hooks/usePersistentFormDraft';
import {captureAcquisitionAttribution} from '../lib/acquisitionAttribution';

const empty = {pol:'',pod:'',containerType:'FCL',containerSize:'',equipment:'',quantity:'',volume:'',weight:'',serviceScope:'port_to_port',cargo:'',notes:'',name:'',contact:''};
const inputClass='w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
export default function PublicQuoteFlow({locale='en'}) {
 const zh=locale==='zh', t=(a,b)=>zh?a:b;
 const location=useLocation();
 const [form,setForm,draft]=usePersistentFormDraft('eurasiago:unified-quote',empty);
 const [status,setStatus]=useState('idle'),[estimate,setEstimate]=useState(null),[contactOpen,setContactOpen]=useState(false),[sending,setSending]=useState(false),[message,setMessage]=useState('');
 const revision=useRef(0);
 useEffect(()=>{
  const params=new URLSearchParams(location.search), values={};
  for(const key of Object.keys(empty))if(params.has(key))values[key]=params.get(key);
  if(params.has('origin'))values.pol=params.get('origin');
  if(params.has('destination'))values.pod=params.get('destination');
  if(['FBA','DDP'].includes(values.containerType)){values.serviceScope=values.containerType==='FBA'?'fba_delivery':'ddp';values.containerType='LCL';}
  if(values.serviceScope==='amazon_fba')values.serviceScope='fba_delivery';
  if(Object.keys(values).length)setForm(old=>({...old,...values}));
  revision.current++;setStatus('idle');setEstimate(null);setContactOpen(false);
 },[location.search]);
 function change(key,value){setForm(old=>({...old,[key]:value}));setMessage('');if(!['name','contact','notes'].includes(key)){revision.current++;setEstimate(null);setStatus('idle');setContactOpen(false);}}
 async function calculate(event){
  event.preventDefault();const current=++revision.current;setMessage('');setEstimate(null);setContactOpen(false);
  if(!form.pol.trim()||!form.pod.trim())return setMessage(t('请填写起始地和目的地。','Enter origin and destination.'));
  if(form.containerType==='FCL'&&form.quantity!==''&&(!Number.isInteger(Number(form.quantity))||Number(form.quantity)<1))return setMessage(t('箱量须为正整数。','Container quantity must be a positive integer.'));
  setStatus('loading');
  try{const result=await getPublicQuoteEstimate(form);if(current!==revision.current)return;setEstimate(result);setStatus(result?'matched':'unmatched');if(!result)setContactOpen(true);}
  catch{if(current!==revision.current)return;setStatus('error');setContactOpen(true);}
 }
 async function submit(event){
  event.preventDefault();if(sending)return;
  const contact=form.contact.trim(), email=contact.includes('@');
  if(!form.name.trim()||!(email?/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact):contact.replace(/\D/g,'').length>=5))return setMessage(t('请填写姓名和有效邮箱或电话。','Enter your name and a valid email or phone number.'));
  setSending(true);setMessage('');
  try{
   const result=await leadsApi.createPublic({...captureAcquisitionAttribution({defaultSourceType:'website_form',touchpoint:'unified_quote'}).leadFields,contact_name:form.name.trim(),company_name:form.name.trim(),email:email?contact:null,phone:email?null:contact,origin:form.pol,destination:form.pod,cargo_desc:form.cargo||null,volume_cbm:Number(form.volume)||0,weight_kg:Number(form.weight)||0,source_type:'website_form',transport_mode_interest:'rail',shipment_type_interest:form.containerType==='FCL'?'FCL':'LCL',status:'new',message:JSON.stringify({source:location.pathname,service:form.containerType,scope:form.serviceScope,container:form.containerSize||'auto',equipment:form.equipment||'auto',quantity:form.quantity||1,notes:form.notes,estimate:estimate?{quoteId:estimate.quoteId,currency:estimate.currency,low:estimate.low,high:estimate.high,rateOnly:estimate.rateOnly,railSubtotal:estimate.railSubtotal,partial:estimate.partial,shipmentFee:estimate.shipmentFee,optionalPickup:estimate.optionalPickup,missingCosts:estimate.missingCosts,indicative:estimate.indicative,validFrom:estimate.validFrom}:null})});
   setMessage(result.data.notificationStatus==='sent'?t('询盘已保存，已通知销售。','Inquiry saved and sales notified.'):t('询盘已保存，邮件通知待确认，无需重复提交。','Inquiry saved. Email notification is unconfirmed; please do not resubmit.'));
   setStatus('submitted');setContactOpen(false);draft.clearDraft({...form,name:'',contact:''});
  }catch{setMessage(t('提交结果未确认，信息已保留。请稍后重试或联系销售。','Submission is unconfirmed. Your details are preserved; retry later or contact sales.'));}
  finally{setSending(false);}
 }
 const fields=(key,label,props={})=><label className="grid gap-1.5 text-sm font-medium text-slate-700"><span>{label}</span><input className={inputClass} value={form[key]} onChange={e=>change(key,e.target.value)} {...props}/></label>;
 const scopes={door_to_station:t('国内提货 + 铁路至目的站','Origin pickup + rail to terminal'),port_to_port:t('铁路站到站','Rail terminal to terminal'),door_to_door:t('门到门（含目的地派送）','Door to door'),fba_delivery:t('FBA 仓库派送','FBA delivery'),ddp:t('DDP 服务','DDP service')};
 return <section id="public-quote" className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-900/10 sm:p-7 lg:p-8">
  <h1 className="text-2xl font-bold text-slate-950">{t('获取运费报价','Get a freight quote')}</h1>
  <p className="mt-2 text-sm text-slate-500">{t('默认查询铁路站到站价格；需国内提货或送货，可切换服务范围。暂无公开价可提交人工询盘。','Rail terminal-to-terminal rates are the default. Change the service scope for pickup or delivery; request a manual quote when no rate is published.')}</p>
  <form onSubmit={calculate} className="mt-5 space-y-4">
   <fieldset disabled={sending} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {fields('pol',t('起始地','Origin'),{required:true,placeholder:t('例如：上海','e.g. Shanghai')})}
    {fields('pod',t('目的地','Destination'),{required:true,placeholder:t('例如：汉堡','e.g. Hamburg')})}
    <label className="grid gap-1.5 text-sm font-medium text-slate-700"><span>{t('运输方式','Shipment')}</span><select className={inputClass} value={form.containerType} onChange={e=>change('containerType',e.target.value)}><option value="FCL">{t('铁路整箱','Rail FCL')}</option><option value="LCL">{t('铁路拼箱','Rail LCL')}</option></select></label>
    <label className="grid gap-1.5 text-sm font-medium text-slate-700"><span>{t('服务范围','Service scope')}</span><select className={inputClass} value={form.serviceScope} onChange={e=>change('serviceScope',e.target.value)}>{Object.entries(scopes).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    {form.containerType==='LCL'&&<>{fields('volume',t('体积（CBM，选填）','Volume (CBM, optional)'),{type:'number',min:'0.001',step:'any'})}{fields('weight',t('毛重（KG，选填）','Weight (KG, optional)'),{type:'number',min:'0.001',step:'any'})}</>}
   </fieldset>
   <details className="rounded-xl bg-slate-50 px-4 py-3"><summary className="cursor-pointer text-sm text-slate-600">{t('更多信息（选填）','More details (optional)')}</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">
    {form.containerType==='FCL'&&<><label className="grid gap-1.5 text-sm"><span>{t('箱型','Container')}</span><select className={inputClass} value={form.containerSize} onChange={e=>change('containerSize',e.target.value)}><option value="">{t('自动匹配','Auto match')}</option>{['40HQ','40GP','20GP','45HQ'].map(value=><option key={value}>{value}</option>)}</select></label><label className="grid gap-1.5 text-sm"><span>{t('用箱方式','Container ownership')}</span><select className={inputClass} value={form.equipment} onChange={e=>change('equipment',e.target.value)}><option value="">{t('自动匹配','Auto match')}</option><option value="SOC">SOC</option><option value="COC">COC</option></select></label>{fields('quantity',t('箱量（默认 1 箱）','Quantity (default 1)'),{type:'number',min:1,step:1})}</>}
    {fields('cargo',t('货物名称','Cargo'))}{fields('notes',t('补充要求','Additional requirements'))}
   </div></details>
   <button disabled={status==='loading'||sending} className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{status==='loading'?t('正在查询…','Checking…'):t('查看价格','Check price')}</button>
  </form>
  <div aria-live="polite" className="mt-4">
   {estimate&&<div className="rounded-xl bg-blue-50 p-5"><div className="text-sm text-blue-800">{estimate.rateOnly?t('铁路参考单价（非总价）','Rail-only unit reference (not a total)'):estimate.partial?t('已匹配费用组合（非全程总价）','Matched cost components (not door-to-door total)'):estimate.railSubtotal?t('铁路拼箱费用小计（不含国内和目的地费用）','Rail LCL subtotal (excluding local and destination charges)'):estimate.indicative?t('铁路站到站预估运费','Indicative station-to-station rail freight'):t('参考运费','Indicative freight')}</div><div className="mt-1 text-3xl font-bold text-blue-950">{estimate.currency} {estimate.low.toLocaleString(undefined,{maximumFractionDigits:2})}{estimate.high!==estimate.low?`–${estimate.high.toLocaleString(undefined,{maximumFractionDigits:2})}`:''}</div><p className="mt-2 text-sm text-blue-800">{estimate.rateOnly?t('每计费方。尚有每票操作费及其他费用待核实，填写体积和重量也不能视为完整总价。','Per chargeable CBM. Per-shipment handling and other charges need verification; this is not a total even with weight and volume.'):t(`按 ${estimate.quantity} ${estimate.unit==='container'?'箱':'计费方'}计算`,`Based on ${estimate.quantity} ${estimate.unit}`)}{estimate.container?` · ${estimate.container}`:''}{estimate.equipment?` · ${estimate.equipment}`:''}</p>{estimate.partial&&<div className="mt-3 rounded-lg bg-white/80 p-3 text-sm text-blue-900"><p>{t('国内干线','Domestic linehaul')}: USD {estimate.domesticLinehaul.toLocaleString(undefined,{maximumFractionDigits:2})}</p><p>{t('铁路段（含已知每票费）','Rail segment (confirmed shipment fee included)')}: USD {estimate.railwaySubtotal.toLocaleString(undefined,{maximumFractionDigits:2})}</p><p className="mt-1 text-xs">{t('经集货站','Via consolidation station')}: {estimate.consolidationStation}</p><p className="mt-2 text-xs font-semibold">{t('未包含：门点提货、境外清关及末端配送等费用。','Not included: origin pickup, destination clearance, last-mile delivery and applicable extras.')}</p></div>}{estimate.partial&&estimate.optionalPickup&&<div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900"><p className="font-semibold">{t('通用提货阶梯参考（未计入上方小计）','Generic pickup tier reference (not included above)')}: USD {estimate.optionalPickup.amount.toLocaleString(undefined,{maximumFractionDigits:2})} / {t('票','shipment')}</p><p>{estimate.optionalPickup.tier} · {t('实际提货城市、距离及服务适用性须人工确认','City, distance and service applicability require verification')}</p></div>}{estimate.railSubtotal&&<p className="mt-2 text-sm text-blue-900">{t(`计费方 ${estimate.quantity.toLocaleString(undefined,{maximumFractionDigits:2})} × USD ${estimate.unitPrice.toLocaleString(undefined,{maximumFractionDigits:2})} + 每票已确认费用 USD ${estimate.shipmentFee.toLocaleString(undefined,{maximumFractionDigits:2})}`,`Chargeable CBM ${estimate.quantity.toLocaleString(undefined,{maximumFractionDigits:2})} × USD ${estimate.unitPrice.toLocaleString(undefined,{maximumFractionDigits:2})} + confirmed fee USD ${estimate.shipmentFee.toLocaleString(undefined,{maximumFractionDigits:2})}`)}</p>}{estimate.rateOnly&&estimate.railQty&&<p className="mt-1 text-xs text-blue-800">{t(`当前货量对应约 ${estimate.railQty.toLocaleString(undefined,{maximumFractionDigits:2})} 计费方，实际整票费用须加上另计费用后人工核实。`,`Estimated ${estimate.railQty.toLocaleString(undefined,{maximumFractionDigits:2})} chargeable CBM; total requires manual verification of additional fees.`)}</p>}<p className="mt-2 text-xs text-blue-800">{scopes[form.serviceScope]}{estimate.validFrom?` · ${t('报价适用起','Rate from')} ${estimate.validFrom}`:''}{estimate.validUntil?` · ${t('有效至','Valid to')} ${estimate.validUntil}`:''}</p>{estimate.note&&<p className="mt-3 rounded-lg bg-white/80 px-3 py-2 text-xs leading-6 text-blue-900">{estimate.note}</p>}{estimate.indicative&&<p className="mt-2 text-xs font-semibold text-amber-800">{t('仅为按采购数据自动推算的参考价，尚未核实为正式报价。','Automatically derived reference, not a verified firm quote.')}</p>}</div>}
   {(status==='unmatched'||status==='error')&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{status==='error'?t('暂时无法连接报价服务，可留下联系方式由人工报价。','The rate service is unavailable. Leave your contact for a manual quote.'):t('该线路或服务范围暂未发布销售价，仍可提交人工询盘。','No approved public selling rate is published for this route or service scope. You can still submit an inquiry.')}</p>}
   {estimate&&!contactOpen&&status!=='submitted'&&<button onClick={()=>setContactOpen(true)} className="mt-3 w-full rounded-xl border border-blue-200 px-4 py-3 font-semibold text-blue-700">{t('请人工确认报价','Request a firm quote')}</button>}
   {message&&<p role="status" className="mt-3 rounded-xl bg-slate-50 p-4 text-sm">{message}</p>}
  </div>
  {contactOpen&&<form onSubmit={submit} className="mt-4 space-y-4 border-t border-slate-100 pt-4"><div className="grid gap-4 sm:grid-cols-2">{fields('name',t('联系人','Name'),{required:true,disabled:sending})}{fields('contact',t('邮箱 / 电话 / WhatsApp','Email / phone / WhatsApp'),{required:true,disabled:sending})}</div><button disabled={sending} className="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-50">{sending?t('正在提交…','Submitting…'):t('提交人工询盘','Send inquiry')}</button></form>}
  <p className="mt-4 text-xs text-slate-400">{t('预估价仅供参考，最终以确认的服务范围和正式报价为准。','Indicative pricing; final scope and quotation require confirmation.')}</p>
 </section>;
}
