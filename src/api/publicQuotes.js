import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { estimatePublishedQuote } from '../lib/publicQuotePricing';

const publicColumns = 'id,origin,station,destination,transport,service_scope,container,currency,unit,unit_price_low,unit_price_high,minimum_charge,ratio,valid_from,valid_until,status,public_note,updated_at';

export async function getPublicQuoteEstimate(form) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('freight_public_quotes')
    .select(publicColumns)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return estimatePublishedQuote(form, data || []);
}
