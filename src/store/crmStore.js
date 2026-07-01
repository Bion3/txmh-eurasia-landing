import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

function ensureSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before using CRM storage.');
  }

  return supabase;
}

export async function addLead(leadData) {
  const client = ensureSupabase();
  const { error } = await client
    .from('leads')
    .insert([leadData]);
    
  if (error) {
    console.error('Error adding lead:', error);
    throw error;
  }
  return leadData;
}

export async function getLeads() {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('leads')
    .select('id,lead_no,company_name,contact_name,email,phone,origin,destination,cargo_desc,volume_cbm,weight_kg,transport_mode_interest,shipment_type_interest,message,status,created_at')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching leads:', error);
    throw error;
  }
  return data;
}
