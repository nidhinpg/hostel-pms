import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const INTERAKT_API_KEY = Deno.env.get('INTERAKT_API_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { tenant_id, property_id, amount, paid_date, month } = await req.json()

    if (!tenant_id || !property_id || !amount || !paid_date) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get tenant details
    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .select('name, phone, movein_date')
      .eq('id', tenant_id)
      .single()

    if (tErr || !tenant) {
      return new Response(JSON.stringify({ error: 'Tenant not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!tenant.phone) {
      return new Response(JSON.stringify({ error: 'Tenant has no phone number' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get property details — check plan_type is Pro
    const { data: property, error: pErr } = await supabase
      .from('properties')
      .select('name, plan_type')
      .eq('id', property_id)
      .single()

    if (pErr || !property) {
      return new Response(JSON.stringify({ error: 'Property not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Pro-only gate (treat 'owned' same as 'pro' — owner's own property)
    if (property.plan_type !== 'pro' && property.plan_type !== 'owned') {
      return new Response(JSON.stringify({ error: 'Receipt feature is Pro only', skipped: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Calculate validity based on the tenant's join date, NOT the payment date.
    // Rent cycles are anchored to the day-of-month they moved in on, e.g. moved in
    // on the 10th → each paid cycle runs from the 10th through the 9th of the
    // following month, regardless of which day they actually paid on.
    const joinDay = tenant.movein_date
      ? parseInt(tenant.movein_date.split('-')[2])
      : 1

    let validTill
    if (month) {
      // month is "YYYY-MM" for the billed cycle's start month, e.g. "2026-07" = July 2026.
      const [cycleYear, cycleMonth] = month.split('-').map(Number)
      // cycleMonth is 1-based; passing it as-is (not cycleMonth - 1) to Date gives the
      // *next* calendar month in JS's 0-based indexing, which is exactly what we want.
      // day = joinDay - 1 (JS Date correctly rolls over to the last day of the prior
      // month if joinDay is 1, giving day 0).
      validTill = new Date(cycleYear, cycleMonth, joinDay - 1)
    } else {
      // Fallback if month isn't provided: anchor to paid_date's month instead.
      const paidDateObj = new Date(paid_date)
      validTill = new Date(paidDateObj.getFullYear(), paidDateObj.getMonth() + 1, joinDay - 1)
    }

    const validTillStr = validTill.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })

    // Format month label e.g. "2026-07" → "July 2026"
    const [yr, mo] = (month || '').split('-')
    const monthLabel = month
      ? new Date(Number(yr), Number(mo) - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
      : ''

    const firstName = tenant.name.split(' ')[0]
    const rent = Number(amount).toLocaleString('en-IN')

    // Send WhatsApp receipt
    const res = await fetch('https://api.interakt.ai/v1/public/message/', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${INTERAKT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        countryCode: '+91',
        phoneNumber: tenant.phone,
        callbackData: 'rent_payment_receipt',
        type: 'Template',
        template: {
          name: 'rent_payment_receipt',
          languageCode: 'en',
          bodyValues: [firstName, rent, monthLabel, validTillStr, property.name]
        }
      })
    })

    const result = await res.json()
    console.log('[receipt] Sent to', tenant.name, ':', result)

    return new Response(JSON.stringify({ success: true, result, validTill: validTillStr }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    })
  } catch (e: any) {
    console.log('[receipt] EXCEPTION:', e.message)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
