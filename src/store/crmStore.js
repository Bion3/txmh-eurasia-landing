import { supabase } from '../lib/supabaseClient';

export async function addLead(leadData) {
  const { data, error } = await supabase
    .from('leads')
    .insert([leadData])
    .select('*')
    .single();
    
  if (error) {
    console.error('Error adding lead:', error);
    throw error;
  }
  return data;
}

export async function getLeads() {
  const { data, error } = await supabase
    .from('leads')
    .select('id,company_name,contact_name,email,phone,origin,destination,cargo_desc,volume_cbm,weight_kg,mode_preference,message,status,created_at')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching leads:', error);
    throw error;
  }
  return data;
}
