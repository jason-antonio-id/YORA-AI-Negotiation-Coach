import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[YORA Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check your environment configuration.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function resolveStorageUrl(url: string | undefined): string {
  if (!url) return '';
  if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('data:')) {
    return url;
  }
  // For references to images in public bucket, return public URL
  // If we upload images, we store just the filename or path in public bucket 'supplier-logos'
  const path = url.startsWith('gs://') ? url.split('/').slice(3).join('/') : url;
  return supabase.storage.from('supplier-logos').getPublicUrl(path).data.publicUrl;
}
