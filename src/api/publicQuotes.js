import { isSupabaseConfigured, publicSupabase as supabase } from '../lib/supabaseClient';
import { estimatePublishedQuote } from '../lib/publicQuotePricing';
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
  const indicative=await supabase.rpc('freight_website_indicative_rates').abortSignal(signal);
  if(indicative.error)throw indicative.error;
  return estimatePublishedQuote(form,indicative.data||[]);
 });
}
