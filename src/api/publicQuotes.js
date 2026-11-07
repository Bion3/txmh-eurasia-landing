import { isSupabaseConfigured, publicSupabase as supabase } from '../lib/supabaseClient';
import { estimatePublishedQuote, estimateDomesticRailLcl, estimateLocalStationLcl, nearbyReceivingWarehouseCandidates } from '../lib/publicQuotePricing';
import { withRequestDeadline } from '../lib/requestDeadline';

export async function getPublicQuoteEstimate(form) {
 if (!isSupabaseConfigured || !supabase) throw new Error('Quote service is unavailable.');
 return withRequestDeadline(async signal => {
  // The customer sees an approved rate first. When none exists, use only the limited
  // rail-only indicative dataset; the DB RPC hides supplier identities and purchase costs.
  const approved=await supabase.rpc('freight_website_sale_rates').abortSignal(signal);
  if(approved.error)throw approved.error;
  const primary=estimatePublishedQuote(form,approved.data||[]);
  if(primary)return primary;
  const completed=await supabase.rpc('freight_website_completed_lcl_rates').abortSignal(signal);
  if(completed.error)throw completed.error;
  if(form.containerType==='LCL'&&form.serviceScope==='door_to_station'&&Number(form.volume)>0&&Number(form.weight)>0){
    // The origin in a domestic linehaul price is the receiving warehouse city.
    // The customer's pickup city can be different (e.g. Taicang -> Shanghai).
    // Never measure pickup to the distant rail consolidation/loading hub.
    const nearby=nearbyReceivingWarehouseCandidates(form.pol);
    const available=await Promise.all(nearby.map(async distance=>{
      const domestic=await supabase.rpc('freight_website_linehaul_estimates',{
        p_origin:distance.warehouseCity,
        p_volume:Number(form.volume),p_weight:Number(form.weight)
      }).abortSignal(signal);
      if(domestic.error)throw domestic.error;
      const localForm={...form,pol:distance.warehouseCity};
      const combined=estimateDomesticRailLcl(localForm,completed.data||[],domestic.data||[])||
        estimateLocalStationLcl(localForm,completed.data||[]);
      return combined?{combined,distance}:null;
    }));
    // Select a viable nearby receiving warehouse; keep domestic linehaul prices
    // between that exact receiving city and the rail loading station.
    const selected=available.find(Boolean);
    if(selected){
      const {combined,distance}=selected;
      combined.pickupDistance=distance;
      combined.receivingWarehouseCity=distance.warehouseCity;
      combined.pickupOriginCity=distance.originCity;
      const pickup=await supabase.rpc('freight_website_pickup_radius_reference',{
        p_volume:Number(form.volume),p_weight:Number(form.weight),
        p_distance_km:distance.estimatedRoadKm
      }).abortSignal(signal);
      if(!pickup.error&&Array.isArray(pickup.data)&&pickup.data.length){
        const p=pickup.data[0],amount=Number(p.amount_usd);
        if(Number.isFinite(amount)&&amount>=0)combined.optionalPickup={
          amount,unit:'shipment',tier:p.tier_label,validUntil:p.valid_until,
          note:p.public_note,distanceKm:Number(p.distance_km),estimated:true
        };
      }
      return combined;
    }
  }
  const completedQuote=estimatePublishedQuote(form,completed.data||[]);
  if(completedQuote)return completedQuote;
  const indicative=await supabase.rpc('freight_website_indicative_rates').abortSignal(signal);
  if(indicative.error)throw indicative.error;
  return estimatePublishedQuote(form,indicative.data||[]);
 });
}

/** Public station choices contain only route labels, never procurement cost data. */
export async function getPricedDestinationChoices() {
 if(!isSupabaseConfigured||!supabase) return [];
 return withRequestDeadline(async signal=>{
  const {data,error}=await supabase.rpc('freight_website_quote_destinations').abortSignal(signal);
  if(error)throw error;
  return Array.isArray(data)?data:[];
 });
}

/** Safe FCL segment planning: status only for unapproved supplier records.
 * Published indicative rail price may be displayed, but never a fabricated
 * all-in total or unapproved trucking/container-rental purchase price. */
export async function getFclStationSuggestions(form){
 if(!isSupabaseConfigured||!supabase||form.containerType!=='FCL')return [];
 return withRequestDeadline(async signal=>{
  const [segments,indicative]=await Promise.all([
   supabase.rpc('freight_website_fcl_segment_options',{
    p_origin:form.pol,p_destination:form.pod,p_container:form.containerSize||null,p_equipment:form.equipment||null
   }).abortSignal(signal),
   supabase.rpc('freight_website_indicative_rates').abortSignal(signal)
  ]);
  if(segments.error)throw segments.error;
  if(indicative.error)throw indicative.error;
  return (segments.data||[]).map(option=>{
   const rail=option.rail_status==='reference_available'?estimatePublishedQuote({
     ...form,pol:option.station,serviceScope:'port_to_port',
     containerSize:option.container,equipment:option.equipment
   },indicative.data||[]):null;
   return {...option,railReference:rail&&!rail.rateOnly?{
    amount:rail.low,currency:rail.currency,validUntil:rail.validUntil
   }:null};
  });
 });
}
