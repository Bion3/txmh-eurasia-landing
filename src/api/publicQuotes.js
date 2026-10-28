import { isSupabaseConfigured, publicSupabase as supabase } from '../lib/supabaseClient';
import { estimatePublishedQuote } from '../lib/publicQuotePricing';
import { withRequestDeadline } from '../lib/requestDeadline';

export async function getPublicQuoteEstimate(form) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Quote service is unavailable.');
  return withRequestDeadline(async (signal) => {
  const { data, error } = await supabase
    .rpc('freight_website_sale_rates')
    .abortSignal(signal);
  if (error) throw error;
  return estimatePublishedQuote(form, data || []);
  });
}
