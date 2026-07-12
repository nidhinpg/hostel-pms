import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// Razorpay caps total_count at 100 for yearly/interval=1 plans (100 years),
// but allows much more for monthly plans. 120 months = 10 years is fine for
// monthly; yearly plans need to stay at or under 100.
const YEARLY_PLAN_IDS = new Set([
  'plan_T8D05XTWtcpnYT', // Pavio Basic Yearly
  'plan_T7WMuKFrSxeIcI', // Pavio Pro Yearly
])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { property_id, property_name, plan_id } = await req.json()

  if (!property_id || !plan_id) {
    return new Response(JSON.stringify({ error: 'property_id and plan_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const totalCount = YEARLY_PLAN_IDS.has(plan_id) ? 100 : 120

  const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
  const res = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan_id,
      total_count: totalCount,
      quantity: 1,
      notes: { property_id, property_name }
    })
  })

  const data = await res.json()

  // Keeping this log for now — remove once we've confirmed the ₹999 first charge is correct in production.
  console.log('[create-subscription] Razorpay HTTP status:', res.status)
  console.log('[create-subscription] Razorpay response body:', JSON.stringify(data))

  if (data.error) {
    return new Response(JSON.stringify({ error: data.error.description }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (!data.id) {
    return new Response(JSON.stringify({ error: 'Razorpay did not return a subscription id' }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  await supabase.from('properties').update({ razorpay_subscription_id: data.id }).eq('id', property_id)

  return new Response(JSON.stringify({ subscription_id: data.id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
  })
})
