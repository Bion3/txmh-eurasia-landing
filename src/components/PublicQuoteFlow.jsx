import {useEffect, useRef, useState} from 'react';
import {destinationRegion,destinationRegions} from '../lib/destinationRegions';
import {useLocation} from 'react-router';
import {getPublicQuoteEstimate,getPricedDestinationChoices,getFclStationSuggestions} from '../api/publicQuotes';
import {checkLclCargoRestrictions,lclTermsZh,lclTermsEn} from '../lib/lclQuoteRestrictions';
import {fclQuoteTerms} from '../lib/fclQuoteTerms';
import {leadsApi} from '../api/leads';
import {usePersistentFormDraft} from '../hooks/usePersistentFormDraft';
import {captureAcquisitionAttribution} from '../lib/acquisitionAttribution';

const empty = {pol:'',loadingArea:'',emptyPickupCity:'',pod:'',containerType:'FCL',containerSize:'',equipment:'',quantity:'',volume:'',weight:'',pieceLength:'',pieceWidth:'',pieceHeight:'',pieceWeight:'',cargoRisk:'unspecified',serviceScope:'port_to_port',cargo:'',notes:'',name:'',contact:''};
const inputClass='w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
export default function PublicQuoteFlow({locale='en'}) {
 const zh=locale==='zh', t=(a,b)=>zh?a:b;
 const location=useLocation();
 const [form,setForm,draft]=usePersistentFormDraft('eurasiago:unified-quote',empty);
 const [status,setStatus]=useState('idle'),[estimate,setEstimate]=useState(null),[contactOpen,setContactOpen]=useState(false),[sending,setSending]=useState(false),[message,setMessage]=useState('');
 const [stationSuggestions,setStationSuggestions]=useState([]);
 const [destinationArea,setDestinationArea]=useState('all');
 const [destinationFocused,setDestinationFocused]=useState(false);
 const [pricedDestinations,setPricedDestinations]=useState([]),[destinationsLoading,setDestinationsLoading]=useState(true),[destinationsError,setDestinationsError]=useState(false);
 const revision=useRef(0);
 useEffect(()=>{
  let alive=true;
  getPricedDestinationChoices().then(rows=>{
    if(!alive)return;
    setPricedDestinations(rows);setDestinationsError(false);
  }).catch(()=>{if(alive)setDestinationsError(true);})
    .finally(()=>{if(alive)setDestinationsLoading(false);});
  return ()=>{alive=false;};
 },[]);
 const pricedRoutes=pricedDestinations.filter(r=>r.transport===(form.containerType==='FCL'?'fcl':'lcl'));
 const pricedStops=[...new Set(pricedRoutes.map(r=>String(r.destination||'').trim()).filter(Boolean))]
  .sort((a,b)=>a.localeCompare(b,zh?'zh-CN':'en'));
 const pricedForSelected=pricedRoutes.some(r=>r.destination===form.pod);
 const areaStops=pricedStops.filter(stop=>destinationArea==='all'||destinationRegion(stop)===destinationArea);
 const destinationMatches=areaStops.filter(stop=>!form.pod.trim()||stop.toLowerCase().includes(form.pod.trim().toLowerCase())).slice(0,35);

 useEffect(()=>{
  const params=new URLSearchParams(location.search), values={};
  for(const key of Object.keys(empty))if(params.has(key))values[key]=params.get(key);
  if(params.has('origin'))values.pol=params.get('origin');
  if(params.has('destination'))values.pod=params.get('destination');
  if(['FBA','DDP'].includes(values.containerType)){values.serviceScope=values.containerType==='FBA'?'fba_delivery':'ddp';values.containerType='LCL';}
  if(values.serviceScope==='amazon_fba')values.serviceScope='fba_delivery';
  if(Object.keys(values).length)setForm(old=>({...old,...values}));
  revision.current++;setStatus('idle');setEstimate(null);setContactOpen(false);setStationSuggestions([]);
 },[location.search]);
 function change(key,value){setForm(old=>key==='containerType'&&old.containerType!==value?{...old,containerType:value,pod:'',loadingArea:'',emptyPickupCity:''}:key==='pol'&&old.pol!==value?{...old,pol:value,loadingArea:'',emptyPickupCity:''}:{...old,[key]:value});setMessage('');if(!['name','contact','notes'].includes(key)){revision.current++;setEstimate(null);setStatus('idle');setContactOpen(false);setStationSuggestions([]);}}
 async function calculate(event){
  event.preventDefault();const current=++revision.current;setMessage('');setEstimate(null);setContactOpen(false);setStationSuggestions([]);
  if(!form.pol.trim()||!form.pod.trim())return setMessage(t('请填写起始地和目的地。','Enter origin and destination.'));
  if(form.containerType==='FCL'&&form.quantity!==''&&(!Number.isInteger(Number(form.quantity))||Number(form.quantity)<1))return setMessage(t('箱量须为正整数。','Container quantity must be a positive integer.'));
  const restrictions=checkLclCargoRestrictions(form);
  if(restrictions.manualRequired){setStatus('restricted');setMessage(t('这票货物触发特殊装载或加价条件，需要人工确认，暂不显示可能漏费的自动报价。','This cargo requires special handling or rate confirmation. Automatic pricing is withheld to avoid omitted fees.'));setContactOpen(true);return;}
  setStatus('loading');
  try{const result=await getPublicQuoteEstimate(form);if(current!==revision.current)return;setEstimate(result);setStatus(result?'matched':'unmatched');if(!result)setContactOpen(true);if(form.containerType==='FCL'){const suggestions=await getFclStationSuggestions(form).catch(()=>[]);if(current===revision.current)setStationSuggestions(suggestions);}}
  catch{if(current!==revision.current)return;setStatus('error');setContactOpen(true);}
 }
 async function submit(event){
  event.preventDefault();if(sending)return;
  const contact=form.contact.trim(), email=contact.includes('@');
  if(!form.name.trim()||!(email?/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact):contact.replace(/\D/g,'').length>=5))return setMessage(t('请填写姓名和有效邮箱或电话。','Enter your name and a valid email or phone number.'));
  setSending(true);setMessage('');
  try{
   const result=await leadsApi.createPublic({...captureAcquisitionAttribution({defaultSourceType:'website_form',touchpoint:'unified_quote'}).leadFields,contact_name:form.name.trim(),company_name:form.name.trim(),email:email?contact:null,phone:email?null:contact,origin:form.pol,destination:form.pod,cargo_desc:form.cargo||null,volume_cbm:Number(form.volume)||0,weight_kg:Number(form.weight)||0,source_type:'website_form',transport_mode_interest:'rail',shipment_type_interest:form.containerType==='FCL'?'FCL':'LCL',status:'new',message:JSON.stringify({source:location.pathname,service:form.containerType,scope:form.serviceScope,container:form.containerSize||'auto',equipment:form.equipment||'auto',quantity:form.quantity||1,loadingArea:form.loadingArea||null,emptyPickupCity:form.emptyPickupCity||null,notes:form.notes,cargoRisk:form.cargoRisk,pieceDimensions:{lengthM:form.pieceLength,widthM:form.pieceWidth,heightM:form.pieceHeight,weightKg:form.pieceWeight},reviewFlags:checkLclCargoRestrictions(form).reasons,estimate:estimate?{quoteId:estimate.quoteId,currency:estimate.currency,low:estimate.low,high:estimate.high,rateOnly:estimate.rateOnly,railSubtotal:estimate.railSubtotal,partial:estimate.partial,shipmentFee:estimate.shipmentFee,optionalPickup:estimate.optionalPickup,pickupDistance:estimate.pickupDistance,missingCosts:estimate.missingCosts,indicative:estimate.indicative,validFrom:estimate.validFrom}:null})});
   setMessage(result.data.notificationStatus==='sent'?t(email?'询盘已保存，已向客户邮箱和业务邮箱发送同一封邮件，请使用“回复全部”沟通。':'询盘已保存，已邮件通知业务人员；如需客户邮件副本，请提供邮箱。',email?'Inquiry saved. Customer and sales share one email conversation; use Reply All.':'Inquiry saved. Sales was notified; enter an email to receive a customer copy.'):t('询盘已保存，邮件通知待确认，无需重复提交。','Inquiry saved. Email notification is unconfirmed; please do not resubmit.'));
   setStatus('submitted');setContactOpen(false);draft.clearDraft({...form,name:'',contact:''});
  }catch{setMessage(t('提交结果未确认，信息已保留。请稍后重试或联系销售。','Submission is unconfirmed. Your details are preserved; retry later or contact sales.'));}
  finally{setSending(false);}
 }
 const fields=(key,label,props={})=><label className="grid gap-1.5 text-sm font-medium text-slate-700"><span>{label}</span><input className={inputClass} value={form[key]} onChange={e=>change(key,e.target.value)} {...props}/></label>;
 const scopes={door_to_station:t('国内提货 + 铁路至目的站','Origin pickup + rail to terminal'),port_to_port:t('铁路站到站','Rail terminal to terminal'),door_to_door:t('门到门（含目的地派送）','Door to door'),fba_delivery:t('FBA 仓库派送','FBA delivery'),ddp:t('DDP 服务','DDP service')};
 return <section id="public-quote" className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-900/10 sm:p-6 lg:p-7">
  <h1 className="text-2xl font-bold text-slate-950">{t('获取运费报价','Get a freight quote')}</h1>
  <p className="mt-2 text-sm text-slate-500">{t('填写提货地与目的地，查看可选运输方案和价格。','Enter pickup and destination to compare available routes and prices.')}</p>
  <form onSubmit={calculate} className="mt-4 space-y-3">
   <fieldset disabled={sending} className="grid grid-cols-2 gap-2" aria-label={t('选择运输方式','Choose shipment type')}>
    {[
      {id:'FCL',cn:'整柜 FCL',en:'Full Container · FCL',hintCn:'按箱型 / 箱量报价',hintEn:'Container & quantity'},
      {id:'LCL',cn:'拼箱 LCL',en:'Less than Container · LCL',hintCn:'按体积 / 毛重报价',hintEn:'Volume & weight'}
    ].map(mode=><button key={mode.id} type="button" onClick={()=>change('containerType',mode.id)}
      aria-pressed={form.containerType===mode.id}
      className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${form.containerType===mode.id?'border-blue-600 bg-blue-50 text-blue-950 ring-1 ring-blue-600':'border-slate-200 bg-white text-slate-600 hover:border-blue-300'}`}>
      <span className="block text-sm font-bold">{zh?mode.cn:mode.en}</span>
      <span className="mt-0.5 block text-xs opacity-70">{zh?mode.hintCn:mode.hintEn}</span>
     </button>)}
   </fieldset>
   <fieldset disabled={sending} className="grid gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
    <label className="grid gap-1.5 text-sm font-medium text-slate-700"><span>{t('服务范围','Service scope')}</span><select className={inputClass} value={form.serviceScope} onChange={e=>change('serviceScope',e.target.value)}>{Object.entries(scopes).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    {fields('pol',t('起运地 / 提货城市','Origin / Pickup city'),{required:true,placeholder:t('例如：太仓 / 上海','e.g. Taicang / Shanghai')})}
    <div className="grid gap-1.5 text-sm font-medium text-slate-700">
      <span>{t('目的地 / 目的站','Destination / Terminal')}</span>
      <datalist id="eurasiago-pricing-destinations">{areaStops.map(stop=><option key={stop} value={stop}/>)}</datalist>
      <div className="grid grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)] gap-2">
        <select className={inputClass} aria-label={t('目的地区域','Destination region')} value={destinationArea} onChange={e=>{setDestinationArea(e.target.value);setDestinationFocused(true);}}>
          {destinationRegions.map(([id,cn,en])=><option key={id} value={id}>{zh?cn:en}</option>)}
        </select>
        <div className="relative min-w-0">
          <input className={inputClass} required value={form.pod} autoComplete="off"
            onFocus={()=>setDestinationFocused(true)} onBlur={()=>setDestinationFocused(false)}
            onChange={e=>{change('pod',e.target.value);setDestinationFocused(true)}}
            placeholder={t('搜索或输入目的站','Search or type destination')}
            aria-label={t('目的站','Destination station')} aria-expanded={destinationFocused}/>
          {destinationFocused&&areaStops.length>0&&<div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl" role="listbox" aria-label={t('目的站建议','Destination suggestions')}>
            {destinationMatches.length?destinationMatches.map(stop=><button key={stop} type="button" role="option" aria-selected={form.pod===stop}
              onMouseDown={e=>e.preventDefault()} onClick={()=>{change('pod',stop);setDestinationFocused(false)}}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm font-normal hover:bg-blue-50 focus:bg-blue-50">{stop}</button>):<div className="px-3 py-2 text-xs font-normal text-slate-500">{t('没有匹配站点，可直接输入','No matches; you can type a destination')}</div>}
          </div>}
        </div>
      </div>
      <span className="text-xs font-normal text-slate-500" aria-live="polite">
        {destinationsLoading?t('正在读取价格站点…','Loading priced destinations…'):destinationsError?t('站点列表暂不可用，可手动填写','Station list unavailable; type a destination'):pricedForSelected?t('该目的站有可查询线路','Routes available for this destination'):zh?'当前区域 '+areaStops.length+' 个有价目的站，也可手动输入其他站点':areaStops.length+' priced destinations in this region; other destinations may be typed'}
      </span>
    </div>
    {form.containerType==='FCL'?
      <><label className="grid gap-1.5 text-sm font-medium text-slate-700"><span>{t('箱型','Container size')}</span><select className={inputClass} value={form.containerSize} onChange={e=>change('containerSize',e.target.value)}><option value="">{t('自动匹配箱型','Auto match size')}</option>{['40HQ','40GP','20GP','45HQ'].map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label className="grid gap-1.5 text-sm font-medium text-slate-700"><span>{t('用箱方式','SOC / COC')}</span><select className={inputClass} value={form.equipment} onChange={e=>change('equipment',e.target.value)}><option value="">{t('自动匹配','Auto match')}</option><option value="SOC">SOC</option><option value="COC">COC</option></select></label>
      {fields('quantity',t('箱量（默认1箱）','Quantity (default 1)'),{type:'number',min:1,step:1})}
      </>:
      <>{fields('volume',t('货物体积 CBM','Volume · CBM'),{type:'number',min:'0.001',step:'any'})}{fields('weight',t('毛重 KG','Gross weight · KG'),{type:'number',min:'0.001',step:'any'})}</>}
   </fieldset>
   <details className="rounded-xl bg-slate-50 px-4 py-3"><summary className="cursor-pointer text-sm text-slate-600">{t('更多信息（选填）','More details (optional)')}</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">
    {form.containerType==='FCL'&&<>
      <label className="grid gap-1.5 text-sm font-medium text-slate-700"><span>{t('工厂装箱区县（选填）','Factory loading area (optional)')}</span>
       <input className={inputClass} list="eurasiago-fcl-loading-areas" value={form.loadingArea} onChange={e=>change('loadingArea',e.target.value)}
        placeholder={t('如：上海市,浦东新区','e.g. Shanghai, Pudong')}/>
       <datalist id="eurasiago-fcl-loading-areas">{[...new Set(stationSuggestions.flatMap(x=>(x.truckingLocations||[]).map(y=>y.loading_area)))].map(a=><option key={a} value={a}/>)}</datalist>
      </label>
      {fields('emptyPickupCity',t('空箱提箱城市（选填）','Empty-container pickup city (optional)'),{placeholder:t('如：上海；留空自动筛选','e.g. Shanghai; leave blank for options')})}

    </>}
    
    {fields('cargo',t('货物名称','Cargo'))}{fields('notes',t('补充要求','Additional requirements'))}
    {form.containerType==='LCL'&&<><label className="grid gap-1.5 text-sm"><span>{t('货物类型 / 特殊要求','Cargo classification')}</span><select className={inputClass} value={form.cargoRisk} onChange={e=>change('cargoRisk',e.target.value)}>
      <option value="unspecified">{t('未确认（按普通货参考）','Unspecified (general cargo reference)')}</option>
      <option value="general">{t('确认普通货，无危险或特殊属性','Confirmed ordinary cargo')}</option>
      <option value="special">{t('机械 / 模具 / 车辆 / 玻璃 / 化工品 / 金属等','Machinery / molds / vehicles / glass / chemicals / metal')}</option>
      <option value="restricted">{t('危险品 / 电池 / 含油 / 制冷剂 / 磁性 / 气液压装置 / 易腐','Restricted: DG / battery / oil / refrigerant / magnetic / pneumatic / perishable')}</option>
     </select></label>
    <div className="col-span-full grid grid-cols-2 gap-3 sm:grid-cols-4">
     {fields('pieceLength',t('最长单件长（米）','Longest piece (m)'),{type:'number',min:0,step:'any'})}
     {fields('pieceWidth',t('最宽单件宽（米）','Widest piece (m)'),{type:'number',min:0,step:'any'})}
     {fields('pieceHeight',t('最高单件高（米）','Tallest piece (m)'),{type:'number',min:0,step:'any'})}
     {fields('pieceWeight',t('最重单件重量（KG）','Heaviest piece (kg)'),{type:'number',min:0,step:'any'})}
    </div></>}
   </div></details>
   {form.containerType==='LCL'&&checkLclCargoRestrictions(form).manualRequired&&<div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>{t('特殊货物：需要人工确认','Special cargo: manual review required')}</strong><ul className="mt-2 list-disc space-y-1 pl-5">{checkLclCargoRestrictions(form).notices.map((line,i)=><li key={i}>{zh?line:({bulkShipment:lclTermsEn[0],oversizePiece:lclTermsEn[2],excludedCargo:lclTermsEn[6],specialCargo:lclTermsEn[5]})[checkLclCargoRestrictions(form).reasons[i]]}</li>)}</ul></div>}
   {form.containerType==='LCL'&&<details className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><summary className="cursor-pointer text-sm font-medium text-slate-700">{t('拼箱运输须知（7条）','LCL shipping notes (7 points)')}</summary><ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-6 text-slate-600">{(zh?lclTermsZh:lclTermsEn).map((term,i)=><li key={i}>{term}</li>)}</ol><p className="mt-2 text-xs text-slate-500">{t('超限与特殊货物需人工确认；商检、查验及额外作业费不包含在自动参考价中。','Oversize and special cargo require approval; inspections and extra handling are not included in automated reference rates.')}</p></details>}
   <button disabled={status==='loading'||sending} className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">{status==='loading'?t('正在查询…','Checking…'):t('查看价格','Check price')}</button>
  </form>
  <div aria-live="polite" className="mt-4">
   {estimate&&!(form.containerType==='FCL'&&stationSuggestions.some(s=>(s.quotePlans||[]).length>0))&&<div className="rounded-xl bg-blue-50 p-5"><div className="text-sm text-blue-800">{estimate.rateOnly?t('铁路参考单价（非总价）','Rail-only unit reference (not a total)'):estimate.partial?t('已匹配费用组合（非全程总价）','Matched cost components (not door-to-door total)'):estimate.railSubtotal?t('铁路拼箱费用小计（不含国内和目的地费用）','Rail LCL subtotal (excluding local and destination charges)'):estimate.indicative?t('铁路站到站预估运费','Indicative station-to-station rail freight'):t('参考运费','Indicative freight')}</div><div className="mt-1 text-3xl font-bold text-blue-950">{estimate.currency} {estimate.low.toLocaleString(undefined,{maximumFractionDigits:2})}{estimate.high!==estimate.low?`–${estimate.high.toLocaleString(undefined,{maximumFractionDigits:2})}`:''}</div><p className="mt-2 text-sm text-blue-800">{estimate.rateOnly?t('每计费方。尚有每票操作费及其他费用待核实，填写体积和重量也不能视为完整总价。','Per chargeable CBM. Per-shipment handling and other charges need verification; this is not a total even with weight and volume.'):t(`按 ${estimate.quantity} ${estimate.unit==='container'?'箱':'计费方'}计算`,`Based on ${estimate.quantity} ${estimate.unit}`)}{estimate.container?` · ${estimate.container}`:''}{estimate.equipment?` · ${estimate.equipment}`:''}</p>{estimate.partial&&<div className="mt-3 rounded-lg bg-white/80 p-3 text-sm text-blue-900"><p className="font-semibold">{t('国内运输分段','Domestic freight segments')}: {estimate.pickupOriginCity||form.pol} → {estimate.receivingWarehouseCity||estimate.consolidationStation} → {estimate.consolidationStation}</p><p>{t('收货仓至铁路装箱站干线','Receiving warehouse to rail loading station')}: {estimate.receivingWarehouseCity||form.pol} → {estimate.consolidationStation} · {estimate.domesticLinehaulIncluded===false?t('同城无独立干线','No intercity linehaul'): `USD ${estimate.domesticLinehaul.toLocaleString(undefined,{maximumFractionDigits:2})}`}</p><p>{t('铁路段（含已知每票费）','Rail segment (confirmed shipment fee included)')}: USD {estimate.railwaySubtotal.toLocaleString(undefined,{maximumFractionDigits:2})}</p><p className="mt-2 text-xs font-semibold">{t('未包含：门点提货、境外清关及末端配送等费用。','Not included: origin pickup, destination clearance, last-mile delivery and applicable extras.')}</p></div>}{estimate.partial&&estimate.pickupDistance&&<div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
 <strong>{t('本地提货距离估算（非国内干线）','Local pickup distance estimate (not intercity linehaul)')}</strong> · {estimate.pickupDistance.originCity||form.pol} → {estimate.pickupDistance.warehouseCity||estimate.consolidationStation}
 {Number.isFinite(estimate.pickupDistance.estimatedRoadKm)?` · ≈${estimate.pickupDistance.estimatedRoadKm} km`:''}
 <p className="mt-1">{estimate.pickupDistance.status==='likely_within'
 ?t('按提货地市中心至收货仓所在城市中心估算，预计在100公里内；实际仓库位置及公路里程需核实。','Estimated between pickup and receiving-warehouse city centres; likely within 100 km. Warehouse address and actual driving distance require confirmation.')
 :estimate.pickupDistance.status==='outside'
 ?t('提货地距该收货仓城市中心估算超过100公里，不套用本地提货阶梯价。','Estimated pickup distance to this receiving city exceeds 100 km; pickup tier not applied.')
 :t('距离无法可靠确定或接近100公里边界，提货价需人工核实。','Distance unknown or near the 100 km limit; pickup price requires verification.')}</p>
 </div>}{estimate.partial&&estimate.optionalPickup&&<div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900"><p className="font-semibold">{t('通用提货阶梯参考（未计入上方小计）','Generic pickup tier reference (not included above)')}: USD {estimate.optionalPickup.amount.toLocaleString(undefined,{maximumFractionDigits:2})} / {t('票','shipment')}</p><p>{estimate.optionalPickup.tier} · {t('市中心估算；实际仓库和公路里程须核实','City-centre estimate; actual warehouse and road distance must be verified')}</p></div>}{estimate.railSubtotal&&<p className="mt-2 text-sm text-blue-900">{t(`计费方 ${estimate.quantity.toLocaleString(undefined,{maximumFractionDigits:2})} × USD ${estimate.unitPrice.toLocaleString(undefined,{maximumFractionDigits:2})} + 每票已确认费用 USD ${estimate.shipmentFee.toLocaleString(undefined,{maximumFractionDigits:2})}`,`Chargeable CBM ${estimate.quantity.toLocaleString(undefined,{maximumFractionDigits:2})} × USD ${estimate.unitPrice.toLocaleString(undefined,{maximumFractionDigits:2})} + confirmed fee USD ${estimate.shipmentFee.toLocaleString(undefined,{maximumFractionDigits:2})}`)}</p>}{estimate.rateOnly&&estimate.railQty&&<p className="mt-1 text-xs text-blue-800">{t(`当前货量对应约 ${estimate.railQty.toLocaleString(undefined,{maximumFractionDigits:2})} 计费方，实际整票费用须加上另计费用后人工核实。`,`Estimated ${estimate.railQty.toLocaleString(undefined,{maximumFractionDigits:2})} chargeable CBM; total requires manual verification of additional fees.`)}</p>}<p className="mt-2 text-xs text-blue-800">{scopes[form.serviceScope]}{estimate.validFrom?` · ${t('报价适用起','Rate from')} ${estimate.validFrom}`:''}{estimate.validUntil?` · ${t('有效至','Valid to')} ${estimate.validUntil}`:''}</p>{estimate.note&&form.containerType==='LCL'&&<p className="mt-3 rounded-lg bg-white/80 px-3 py-2 text-xs leading-6 text-blue-900">{estimate.note}</p>}{estimate.indicative&&<p className="mt-2 text-xs font-semibold text-amber-800">{t('参考价格，最终以订舱确认及正式报价为准。','Indicative rate; final price is subject to booking confirmation.')}</p>}</div>}
   {(status==='error'||status==='restricted'||(status==='unmatched'&&!stationSuggestions.some(s=>(s.quotePlans||[]).length>0)))&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{status==='error'?t('暂时无法连接报价服务，可留下联系方式由人工报价。','The rate service is unavailable. Leave your contact for a manual quote.'):status==='restricted'?t('特殊货物或超过25方/7吨，暂不提供自动总价；请提交人工询盘。','Special cargo or over 25 CBM / 7 tonnes: automatic total withheld; request a quotation.'):t('暂未找到该条件的直接报价，请查看下方方案或提交询盘。','No direct rate found. Check the options below or send an inquiry.')}</p>}
   {(status==='matched'||status==='unmatched')&&form.containerType==='FCL'&&stationSuggestions.length>0&&<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
    <p className="font-semibold">{t('整柜运输方案及参考价格','FCL route options and indicative rates')}</p>
    <p className="mt-1">{t('以下为可选运输方案及参考价格，具体服务和费用以订舱确认为准。','Available transport options and indicative prices; final services and charges are subject to booking confirmation.')}</p>
    {(()=>{
     const plans=stationSuggestions.flatMap(s=>s.quotePlans||[]).filter(p=>Number(p.sale_reference_usd)>0)
      .sort((a,b)=>Number(b.estimate_status==='segment_covered')-Number(a.estimate_status==='segment_covered')
       ||Number(a.sale_reference_usd)-Number(b.sale_reference_usd));
     return plans.length?<div className="mt-3 grid gap-2">
      {plans.slice(0,5).map((p,i)=><div key={p.rail_station+'-'+p.equipment+'-'+(p.loading_area||'')+'-'+i} className="rounded-lg border border-amber-200 bg-white p-3">
       <div className="flex flex-wrap justify-between gap-2">
        <strong>{form.pol} → {p.rail_station} → {form.pod} <span className="font-normal text-xs">· {p.container} {p.equipment}</span></strong>
        <strong className="text-base text-blue-800">USD {(Number(p.sale_reference_usd)*(Number(form.quantity)||1)).toLocaleString(undefined,{maximumFractionDigits:2})}</strong>
       </div>
       <div className="mt-1 text-xs text-slate-600">{p.estimate_status==='segment_covered'?t('方案参考价（以所列服务为准）','Indicative rate for the listed services'):t('部分费用待补，价格仅供参考','Some charges are not yet included')}
       {' · '}{t('包含','Included')}: {(p.covered_segments||[]).join('、')||'—'}
       {(p.missing_segments||[]).length>0&&<span className="block text-amber-800">{t('缺少','Missing')}: {p.missing_segments.join('、')}</span>}
       {p.loading_area&&<span className="block">{t('工厂装货地区','Factory loading area')}: {p.loading_area} · {t('提空箱','Empty pickup')}: {p.empty_pickup_city||'—'}</span>}
       </div>
      </div>)}
     </div>:<div className="mt-3 grid gap-2">
      {stationSuggestions.slice(0,4).map(s=><p key={s.station+s.container+s.equipment} className="rounded-lg bg-white px-3 py-2">{form.pol} → {s.station} → {form.pod} · {s.container} {s.equipment} · {t('线路可询价，价格请联系确认','Route available; request a rate')}</p>)}
     </div>;
    })()}
    <p className="mt-3 text-xs">{t('以上为参考价格。未列明费用、具体舱位和实际装箱要求请在订舱前确认。','Indicative rates only. Please confirm unlisted charges, space and cargo requirements before booking.')}</p>
   </div>}
   {estimate&&!contactOpen&&status!=='submitted'&&<button onClick={()=>setContactOpen(true)} className="mt-3 w-full rounded-xl border border-blue-200 px-4 py-3 font-semibold text-blue-700">{t('咨询此方案','Ask about this option')}</button>}
   {message&&<p role="status" className="mt-3 rounded-xl bg-slate-50 p-4 text-sm">{message}</p>}
  </div>
  {contactOpen&&<form onSubmit={submit} className="mt-4 space-y-4 border-t border-slate-100 pt-4"><div className="grid gap-4 sm:grid-cols-2">{fields('name',t('联系人','Name'),{required:true,disabled:sending})}{fields('contact',t('邮箱（收取确认邮件）或电话 / WhatsApp','Email (for a confirmation copy) or phone / WhatsApp'),{required:true,disabled:sending})}</div><button disabled={sending} className="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-50">{sending?t('正在提交…','Submitting…'):t('获取确认报价','Request confirmed rate')}</button></form>}
  {form.containerType==='FCL'&&<details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
   <summary className="cursor-pointer font-semibold text-slate-800">{t('整柜报价注意事项（13条）','FCL quotation remarks (13 points)')}</summary>
   <p className="mt-2 text-xs text-slate-500">{t('实际有效期、费用包含范围、免费用箱期及附加费以具体方案和订舱确认为准。','Validity, included services, free container use and surcharges depend on the selected rate and booking confirmation.')}</p>
   <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-6">
    {fclQuoteTerms.map((item,i)=><li key={i}>{zh?item.zh:item.en}</li>)}
   </ol>
  </details>}
  <p className="mt-4 text-xs text-slate-400">{t('预估价仅供参考，最终以确认的服务范围和正式报价为准。','Indicative pricing; final scope and quotation require confirmation.')}</p>
 </section>;
}
