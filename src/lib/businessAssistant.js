import {extractShipment} from './assistantShipment.js';
const answers=[
 {match:/运踪|单号|订单状态|查货|tracking|track\b|order status/i,zh:'实时运踪需由业务团队核对。请在下方询盘中填写订单号或箱号及联系邮箱，提交给团队查询。',en:'Our team needs to check live tracking. Add your order or container number and contact email to the inquiry below and submit it for review.'},
 {match:/单证|资料|文件|报关|清关|documents?|paperwork|customs/i,zh:'可先准备商业发票、装箱单，以及品名、材质用途、HS 编码、件数、毛重和体积等信息。具体资料取决于货物、线路及清关安排，由业务团队确认；特殊货物请提前说明。',en:'Start with a commercial invoice, packing list, cargo description, material/use, HS code, packages, gross weight and volume. Exact documents depend on cargo, routing and customs arrangements; our team will confirm them. Declare special cargo in advance.'},
 {match:/多久|时效|天数|截单|班期|transit|how long|schedule/i,zh:'时效和班期需要结合发运站、口岸、目的站及当期安排确认。请补充起运地、目的地和计划发运时间，转人工核对；这里不承诺固定到达日期。',en:'Transit time and schedules depend on departure terminal, border, destination and current operations. Share the route and planned shipping date for our team to confirm; no fixed arrival date is guaranteed here.'},
 {match:/危险品|电池|液体|粉末|battery|batteries|dangerous|liquid|powder/i,zh:'这类货物需先确认运输条件。请提供品名、成分、包装和相关检测资料，由业务团队核实可接运线路后报价。',en:'These goods require an acceptance check. Share the cargo description, composition, packaging and relevant test documents so our team can check suitable routing before quoting.'},
 {match:/联系|人工|邮箱|contact|human|sales|email/i,zh:'可通过下方“报价 / 人工询盘”提交货物信息，或发送邮件至 benjamin@eurasiago.com。提交表单后才会建立询盘。',en:'Use “Quote / sales inquiry” below to submit cargo details, or email benjamin@eurasiago.com. An inquiry is created only after the form is submitted.'},
 {match:/服务|能做|业务范围|海运|空运|service|offer|sea freight|air freight/i,zh:'我们提供中欧铁路整箱、拼箱及海空运和多式联运服务。这里可以查询已发布的参考运价；未匹配的线路可转人工询价。',en:'We provide China–Europe rail FCL/LCL, sea and air freight, and intermodal services. This assistant checks published indicative rates; unmatched routes can be submitted for a manual quote.'},
 {match:/^(你好|您好|hello|hi|hey|帮助|help)[!！。.\s]*$/i,zh:'您好，可以查询运费、了解服务、查看常用单证或转人工。先选择一个快捷问题，也可以直接输入线路和货物信息。',en:'Hello! Check rates, explore services, review common documents or prepare a sales inquiry. Choose a quick question or enter your route and cargo details.'}
];
export function businessAnswer(message,locale='en'){
 const answer=answers.find(a=>a.match.test(String(message)));
 return answer?answer[locale==='zh'?'zh':'en']:null;
}
export function isShipmentQuestion(message){
 const parsed=extractShipment(message);
 return Boolean(parsed.pol||parsed.pod||parsed.volume!==undefined||parsed.weight!==undefined||/报价|运费|价格|询价|整箱|整柜|拼箱|站到站|门到门|提货|\b(?:quote|rate|price|fcl|lcl|40hq|40gp|20gp|ddp)\b|pickup|door.to.door/i.test(message));
}
export function quoteAnswer(result,shipment,locale='en'){
 const zh=locale==='zh',route=shipment.pol+' → '+shipment.pod;
 if(!result)return route+(zh?'：当前范围暂无匹配售价。点击下方进入报价 / 人工询盘，货物信息会自动带入。':': No matching published rate for this scope. Open the quote / sales form below; your cargo details will carry over.');
 const label=result.rateOnly?(zh?'参考单价':'Indicative unit rate'):result.partial?(zh?'已知费用小计（非全程总价）':'Known charges subtotal (not all-in)'):(zh?'参考运费':'Indicative freight');
 let reply=route+'\n'+label+': '+result.currency+' '+Number(result.low).toFixed(2)+'–'+Number(result.high).toFixed(2);
 if(result.rateOnly)reply+=zh?' /计费方。请补充体积和毛重以核算。':' / chargeable CBM. Add volume and gross weight for calculation.';
 if(result.missingCosts?.length)reply+='\n'+(zh?'待确认 / 未含：'+result.missingCosts.join('；'):'Pickup, destination services and other excluded charges require confirmation in the quote form.');
 if(result.validUntil)reply+='\n'+(zh?'报价有效期至：':'Valid until: ')+result.validUntil;
 return reply+'\n'+(zh?'完整计价范围、提货参考费、附加费及有效期，请进入报价表核对。最终价格需业务确认。':'Open the quote form to review scope, pickup references, extras and validity. Final rates require confirmation.');
}
export function readAssistantSession(raw){
 try{
  const value=JSON.parse(raw),shipment={};
  if(value?.shipment&&typeof value.shipment==='object')for(const key of ['pol','pod','containerType','serviceScope','containerSize','quantity','volume','weight']){
   const v=value.shipment[key];if(typeof v==='string'&&v.length<=150||typeof v==='number'&&Number.isFinite(v))shipment[key]=v;
  }
  const messages=Array.isArray(value?.messages)?value.messages.filter(m=>['user','assistant'].includes(m?.role)&&typeof m.text==='string').slice(-12).map(m=>({role:m.role,text:m.text.slice(0,3000)})):[];
  return {shipment,messages};
 }catch{return {shipment:{},messages:[]};}
}
