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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { property_id, property_name, plan_id } = await req.json()

  if (!property_id || !plan_id) {
    return new Response(JSON.stringify({ error: 'property_id and plan_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)
  const res = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan_id,
      total_count: 120,
      quantity: 1,
      notes: { property_id, property_name }
    })
  })

  const data = await res.json()

  if (data.error) {
    return new Response(JSON.stringify({ error: data.error.description }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  await supabase.from('properties').update({ razorpay_subscription_id: data.id }).eq('id', property_id)

  return new Response(JSON.stringify({ subscription_id: data.id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
  })
})
