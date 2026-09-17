import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hnfytafrylzeuxzijnks.supabase.co';
const supabaseKey = 'sb_publishable_Hjc26kqB5-_I7LxMkImusw_FNAomoVy';

export const supabase = createClient(supabaseUrl, supabaseKey);
