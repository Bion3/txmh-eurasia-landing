// Shared public rail LCL acceptance reminders. All limits are supplier terms,
// not verified acceptance decisions or automatic surcharges.
export const lclTermsZh=[
 '铁路重抛比1:500；单票超过25 CBM或7吨，通常需另加 USD 20/计费方或拆分两票，须提前联系确认。',
 '退关、数据增减应在发车前第8天上午11:00前通知；逾期可能产生与运费等额的空仓费。超方未通知可能无法装柜。',
 '单件长超过3米、宽超过1.5米、高超过1.5米或重量超过3吨，须单独询价。',
 '超长、超宽、超高、超集重货物，国内外可能产生额外作业费，须提前核实。',
 '商检、海关查验等额外费用实报实销。',
 '大型机械、模具、车辆、玻璃、化工品、金属卷材或板材等货物可能需要特殊加固及铁路承运方认可，并可能加费。',
 '普通参考报价不适用于危险品、含电池、含油、含制冷剂、磁性、气压或液压装置的货物及易腐品；须人工审核是否可承运。'
];
export const lclTermsEn=[
 'Rail chargeable ratio 1 CBM : 500 kg. Over 25 CBM or 7 tonnes per shipment: usually an additional USD 20 per chargeable CBM or split shipments, subject to prior confirmation.',
 'Cancellations or changes to customs/shipment data must be notified by 11:00 AM eight days before train departure. Late changes may incur dead-space charges equal to freight; undeclared excess volume may prevent loading.',
 'Any piece longer than 3 m, wider than 1.5 m, higher than 1.5 m, or heavier than 3 tonnes requires a special quotation.',
 'Oversize or concentrated loads may incur extra origin and destination handling charges.',
 'Inspection, customs examination and similar exceptional costs are charged at actual cost.',
 'Heavy machinery, molds, vehicles, glass, chemicals and rolled/sheet metal may require special lashing and railway operator approval, with additional charges.',
 'Standard rates exclude dangerous goods, batteries, oil, refrigerants, magnetic goods, pneumatic/hydraulic devices and perishables; manual acceptance review is required.'
];
export function checkLclCargoRestrictions(form){
 if(form?.containerType!=='LCL')return {manualRequired:false,reasons:[],notices:[]};
 const vol=Number(form.volume),kg=Number(form.weight),dims=['pieceLength','pieceWidth','pieceHeight','pieceWeight'];
 const reasons=[],notices=[];
 const has=(k)=>form[k]!==''&&form[k]!=null;
 if((has('volume')&&Number.isFinite(vol)&&vol>25)||(has('weight')&&Number.isFinite(kg)&&kg>7000)){
   reasons.push('bulkShipment');
   notices.push('单票超过25方或7吨：须联系确认 USD 20/计费方加价或分票，未自动计入。');
 }
 if((has('pieceLength')&&Number(form.pieceLength)>3)||(has('pieceWidth')&&Number(form.pieceWidth)>1.5)||
    (has('pieceHeight')&&Number(form.pieceHeight)>1.5)||(has('pieceWeight')&&Number(form.pieceWeight)>3000)){
   reasons.push('oversizePiece');
   notices.push('单件超长/宽/高/重，须单独询价并核实装载、特殊加固及附加费用。');
 }
 if(form.cargoRisk==='restricted'){
   reasons.push('excludedCargo');
   notices.push('货物属于普通参考运价排除范围，需要人工确认承运可行性。');
 }else if(form.cargoRisk==='special'){
   reasons.push('specialCargo');
   notices.push('特殊货物可能需要铁路批准、特殊固定和额外作业费，请人工核价。');
 }
 return {manualRequired:reasons.length>0,reasons,notices};
}
