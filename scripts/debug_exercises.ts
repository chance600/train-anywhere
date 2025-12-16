
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env vars
try {
    const envConfig = dotenv.parse(fs.readFileSync(path.resolve(process.cwd(), '.env.local')));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} catch (e) { console.log("No .env.local found"); }

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log("🔍 Checking Exercise Count...");

    // We can't do count(*) easily with anon key on some tables if RLS blocks, but public usually ok.
    // Let's try to fetch a range or use count.

    const { count, error } = await supabase
        .from('exercises')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`✅ Total Exercises: ${count}`);
    }

    // List first 5
    const { data } = await supabase.from('exercises').select('name').limit(5);
    console.log("Sample:", data);
}

check();
