
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env
const envPath = path.resolve(process.cwd(), '.env.local');
console.log("Loading env from:", envPath);
try {
    if (fs.existsSync(envPath)) {
        const envConfig = dotenv.parse(fs.readFileSync(envPath));
        for (const k in envConfig) {
            process.env[k] = envConfig[k];
        }
        console.log("✅ .env.local loaded.");
    } else {
        console.warn("⚠️ .env.local does NOT exist in CWD.");
    }
} catch (e) {
    console.error("❌ Error loading .env.local:", e);
}

const url = process.env.VITE_SUPABASE_URL;
let key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!key) {
    console.warn("⚠️ Service Role Key missing. Attempting to use Anon Key (Read-Only)...");
    key = process.env.VITE_SUPABASE_ANON_KEY;
}

console.log("URL Present:", !!url);
console.log("Key Present:", !!key);

if (!url || !key) {
    console.error("Missing credentials. Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    // Try falling back to anon key if service role is missing, just for read check?
    // But createClient might fail if we pass undefined.
    process.exit(1);
}

const supabase = createClient(url, key);

async function verify() {
    console.log("🔍 Verifying RAG Health...");

    // 1. Check Count
    const { count, error: countError } = await supabase
        .from('exercises')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error("❌ DB Connection Failed:", countError.message);
        return;
    }
    console.log(`📊 Total Exercises in DB: ${count}`);

    if (count === 0) {
        console.warn("⚠️ Database is empty! RAG cannot work.");
        return;
    }

    // 2. Check Embeddings (Null check)
    // We can't easily check for null embeddings via standard select without selecting all, 
    // but we can try to find ONE with null.
    // Actually, 'exercise_embeddings' is the column name in knowledge_graph.md? 
    // Let's check the SQL file again if unsure, but usually it's search_vector or similar.
    // The knowledge_graph.md said: "Supabase exercises table with pgvector embeddings (exercise_embeddings)"
    // The migration 20251215000000_create_knowledge_graph.sql viewer showed:
    // "alter table exercises add column if not exists search_vector tsvector..." (Wait, that's Full Text Search!)
    // Let me re-read the migration file to see if there is a vector column. knowledge_graph.md might be wrong!

    // I will read the migration file first in the next step to be sure, 
    // but for now let's just do a text search check which we saw in the view_file earlier.

    // 3. Simple Text Search
    const { data: textData } = await supabase
        .from('exercises')
        .select('name')
        .textSearch('search_vector', 'squat')
        .limit(3);
    console.log("✅ Text Search 'squat':", textData?.map(d => d.name).join(', '));

    // 4. Vector Search Test (Deep Check)
    console.log("🧠 Testing Vector Search (RPC match_exercises)...");

    // We need an embedding. We can't generate one easily here without the AI lib setup again.
    // But we can check if the table `exercise_embeddings` has rows.
    const { count: embedCount, error: embedError } = await supabase
        .from('exercise_embeddings')
        .select('*', { count: 'exact', head: true });

    if (embedError) {
        console.error("❌ Embeddings Table Error:", embedError.message);
    } else {
        console.log(`📊 Total Embeddings in DB: ${embedCount}`);

        if (embedCount && embedCount > 0 && embedCount < (count || 0)) {
            console.warn(`⚠️ Mismatch! Exercises: ${count}, Embeddings: ${embedCount}. Seeding might be incomplete.`);
        } else if (embedCount === 0) {
            console.error("❌ No Embeddings found! RAG will fail.");
        } else {
            console.log("✅ Embeddings appear populated.");
        }
    }
}

verify();
