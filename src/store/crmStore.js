import { supabase } from '../lib/supabaseClient';

export async function addLead(leadData) {
  const { data, error } = await supabase
    .from('leads')
    .insert([leadData]);
    
  if (error) {
    console.error('Error adding lead:', error);
    return null;
  }
  return data;
}

export async function getLeads() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching leads:', error);
    return [];
  }
  return data;
}