const origins=[['上海','shanghai'],['宁波','ningbo'],['西安',"xi'an",'xian'],['成都','chengdu'],['重庆','chongqing'],['郑州','zhengzhou'],['武汉','wuhan'],['深圳','shenzhen'],['义乌','yiwu']];
const destinations=[['汉堡','hamburg'],['杜伊斯堡','duisburg'],['华沙','warsaw'],['布拉格','prague'],['布达佩斯','budapest'],['米兰','milan'],['巴黎','paris']];
function city(text,groups){return groups.flatMap(names=>names.map(name=>({name:names[0],index:text.lastIndexOf(name)}))).filter(x=>x.index>=0).sort((a,b)=>b.index-a.index)[0]?.name;}
export function extractShipment(message,previous={}){
 const text=String(message).toLowerCase(), next={containerType:'FCL',serviceScope:'door_to_station',...previous};
 const origin=city(text,origins),destination=city(text,destinations);
 if(origin)next.pol=origin;if(destination)next.pod=destination;
 const volume=text.match(/(-?\d+(?:\.\d+)?)\s*(?:cbm|m3|m³|立方米|立方|方)/i);
 const weight=text.match(/(-?\d+(?:\.\d+)?)\s*(kg|kgs|公斤|千克|吨|tons?|t\b)/i);
 if(volume)next.volume=Number(volume[1]);
 if(weight)next.weight=Number(weight[1])*(/吨|^t/.test(weight[2])?1000:1);
 if(/lcl|拼箱/.test(text))next.containerType='LCL';
 if(/fcl|整箱|整柜|40hq|40gp|20gp/.test(text))next.containerType='FCL';
 const box=text.match(/40hq|40gp|20gp|45hq/i);if(box)next.containerSize=box[0].toUpperCase();
 const quantity=text.match(/(\d+)\s*(?:柜|个集装箱|containers?)/i);if(quantity)next.quantity=Number(quantity[1]);
 if(/站到站|terminal.to.terminal/.test(text))next.serviceScope='port_to_port';
 if(/提货|pickup/.test(text))next.serviceScope='door_to_station';
 if(/门到门|door.to.door/.test(text))next.serviceScope='door_to_door';
 if(/fba|amazon|亚马逊/.test(text))next.serviceScope='fba_delivery';
 if(/ddp|包税/.test(text))next.serviceScope='ddp';
 return next;
}
export function shipmentQuoteHref(shipment,notes=''){
 const query=new URLSearchParams();for(const key of ['pol','pod','containerType','serviceScope','containerSize','quantity','volume','weight'])if(shipment[key]!==undefined)query.set(key,String(shipment[key]));
 if(notes)query.set('notes',notes.slice(-2000));return '/quote?'+query;
}
