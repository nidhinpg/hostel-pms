// Edge Function: add-property
// Lets an EXISTING owner add another property under their own account.
//   1) Verifies the requester is an owner on at least one Pro property
//      (adding properties is a Pro-only feature — Basic/Trial are capped at 1).
//   2) Creates the new property, inheriting Pro access under the same
//      subscription — no separate trial, no separate billing.
//   3) Creates a new profiles row linking the owner <-> new property.
//
// If any step fails after the property is created, it's rolled back.
//
// Deploy via Supabase Dashboard UI (no CLI/Docker needed).
// JWT verification: OFF, but this endpoint is gated by requester_id + a
// server-side Pro-plan check, same pattern as create-staff-account.

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const {
      requester_id,
      property_name,
      city,
      gpay_number,
      address,
    } = await req.json()

    if (!requester_id || !property_name) {
      return json({ error: 'requester_id and property_name are required' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ── 1) Verify requester is an owner, and is Pro on at least one property ──
    const { data: requesterProfiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, role, full_name, property_id')
      .eq('id', requester_id)
      .eq('role', 'owner')

    if (profErr || !requesterProfiles || requesterProfiles.length === 0) {
      return json({ error: 'Owner profile not found' }, 403)
    }

    const ownedPropertyIds = requesterProfiles.map((p: any) => p.property_id).filter(Boolean)
    const { data: ownedProperties, error: ownedErr } = await supabase
      .from('properties')
      .select('plan_type')
      .in('id', ownedPropertyIds)

    if (ownedErr) {
      return json({ error: ownedErr.message }, 400)
    }

    const isPro = (ownedProperties || []).some(
      (p: any) => p.plan_type === 'pro' || p.plan_type === 'owned'
    )

    if (!isPro) {
      return json({
        error: 'Adding more properties is a Pro plan feature. Upgrade to Pro to add unlimited properties.',
      }, 403)
    }

    const fullName = requesterProfiles[0].full_name

    // ── 2) Create the new property — inherits Pro access, no trial needed ──
    const { data: propData, error: propCreateErr } = await supabase
      .from('properties')
      .insert({
        name: property_name.trim(),
        city: city?.trim() || null,
        address: address?.trim() || null,
        gpay_number: gpay_number?.trim() || null,
        owner_id: requester_id,
        plan_type: 'pro',
        subscription_status: 'active',
      })
      .select()
      .single()

    if (propCreateErr || !propData) {
      return json({ error: propCreateErr?.message || 'Could not create property' }, 400)
    }

    // ── 3) Link owner <-> new property ──────────────────────────────────
    const { error: newProfErr } = await supabase.from('profiles').insert({
      id: requester_id,
      property_id: propData.id,
      full_name: fullName,
      role: 'owner',
    })

    if (newProfErr) {
      // Roll back the property so we don't leave an orphaned row
      await supabase.from('properties').delete().eq('id', propData.id)
      return json({ error: newProfErr.message || 'Could not link property to owner' }, 400)
    }

    return json({ success: true, property: propData })
  } catch (e: any) {
    return json({ error: e?.message || 'Unexpected error' }, 500)
  }
})

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
