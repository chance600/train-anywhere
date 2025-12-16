
import { createClient } from '@supabase/supabase-js';

// Public Anon Key from .env.local
const url = 'https://zrtambthzaxfapeeplwc.supabase.co';
const key = 'sb_publishable_x4xFqkw628AWL6xzfM8FIw_QcDEFKMF';
const supabase = createClient(url, key);

async function check() {
    console.log("Checking challenges via Public API...");

    // 1. Check Public Challenges
    const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('is_public', true);

    if (error) {
        console.error("❌ API Error:", error.message);
        console.error("Details:", error);
    } else {
        console.log(`✅ Found ${data?.length || 0} challenges:`);
        data?.forEach(c => console.log(` - ${c.name} (ID: ${c.id})`));

        if (data && data.length === 0) {
            console.log("⚠️ Zero challenges found via script (Simulates User/Anon view).");
            console.log("If this returns 0, then RLS is blocking public access.");
        }
    }
}

check();
