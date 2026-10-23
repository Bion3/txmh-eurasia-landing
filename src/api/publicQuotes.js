import { isSupabaseConfigured, publicSupabase as supabase } from '../lib/supabaseClient';
import { estimatePublishedQuote } from '../lib/publicQuotePricing';
import { withRequestDeadline } from '../lib/requestDeadline';

const publicColumns = 'id,origin,station,destination,transport,service_scope,container,currency,unit,unit_price_low,unit_price_high,minimum_charge,ratio,valid_from,valid_until,status,public_note,updated_at';

export async function getPublicQuoteEstimate(form) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Quote service is unavailable.');
  return withRequestDeadline(async (signal) => {
  const { data, error } = await supabase
    .from('freight_public_quotes')
    .select(publicColumns)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1000)
    .abortSignal(signal);
  if (error) throw error;
  return estimatePublishedQuote(form, data || []);
  });
}
