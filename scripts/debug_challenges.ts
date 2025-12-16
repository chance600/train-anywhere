
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Public Anon Key from .env.local
const url = 'https://zrtambthzaxfapeeplwc.supabase.co'
const key = 'sb_publishable_x4xFqkw628AWL6xzfM8FIw_QcDEFKMF'
const supabase = createClient(url, key)

async function check() {
    console.log("Checking challenges via Public API...")

    // 1. Check Public Challenges
    const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('is_public', true)

    if (error) {
        console.error("❌ API Error:", error.message)
        console.error("Details:", error)
    } else {
        console.log(`✅ Found ${data?.length || 0} challenges:`)
        data?.forEach(c => console.log(` - ${c.name} (ID: ${c.id})`))
    }

    if (data && data.length === 0) {
        console.log("⚠️ Zero challenges found. Checking if authentication is required (RLS is stricter due to no auth?)")
        // We are running as Anon. The RLS policy I wrote:
        // "View public or own challenges" -> using (is_public = true OR ...)
        // This SHOULD work for Anon if I allowed Anon select?
        // Wait, "to authenticated" was in my migration:
        // create policy ... to authenticated ...

        console.log("Context: My migration specified 'to authenticated'. If I run this script without auth, I am 'anon'.")
        console.log("If 'anon' creates 0 results, that explains why unauthed users see nothing.")
        console.log("But 'alecbrewer1' is likely authenticated in the app.")
    }
}

check()
