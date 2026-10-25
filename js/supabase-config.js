// Supabase project the site reads its videos from.
// Both values are public by design: they ship to every visitor's browser.
// What they can do is limited by the row-level security rules in
// supabase/setup.sql. Never put the secret / service_role key here.

export const SUPABASE_URL = 'https://eweximsjuwzvtrynscdg.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_iJ3oKgG0nGswydQRgyelpg_yxJgOskM';

// Storage bucket holding videos/, thumbs/ and posters/
export const MEDIA_BUCKET = 'media';
