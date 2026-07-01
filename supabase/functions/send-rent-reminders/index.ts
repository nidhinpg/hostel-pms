import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const INTERAKT_API_KEY = Deno.env.get('INTERAKT_API_KEY')!

async function sendWhatsApp(phone: string, tenantName: string, rent: string, month: string, gpay: string, hostelName: string) {
  const res = await fetch('https://api.interakt.ai/v1/public/message/', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${INTERAKT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      countryCode: '+91',
      phoneNumber: phone,
      callbackData: 'rent_reminder',
      type: 'Template',
      template: {
        name: 'rent_due_reminder',
        languageCode: 'en',
        bodyValues: [tenantName, rent, month, gpay, hostelName]
      }
    })
  })
  return res.json()
}

Deno.serve(async () => {
  const today = new Date()
  const todayDay = today.getDate()
  const month = `${today.toLocaleString('en-IN', { month: 'long' })} ${today.getFullYear()}`

  // Calculate tomorrow's day correctly (handling month-end)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const tomorrowDay = tomorrow.getDate()

  const { data: tenants } = await supabase
    .from('tenants')
    .select('*')
    .eq('status', 'active')

  if (!tenants || tenants.length === 0) {
    return new Response(JSON.stringify({ message: 'No active tenants' }), { status: 200 })
  }

  const results = []

  for (const tenant of tenants) {
    const moveInDay = new Date(tenant.movein_date).getDate()
    
    const isDueDay = moveInDay === todayDay
    const isDayBefore = moveInDay === tomorrowDay

    if (!isDueDay && !isDayBefore) continue

    const { data: property } = await supabase
      .from('properties')
      .select('name, gpay_number')
      .eq('id', tenant.property_id)
      .single()

    if (!property || !tenant.phone) continue

    const hostelName = property.name
    const gpay = property.gpay_number || ''
    const rent = Number(tenant.rent).toLocaleString('en-IN')
    const firstName = tenant.name.split(' ')[0]

    const result = await sendWhatsApp(
      tenant.phone,
      firstName,
      rent,
      month,
      gpay,
      hostelName
    )

    results.push({ tenant: tenant.name, phone: tenant.phone, result })
  }

  return new Response(JSON.stringify({ sent: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200
  })
})
