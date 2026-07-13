// Edge Function: delete-property
// Lets an owner delete one of their own properties, with safety checks:
//   1) Requester must actually be an owner on this property.
//   2) Requester must have more than one property — never allow deleting
//      the last one, or the owner would be locked out of the dashboard.
//   3) Property must be empty — zero tenants and zero beds. If either table
//      has rows for this property_id, the delete is blocked with a clear
//      message telling the owner to clear it out first.
//
// If all checks pass: delete the profiles rows tied to this property (owner
// + any staff), then delete the property row itself.
//
// Deploy via Supabase Dashboard UI (no CLI/Docker needed).
// JWT verification: OFF — gated by requester_id + server-side ownership check,
// same pattern as add-property.

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
    const { requester_id, property_id } = await req.json()

    if (!requester_id || !property_id) {
      return json({ error: 'requester_id and property_id are required' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ── 1) Verify requester is the owner of THIS property ──────────────────
    const { data: profileRow, error: profErr } = await supabase
      .from('profiles')
      .select('id, role, property_id')
      .eq('id', requester_id)
      .eq('property_id', property_id)
      .eq('role', 'owner')
      .maybeSingle()

    if (profErr) return json({ error: profErr.message }, 400)
    if (!profileRow) {
      return json({ error: 'You do not have permission to delete this property' }, 403)
    }

    // ── 2) Never allow deleting the owner's last remaining property ────────
    const { data: allOwnerProfiles, error: allErr } = await supabase
      .from('profiles')
      .select('property_id')
      .eq('id', requester_id)
      .eq('role', 'owner')

    if (allErr) return json({ error: allErr.message }, 400)

    if ((allOwnerProfiles || []).length <= 1) {
      return json({ error: 'You must keep at least one property — this is your only one.' }, 400)
    }

    // ── 3) Block delete if the property still has tenants or beds ──────────
    const { count: tenantCount, error: tenantErr } = await supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', property_id)

    if (tenantErr) return json({ error: tenantErr.message }, 400)
    if ((tenantCount || 0) > 0) {
      return json({ error: 'This property still has tenants. Remove all tenants before deleting it.' }, 400)
    }

    const { count: bedCount, error: bedErr } = await supabase
      .from('beds')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', property_id)

    if (bedErr) return json({ error: bedErr.message }, 400)
    if ((bedCount || 0) > 0) {
      return json({ error: 'This property still has beds set up. Remove all beds before deleting it.' }, 400)
    }

    // ── 4) Delete profile links (owner + any staff), then the property ─────
    const { error: delProfilesErr } = await supabase
      .from('profiles')
      .delete()
      .eq('property_id', property_id)

    if (delProfilesErr) {
      return json({ error: delProfilesErr.message }, 400)
    }

    const { error: delPropErr } = await supabase
      .from('properties')
      .delete()
      .eq('id', property_id)

    if (delPropErr) {
      return json({ error: delPropErr.message }, 400)
    }

    return json({ success: true })
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
