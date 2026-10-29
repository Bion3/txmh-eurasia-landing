import { isSupabaseConfigured, publicSupabase as supabase } from '../lib/supabaseClient';
import { estimatePublishedQuote, estimateDomesticRailLcl } from '../lib/publicQuotePricing';
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
   const domestic=await supabase.rpc('freight_website_linehaul_estimates',{p_origin:form.pol,p_volume:Number(form.volume),p_weight:Number(form.weight)}).abortSignal(signal);
   if(domestic.error)throw domestic.error;
   const combined=estimateDomesticRailLcl(form,completed.data||[],domestic.data||[]);
   if(combined){
    const pickup=await supabase.rpc('freight_website_pickup_tier_reference',{p_volume:Number(form.volume),p_weight:Number(form.weight)}).abortSignal(signal);
    if(!pickup.error&&Array.isArray(pickup.data)&&pickup.data.length){
      const p=pickup.data[0];
      const amount=Number(p.amount_usd);
      if(Number.isFinite(amount)&&amount>=0)combined.optionalPickup={amount,unit:'shipment',tier:p.tier_label,validUntil:p.valid_until,note:p.public_note};
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
