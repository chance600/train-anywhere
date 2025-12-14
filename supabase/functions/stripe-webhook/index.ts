import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2022-11-15',
    httpClient: Stripe.createFetchHttpClient(),
})

const cryptoProvider = Stripe.createSubtleCryptoProvider()

serve(async (req) => {
    const signature = req.headers.get('Stripe-Signature')
    const body = await req.text()

    let event
    try {
        event = await stripe.webhooks.constructEventAsync(
            body,
            signature!,
            Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
            undefined,
            cryptoProvider
        )
    } catch (err) {
        return new Response(err.message, { status: 400 })
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
            const subscription = event.data.object
            const status = subscription.status
            const customerId = subscription.customer
            const isPro = status === 'active' || status === 'trialing'

            console.log(JSON.stringify({ event: 'STRIPE_SUBSCRIPTION_UPDATE', type: event.type, customer: customerId, status: status }));

            const { error } = await supabase
                .from('profiles')
                .update({
                    is_pro: isPro,
                    subscription_status: status,
                    current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
                })
                .eq('stripe_customer_id', customerId)

            if (error) {
                console.error(JSON.stringify({ event: 'DB_UPDATE_ERROR', error: error.message, customer: customerId }));
            } else {
                console.log(JSON.stringify({ event: 'PROFILE_UPDATED', customer: customerId, is_pro: isPro }));
            }
            break

        case 'checkout.session.completed':
            const session = event.data.object
            const userId = session.client_reference_id
            const stripeCustomerId = session.customer

            console.log(JSON.stringify({ event: 'STRIPE_CHECKOUT_COMPLETED', user: userId, customer: stripeCustomerId }));

            if (userId && stripeCustomerId) {
                const { error: checkoutError } = await supabase.from('profiles').update({
                    stripe_customer_id: stripeCustomerId,
                    is_pro: true, // Optimistic update
                    subscription_status: 'active'
                }).eq('id', userId)

                if (checkoutError) {
                    console.error(JSON.stringify({ event: 'DB_UPDATE_ERROR', error: checkoutError.message, user: userId }));
                }
            } else {
                console.warn(JSON.stringify({ event: 'MISSING_USER_ID', session_id: session.id }));
            }
            break
    }

    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
})
