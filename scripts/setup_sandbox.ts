
import * as fs from 'fs';
import * as readline from 'readline';
import { execSync } from 'child_process';
import * as path from 'path';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
        rl.question(query, (answer) => {
            resolve(answer.trim());
        });
    });
};

async function main() {
    console.log('\n🔒 Stripe Sandbox Setup Assistant\n');
    console.log('I cannot browse Stripe for you, but I can set up your app instantly if you provide the keys.');
    console.log('Please get them from your Stripe Dashboard (Test Mode).\n');

    // 1. Get Credentials
    const secretKey = await question('1. Paste Stripe TEST Secret Key (sk_test_...): ');
    if (!secretKey.startsWith('sk_test_')) {
        console.warn('⚠️  Warning: That looks like a Live key or invalid format. Proceeding anyway...');
    }

    const webhookSecret = await question('2. Paste Stripe TEST Webhook Secret (whsec_...): ');
    if (!webhookSecret.startsWith('whsec_')) {
        console.warn('⚠️  Warning: Invalid Webhook Secret format. Proceeding anyway...');
    }

    const paymentLink = await question('3. Paste Stripe TEST Payment Link (https://buy.stripe.com/test_...): ');
    if (!paymentLink.includes('stripe.com')) {
        console.warn('⚠️  Warning: Invalid Payment Link format. Proceeding anyway...');
    }

    console.log('\n⚡ Applying Configuration...');

    // 2. Update .env.local
    const envPath = path.resolve(process.cwd(), '.env.local');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

    // Remove old keys
    envContent = envContent.replace(/^STRIPE_SECRET_KEY=.*$/gm, '');
    envContent = envContent.replace(/^STRIPE_WEBHOOK_SECRET=.*$/gm, '');

    // Add new keys
    envContent += `\nSTRIPE_SECRET_KEY=${secretKey}`;
    envContent += `\nSTRIPE_WEBHOOK_SECRET=${webhookSecret}`;

    // Clean up multiple newlines
    envContent = envContent.replace(/\n\n+/g, '\n').trim() + '\n';

    fs.writeFileSync(envPath, envContent);
    console.log('✅ Updated .env.local');

    // 3. Update Profile.tsx
    const profilePath = path.resolve(process.cwd(), 'components/Profile.tsx');
    if (fs.existsSync(profilePath)) {
        let profileContent = fs.readFileSync(profilePath, 'utf8');
        // Regex to replace the Payment Link
        // Looking for window.open('https://buy.stripe.com/...' or '.../test_PLACEHOLDER'

        // We will simple replace the PLACEHOLDER if it exists, or the previous link
        const placeholderRegex = /window\.open\('https:\/\/buy\.stripe\.com\/[^']+'/g;

        // Check if placeholder exists
        if (profileContent.includes('test_PLACEHOLDER')) {
            profileContent = profileContent.replace(
                "window.open('https://buy.stripe.com/test_PLACEHOLDER'",
                `window.open('${paymentLink}'`
            );
        } else {
            // Replace any existing Stripe link
            profileContent = profileContent.replace(
                placeholderRegex,
                `window.open('${paymentLink}'`
            );
        }

        fs.writeFileSync(profilePath, profileContent);
        console.log('✅ Updated Profile.tsx with Payment Link');
    } else {
        console.error('❌ Could not find components/Profile.tsx');
    }

    // 4. Deploy Secrets
    console.log('🚀 Deploying Secrets to Supabase...');
    try {
        execSync('supabase secrets set --env-file .env.local', { stdio: 'inherit' });
        console.log('✅ Secrets Deployed!');
    } catch (e) {
        console.error('❌ Failed to deploy secrets. Is Docker running? You may need to run this manually:');
        console.error('   supabase secrets set --env-file .env.local');
    }

    console.log('\n🎉 Sandbox Setup Complete! You can now test the Upgrade flow.');
    rl.close();
}

main();
