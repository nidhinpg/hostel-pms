import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const fmt = n => '₹' + Number(n).toLocaleString('en-IN')

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
function currentDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// Pending days for a daily-billing tenant -- today minus the last date
// they are paid through, computed live (no background job). Deliberately
// returns a day count only, never multiplied into a rupee figure -- daily
// rates vary per hostel/tenant and are not stored as a fixed number here.
function getDailyPendingDays(tenant) {
  if (tenant.billing_type !== 'daily') return 0
  const paidThrough = tenant.daily_paid_through_date
    ? new Date(tenant.daily_paid_through_date)
    : (() => { const d = new Date(tenant.movein_date); d.setDate(d.getDate() - 1); return d })()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  paidThrough.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today - paidThrough) / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

export default function Tenants({ propertyId, isStaff = false, initialFilter = 'all', canAddTenants = false, canCollectRent = false, canDeleteEntries = false }) {
  const { activeProperty, properties } = useAuth()
  // Pro is bundled owner-wide in Pavio (see `ownerIsProElsewhere` in App.js) —
  // if ANY of the owner's properties is pro/owned, all of their properties are
  // effectively Pro. Checking only activeProperty.plan_type here missed that,
  // so owners with a property still marked "trial" in the DB (but unlocked via
  // Pro on another property) never got automatic WhatsApp receipts — it fell
  // through to the manual Basic-plan popup instead.
  const isPro = properties.some(p => p.plan_type === 'pro' || p.plan_type === 'owned')
  const [tenants, setTenants] = useState([])
  const [vacatedTenants, setVacatedTenants] = useState([])
  const [vacantBeds, setVacantBeds] = useState([])
  const [rentPayments, setRentPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showExport, setShowExport] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showCollect, setShowCollect] = useState(false)
  const [showVacate, setShowVacate] = useState(false)
  const [showCollectDaily, setShowCollectDaily] = useState(false)
  const [dailyDays, setDailyDays] = useState('')
  const [dailyAmount, setDailyAmount] = useState('')
  const [dailyDate, setDailyDate] = useState(currentDate())
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [collectAmount, setCollectAmount] = useState('')
  const [collectDate, setCollectDate] = useState(currentDate())
  const [collectMonth, setCollectMonth] = useState(currentMonth())
  const [vacateDate, setVacateDate] = useState(currentDate())
  const [daysPaid, setDaysPaid] = useState('')
  const [isPartialPay, setIsPartialPay] = useState(false)
  const [receiptData, setReceiptData] = useState(null)
  const [toast, setToast] = useState('')
  const [tab, setTab] = useState('active')
  const [filterStatus, setFilterStatus] = useState(initialFilter)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    name: '', phone: '', aadhar: '', bed_id: '',
    movein_date: currentDate(), rent: '', advance: '',
    billing_type: 'monthly', daily_paid_days: '', daily_paid_amount: ''
  })

  const month = currentMonth()

  useEffect(() => { setFilterStatus(initialFilter) }, [initialFilter])

  const load = useCallback(async () => {
    const [t, vacated, b] = await Promise.all([
      supabase.from('tenants').select('*').eq('property_id', propertyId).neq('status', 'vacated').order('name'),
      supabase.from('tenants').select('*').eq('property_id', propertyId).eq('status', 'vacated').order('vacate_date', { ascending: false, nullsFirst: false }),
      supabase.from('beds').select('id').eq('property_id', propertyId).eq('status', 'vacant').order('id'),
    ])
    const activeIds = (t.data || []).map(x => x.id)
    // Fetch full payment history (not just the current month) for active tenants —
    // otherwise once a new month starts, an unpaid older month silently disappears
    // from view instead of showing up as overdue.
    const rp = activeIds.length
      ? await supabase.from('rent_payments').select('tenant_id, month, amount, paid_date, stay_end_date, days_paid').eq('property_id', propertyId).in('tenant_id', activeIds)
      : { data: [] }
    setTenants(t.data || [])
    setVacatedTenants(vacated.data || [])
    setVacantBeds(b.data || [])
    setRentPayments(rp.data || [])
    setLoading(false)
  }, [propertyId, month])

  useEffect(() => { load() }, [load])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }
  const isPaidForMonth = (tenantId, m) => rentPayments.some(r => r.tenant_id === tenantId && r.month === m)
  const getPaymentForMonth = (tenantId, m) => rentPayments.find(r => r.tenant_id === tenantId && r.month === m)
  const isPaid = id => isPaidForMonth(id, month)
  const getPayment = id => getPaymentForMonth(id, month)

  // Every month from move-in through the current month that has no matching
  // rent_payments row — i.e. everything still owed, including past months.
  const monthsBetweenInclusive = (start, end) => {
    const [sy, sm] = start.split('-').map(Number)
    const [ey, em] = end.split('-').map(Number)
    const months = []
    let y = sy, m = sm
    while (y < ey || (y === ey && m <= em)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`)
      m++
      if (m > 12) { m = 1; y++ }
    }
    return months
  }
  const getDueMonths = (tenant) => {
    if (!tenant.movein_date) return []
    const startMonth = tenant.movein_date.slice(0, 7)
    if (startMonth > month) return []
    return monthsBetweenInclusive(startMonth, month).filter(m => !isPaidForMonth(tenant.id, m))
  }

  const getRentStatus = (tenant) => {
    const dueMonths = getDueMonths(tenant)
    if (dueMonths.length === 0) return 'paid'
    const pastDue = dueMonths.filter(m => m !== month)
    if (pastDue.length > 0) return 'due' // overdue from an earlier month — always due, no grace period
    const today = new Date()
    const todayDay = today.getDate()
    const joinDay = tenant.movein_date ? parseInt(tenant.movein_date.split('-')[2]) : 1
    if (todayDay >= joinDay - 1) return 'due'
    return 'upcoming'
  }
  const isDue = (tenant) => getRentStatus(tenant) === 'due'

  // Unified status across both billing types, used for the filter tabs and
  // the Due badge count -- daily tenants only ever resolve to 'due'/'paid'
  // (no 'upcoming' concept for them), and never feed the rupee-based
  // totalRentDue figure below, since daily rates are not stored here.
  const getStatus = (tenant) => tenant.billing_type === 'daily'
    ? (getDailyPendingDays(tenant) > 0 ? 'due' : 'paid')
    : getRentStatus(tenant)

  const getDaysRemaining = (tenantId) => {
    const payment = getPayment(tenantId)
    if (!payment || !payment.stay_end_date) return null
    const today = new Date()
    const end = new Date(payment.stay_end_date)
    const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24))
    return diff
  }

  const openCollect = (tenant) => {
    const dueMonths = getDueMonths(tenant)
    setSelectedTenant(tenant)
    setCollectAmount(String(tenant.rent))
    setCollectDate(currentDate())
    setCollectMonth(dueMonths[0] || month)
    setDaysPaid('')
    setIsPartialPay(false)
    setShowCollect(true)
  }

  const openVacate = (tenant) => {
    setSelectedTenant(tenant)
    setVacateDate(currentDate())
    setShowVacate(true)
  }

  const openCollectDaily = (tenant) => {
    setSelectedTenant(tenant)
    setDailyDays('')
    setDailyAmount('')
    setDailyDate(currentDate())
    setShowCollectDaily(true)
  }

  const handleCollectRent = async () => {
    if (!collectAmount) { showToast('Enter amount'); return }
    if (saving) return
    setSaving(true)
    const amount = parseInt(collectAmount)

    let stayEndDate = null
    if (isPartialPay && daysPaid) {
      const baseDate = selectedTenant.movein_date ? new Date(selectedTenant.movein_date) : new Date(collectDate)
      baseDate.setDate(baseDate.getDate() + parseInt(daysPaid) - 1)
      stayEndDate = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`
    }

    const { error } = await supabase.from('rent_payments').upsert({
      tenant_id: selectedTenant.id, month: collectMonth, amount,
      paid_date: collectDate, property_id: propertyId,
      days_paid: isPartialPay && daysPaid ? parseInt(daysPaid) : null,
      stay_end_date: stayEndDate
    }, { onConflict: 'tenant_id,month' })
    if (error) { showToast('Error: ' + error.message); setSaving(false); return }

    const desc = isPartialPay && daysPaid
      ? `${selectedTenant.name} — ${daysPaid} days rent (till ${stayEndDate})`
      : `${selectedTenant.name} — ${collectMonth} rent`

    await supabase.from('transactions').insert({
      date: collectDate, type: 'income', category: 'Rent',
      description: desc, amount, property_id: propertyId
    })

    if (selectedTenant.status === 'due') {
      await supabase.from('tenants').update({ status: 'active' }).eq('id', selectedTenant.id)
    }

    // Show receipt popup instead of auto-opening WhatsApp
    if (selectedTenant.phone) {
      if (isPro) {
        // Pro plan: send receipt automatically via Edge Function
        supabase.functions.invoke('send-payment-receipt', {
          body: {
            tenant_id: selectedTenant.id,
            property_id: propertyId,
            amount,
            paid_date: collectDate,
            month: collectMonth
          }
        }).then(({ data, error }) => {
          if (error) console.log('[receipt] error:', error)
          else if (data?.success) showToast(`Receipt sent to ${selectedTenant.name.split(' ')[0]} on WhatsApp`)
          else if (!data?.skipped) console.log('[receipt] failed:', data)
        }).catch(e => console.log('[receipt] invoke error:', e))
      } else {
        // Basic plan: show manual popup
        setReceiptData({
          phone: selectedTenant.phone,
          name: selectedTenant.name,
          bed: selectedTenant.bed_id,
          amount,
          date: collectDate,
          month: collectMonth,
          isPartial: isPartialPay && !!daysPaid,
          days: daysPaid,
          from: selectedTenant.movein_date,
          till: stayEndDate
        })
      }
    }

    showToast(`Rent collected from ${selectedTenant.name}`)
    setShowCollect(false)
    setSaving(false)
    load()
  }

  const handleVacate = async () => {
    await supabase.from('tenants').update({
      status: 'vacated',
      vacate_date: vacateDate
    }).eq('id', selectedTenant.id)
    await supabase.from('beds').update({ status: 'vacant' }).eq('id', selectedTenant.bed_id).eq('property_id', propertyId)
    showToast(`${selectedTenant.name} vacated successfully`)
    setShowVacate(false)
    load()
  }

  // Logs one entry in the running daily-payments ledger (never overwrites
  // a previous entry, unlike the old undo-and-redo workaround for monthly
  // partial payments) and advances the tenant's paid-through date by the
  // number of days just paid, stacking on whatever was already covered.
  const handleCollectDaily = async () => {
    if (!dailyDays) { showToast('Enter number of days'); return }
    if (saving) return
    setSaving(true)
    const days = parseInt(dailyDays)
    const amount = dailyAmount ? parseInt(dailyAmount) : null

    const { error } = await supabase.from('daily_payments').insert({
      tenant_id: selectedTenant.id, property_id: propertyId,
      days, amount, paid_date: dailyDate
    })
    if (error) { showToast('Error: ' + error.message); setSaving(false); return }

    const base = selectedTenant.daily_paid_through_date
      ? new Date(selectedTenant.daily_paid_through_date)
      : (() => { const d = new Date(selectedTenant.movein_date); d.setDate(d.getDate() - 1); return d })()
    base.setDate(base.getDate() + days)
    const newPaidThrough = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`

    await supabase.from('tenants').update({ daily_paid_through_date: newPaidThrough }).eq('id', selectedTenant.id)

    if (amount) {
      await supabase.from('transactions').insert({
        date: dailyDate, type: 'income', category: 'Rent',
        description: `${selectedTenant.name} -- ${days} day${days > 1 ? 's' : ''} rent`, amount, property_id: propertyId
      })
    }

    if (selectedTenant.phone) {
      if (isPro) {
        supabase.functions.invoke('send-payment-receipt', {
          body: {
            tenant_id: selectedTenant.id, property_id: propertyId,
            amount, paid_date: dailyDate, billing_type: 'daily', days
          }
        }).then(({ data, error }) => {
          if (error) console.log('[receipt] error:', error)
          else if (data?.success) showToast(`Receipt sent to ${selectedTenant.name.split(' ')[0]} on WhatsApp`)
          else if (!data?.skipped) console.log('[receipt] failed:', data)
        }).catch(e => console.log('[receipt] invoke error:', e))
      } else {
        setReceiptData({
          phone: selectedTenant.phone, name: selectedTenant.name, bed: selectedTenant.bed_id,
          amount, date: dailyDate, isDaily: true, days
        })
      }
    }

    showToast(`Payment logged for ${selectedTenant.name}`)
    setShowCollectDaily(false)
    setSaving(false)
    load()
  }

  const handleUndoPayment = async (tenant) => {
    if (!window.confirm(`Undo ${tenant.name}'s payment for ${month}?`)) return
    await supabase.from('rent_payments').delete().eq('tenant_id', tenant.id).eq('month', month)
    showToast('Payment undone')
    load()
  }

  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!form.name || !form.bed_id) { showToast('Fill name and bed'); return }
    if (form.billing_type === 'monthly' && !form.rent) { showToast('Enter monthly rent'); return }
    if (saving) return
    setSaving(true)
    const rent = form.billing_type === 'monthly' ? (parseInt(form.rent) || 0) : null
    const advance = parseInt(form.advance) || 0
    const paidDays = form.billing_type === 'daily' ? (parseInt(form.daily_paid_days) || 0) : 0

    // For a daily tenant paid upfront at check-in, start their paid-through
    // date at (check-in + days paid - 1) so pending days count correctly
    // from day one -- otherwise every new daily tenant would show due instantly.
    let daily_paid_through_date = null
    if (form.billing_type === 'daily' && paidDays > 0) {
      const base = new Date(form.movein_date)
      base.setDate(base.getDate() + paidDays - 1)
      daily_paid_through_date = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
    }

    const { data: newTenant, error } = await supabase.from('tenants').insert({
      name: form.name, phone: form.phone, aadhar: form.aadhar,
      bed_id: form.bed_id, movein_date: form.movein_date,
      rent, advance, status: 'active', property_id: propertyId,
      billing_type: form.billing_type, daily_paid_through_date
    }).select().single()
    if (error) { showToast('Error: ' + error.message); setSaving(false); return }
    await supabase.from('beds').update({ status: 'occupied' }).eq('id', form.bed_id).eq('property_id', propertyId)

    if (form.billing_type === 'daily' && paidDays > 0) {
      await supabase.from('daily_payments').insert({
        tenant_id: newTenant.id, property_id: propertyId,
        days: paidDays, amount: form.daily_paid_amount ? parseInt(form.daily_paid_amount) : null,
        paid_date: form.movein_date
      })
    }

    const upfrontAmount = form.billing_type === 'monthly' ? advance : (parseInt(form.daily_paid_amount) || 0)
    if (upfrontAmount > 0) {
      await supabase.from('transactions').insert({
        date: form.movein_date, type: 'income',
        category: form.billing_type === 'monthly' ? 'Advance' : 'Rent',
        description: form.billing_type === 'monthly'
          ? form.name + ' -- advance payment'
          : `${form.name} -- ${paidDays} day${paidDays > 1 ? 's' : ''} rent (check-in)`,
        amount: upfrontAmount, property_id: propertyId
      })
    }

    showToast('Tenant added!')
    setShowAdd(false)
    setSaving(false)
    setForm({ name: '', phone: '', aadhar: '', bed_id: '', movein_date: currentDate(), rent: '', advance: '', billing_type: 'monthly', daily_paid_days: '', daily_paid_amount: '' })
    load()
  }

  const getWhatsAppMsg = (tenant) => {
    const hostelName = activeProperty?.name || 'Hosteloops'
    const gpay = activeProperty?.gpay_number || ''
    const dueMonths = getDueMonths(tenant)
    const msg = dueMonths.length > 1
      ? `Hi ${tenant.name.split(' ')[0]}, your rent for ${dueMonths.length} months (${fmt(dueMonths.length * tenant.rent)} total, since ${dueMonths[0]}) is pending. Please pay via GPay to ${gpay} (${hostelName}). Thank you! — ${hostelName}`
      : `Hi ${tenant.name.split(' ')[0]}, your rent of ${fmt(tenant.rent)} for ${month} is due. Please pay via GPay to ${gpay} (${hostelName}). Thank you! — ${hostelName}`
    return `https://wa.me/91${tenant.phone}?text=${encodeURIComponent(msg)}`
  }

  // Due-reminder message for a daily tenant -- day count only, no amount,
  // since the app does not store a fixed daily rate (see getDailyPendingDays).
  const getDailyWhatsAppMsg = (tenant) => {
    const hostelName = activeProperty?.name || 'Hosteloops'
    const pending = getDailyPendingDays(tenant)
    const msg = `Hi ${tenant.name.split(' ')[0]}, you have ${pending} day${pending > 1 ? 's' : ''} of stay pending payment at ${hostelName}. Please settle whenever convenient. Thank you!`
    return `https://wa.me/91${tenant.phone}?text=${encodeURIComponent(msg)}`
  }

  const buildReceiptUrl = (r) => {
    let msg = ''
    const hostelName = activeProperty?.name || 'Hosteloops'
    if (r.isDaily) {msg = `Hi ${r.name.split(' ')[0]},
Receipt - ${hostelName}
Bed: ${r.bed}
Amount paid: ₹${r.amount ? Number(r.amount).toLocaleString('en-IN') : '0'}
Days: ${r.days} day${r.days > 1 ? 's' : ''}
Date: ${r.date}
Thank you! — ${hostelName}`
    } else if (r.isPartial) {msg = `Hi ${r.name.split(' ')[0]},
Receipt - ${hostelName}
Bed: ${r.bed}
Amount paid: ₹${Number(r.amount).toLocaleString('en-IN')}
Days: ${r.days} days
Valid from: ${r.from}
Valid till: ${r.till}
Thank you! — ${hostelName}`
    } else {
msg = `Hi ${r.name.split(' ')[0]},
Receipt - ${hostelName}
Bed: ${r.bed}
Amount paid: ₹${Number(r.amount).toLocaleString('en-IN')}
Month: ${r.month}
Date: ${r.date}
Thank you! — ${hostelName}`
    }
    return `https://wa.me/91${r.phone}?text=${encodeURIComponent(msg)}`
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const escape = val => `"${String(val ?? '').replace(/"/g, '""')}"`
  const toCSV = (headers, rows) => [
    headers.map(escape).join(','),
    ...rows.map(r => r.map(escape).join(','))
  ].join('\n')

  const getActiveRows = () => {
    const headers = ['Name', 'Phone', 'Aadhar', 'Bed', 'Move-in Date', 'Monthly Rent', 'Advance', 'Payment Status', 'Amount Paid', 'Months Overdue', 'Total Due (₹)']
    const rows = tenants.map(t => {
      if (t.billing_type === 'daily') {
        const pending = getDailyPendingDays(t)
        return [
          t.name, t.phone || '', t.aadhar || '', t.bed_id || '',
          t.movein_date || '', 'Daily', t.advance || '',
          pending > 0 ? 'Due' : 'Paid', '',
          pending || '', pending ? `${pending} days` : ''
        ]
      }
      const payment = getPayment(t.id)
      const status = getRentStatus(t)
      const dueMonths = getDueMonths(t)
      return [
        t.name, t.phone || '', t.aadhar || '', t.bed_id || '',
        t.movein_date || '', t.rent || '', t.advance || '',
        status === 'paid' ? 'Paid' : status === 'due' ? 'Due' : 'Upcoming',
        payment ? payment.amount : '',
        dueMonths.length || '',
        dueMonths.length ? dueMonths.length * t.rent : ''
      ]
    })
    return { headers, rows }
  }

  const getVacatedRows = () => {
    const headers = ['Name', 'Phone', 'Aadhar', 'Bed', 'Move-in Date', 'Vacate Date', 'Monthly Rent', 'Advance']
    const rows = vacatedTenants.map(t => [
      t.name, t.phone || '', t.aadhar || '', t.bed_id || '',
      t.movein_date || '', t.vacate_date || '', t.rent || '', t.advance || ''
    ])
    return { headers, rows }
  }

  const downloadCSV = () => {
    const propertyName = activeProperty?.name || 'Property'
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

    let content, filename
    if (tab === 'active') {
      const { headers, rows } = getActiveRows()
      content = [`Pavio — ${propertyName}`, `Downloaded: ${dateStr}`, `Month: ${month}`, '', toCSV(headers, rows)].join('\n')
      filename = `${propertyName}-active-tenants-${dateStr}.csv`
    } else {
      const { headers, rows } = getVacatedRows()
      content = [`Pavio — ${propertyName}`, `Downloaded: ${dateStr}`, '', toCSV(headers, rows)].join('\n')
      filename = `${propertyName}-vacated-tenants-${dateStr}.csv`
    }

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
    showToast('CSV downloaded!')
  }

  const loadScript = (src) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src; s.onload = resolve; s.onerror = reject
    document.head.appendChild(s)
  })

  const downloadExcel = async () => {
    const propertyName = activeProperty?.name || 'Property'
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

    let headers, rows, sheetName, filename
    if (tab === 'active') {
      const d = getActiveRows(); headers = d.headers; rows = d.rows
      sheetName = 'Active Tenants'
      filename = `${propertyName}-active-tenants-${dateStr}.xlsx`
    } else {
      const d = getVacatedRows(); headers = d.headers; rows = d.rows
      sheetName = 'Vacated History'
      filename = `${propertyName}-vacated-tenants-${dateStr}.xlsx`
    }

    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js')
    const XLSX = window.XLSX

    const wsData = [headers, ...rows]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = headers.map((h, i) => ({
      wch: Math.min(Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length)) + 2, 30)
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, filename)
    showToast('Excel downloaded!')
  }

  const downloadPDF = async () => {
    const propertyName = activeProperty?.name || 'Property'
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

    let headers, rows, title, filename
    if (tab === 'active') {
      const d = getActiveRows(); headers = d.headers; rows = d.rows
      title = `Active Tenants — ${propertyName}`
      filename = `${propertyName}-active-tenants-${dateStr}.pdf`
    } else {
      const d = getVacatedRows(); headers = d.headers; rows = d.rows
      title = `Vacated History — ${propertyName}`
      filename = `${propertyName}-vacated-tenants-${dateStr}.pdf`
    }

    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')

    const { jsPDF } = window.jspdf
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(216, 90, 48)
    doc.text('Pavio PMS', 14, 14)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 25, 22)
    doc.text(title, 14, 22)

    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text(`Downloaded: ${dateStr}  |  Month: ${month}`, 14, 29)

    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 34,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [216, 90, 48], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 246, 243] },
      margin: { left: 14, right: 14 }
    })

    doc.save(filename)
    showToast('PDF downloaded!')
  }

  if (loading) return <div className="loading">Loading tenants...</div>

  const paidThisMonth = tenants.filter(t => isPaid(t.id)).length
  const unpaidCount = tenants.filter(t => getStatus(t) === 'due').length
  const upcomingCount = tenants.filter(t => t.billing_type !== 'daily' && getRentStatus(t) === 'upcoming').length
  // Daily tenants never feed this rupee figure -- their rate is not stored,
  // so their pending days are shown as a plain count elsewhere, never ₹.
  const totalRentDue = tenants.filter(t => t.billing_type !== 'daily' && getRentStatus(t) === 'due').reduce((a, t) => a + getDueMonths(t).length * t.rent, 0)

  const filteredTenants = tenants.filter(t => {
    const matchesStatus = filterStatus === 'paid' ? getStatus(t) === 'paid'
      : filterStatus === 'due' ? getStatus(t) === 'due'
      : filterStatus === 'upcoming' ? getStatus(t) === 'upcoming'
      : true
    const q = search.toLowerCase()
    const matchesSearch = !q || t.name.toLowerCase().includes(q) || (t.bed_id || '').toLowerCase().includes(q) || (t.phone || '').includes(q)
    return matchesStatus && matchesSearch
  })

  const filteredVacated = vacatedTenants.filter(t => {
    const q = search.toLowerCase()
    return !q || t.name.toLowerCase().includes(q) || (t.bed_id || '').toLowerCase().includes(q) || (t.phone || '').includes(q)
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tenants</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setShowExport(true)}>↓ Export</button>
          {(!isStaff || canAddTenants) && tab === 'active' && (
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add tenant</button>
          )}
        </div>
      </div>

      {/* Main tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {[['active', `Active (${tenants.length})`], ['vacated', `Vacated history (${vacatedTenants.length})`]].map(([val, label]) => (
          <button key={val} onClick={() => setTab(val)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 500,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === val ? 'var(--text)' : 'var(--text-secondary)',
              borderBottom: tab === val ? '2px solid var(--text)' : '2px solid transparent',
              marginBottom: -1
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: 15, pointerEvents: 'none' }}>🔍</span>
        <input
          placeholder="Search by name, bed or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)' }}
        />
        {search && (
          <button onClick={() => setSearch('')}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 16 }}>×</button>
        )}
      </div>

      {/* ACTIVE TENANTS TAB */}
      {tab === 'active' && (
        <>
          <div className="metrics" style={{ marginBottom: 20 }}>
            <div className="metric"><div className="metric-label">Total tenants</div><div className="metric-value">{tenants.length}</div><div className="metric-sub">{vacantBeds.length} beds vacant</div></div>
            <div className="metric"><div className="metric-label">Paid this month</div><div className="metric-value" style={{ color: 'var(--green)' }}>{paidThisMonth}</div><div className="metric-sub">{month}</div></div>
            <div className="metric"><div className="metric-label">Rent due</div><div className="metric-value" style={{ color: unpaidCount > 0 ? 'var(--red)' : 'var(--green)' }}>{unpaidCount}</div><div className="metric-sub">{upcomingCount} upcoming</div></div>
            <div className="metric"><div className="metric-label">Outstanding</div><div className="metric-value" style={{ color: totalRentDue > 0 ? 'var(--red)' : 'var(--green)', fontSize: 18 }}>{fmt(totalRentDue)}</div><div className="metric-sub">to collect</div></div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {[['all', 'All'], ['due', 'Due'], ['upcoming', 'Upcoming'], ['paid', 'Paid']].map(([val, label]) => (
              <button key={val} onClick={() => setFilterStatus(val)}
                className={`btn ${filterStatus === val ? 'btn-primary' : ''}`}
                style={{ fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
                {label}
                {val === 'due' && unpaidCount > 0 && (
                  <span style={{ background: 'var(--red)', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>{unpaidCount}</span>
                )}
                {val === 'upcoming' && upcomingCount > 0 && (
                  <span style={{ background: 'var(--amber)', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>{upcomingCount}</span>
                )}
              </button>
            ))}
          </div>

          <div className="card">
            {filteredTenants.length === 0 ? <div className="empty">No tenants found</div> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Bed</th><th>Rent</th><th>{month}</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filteredTenants.map(t => {
                      const status = getStatus(t)
                      const payment = getPayment(t.id)
                      const daysLeft = getDaysRemaining(t.id)
                      const joinDay = t.movein_date ? parseInt(t.movein_date.split('-')[2]) : 1
                      const dueMonths = getDueMonths(t)
                      return (
                        <tr key={t.id}>
                          <td>
  <div style={{ fontWeight: 500 }}>{t.name}</div>
  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.phone}</div>
  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Check-in: {t.movein_date}</div>
</td>                          <td><span className="badge badge-blue">{t.bed_id}</span></td>
                          <td style={{ fontWeight: 600 }}>{t.billing_type === 'daily' ? <span className="badge badge-blue" style={{ fontWeight: 400 }}>Daily</span> : fmt(t.rent)}</td>
                          <td>
                            {t.billing_type === 'daily' ? (
                              (() => {
                                const pendingDays = getDailyPendingDays(t)
                                return pendingDays > 0 ? (
                                  <span className="badge badge-red">{pendingDays} day{pendingDays > 1 ? 's' : ''} due</span>
                                ) : (
                                  <span className="badge badge-green">Paid up to date</span>
                                )
                              })()
                            ) : status === 'paid' ? (
                              <div>
                                <span className="badge badge-green">Paid</span>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                  {payment?.paid_date} · {fmt(payment?.amount)}
                                </div>
                                {payment?.stay_end_date && (
                                  <div style={{ marginTop: 4 }}>
                                    {daysLeft < 0 ? (
                                      <span className="badge badge-red" style={{ fontSize: 10 }}>Stay ended {Math.abs(daysLeft)}d ago</span>
                                    ) : daysLeft <= 3 ? (
                                      <span className="badge badge-red" style={{ fontSize: 10 }}>⚠ {daysLeft === 0 ? 'Ends today!' : `${daysLeft}d left`}</span>
                                    ) : (
                                      <span className="badge badge-amber" style={{ fontSize: 10 }}>{daysLeft}d left · till {payment.stay_end_date}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : status === 'upcoming' ? (
                              <span className="badge badge-amber">Due on {joinDay}th</span>
                            ) : (
                              <div>
                                <span className="badge badge-red">Due</span>
                                {dueMonths.length > 1 && (
                                  <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 2, fontWeight: 500 }}>
                                    {dueMonths.length} months since {dueMonths[0]} · {fmt(dueMonths.length * t.rent)}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {t.billing_type === 'daily' ? (
                                (!isStaff || canCollectRent) && (
                                  <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px' }}
                                    onClick={() => openCollectDaily(t)}>Collect payment</button>
                                )
                              ) : status === 'paid' ? (
                                (!isStaff || canDeleteEntries) && (
                                  <button className="btn" style={{ fontSize: 11, padding: '4px 10px', color: 'var(--text-tertiary)' }}
                                    onClick={() => handleUndoPayment(t)}>Undo</button>
                                )
                              ) : status === 'due' ? (
                                <>
                                  {(!isStaff || canCollectRent) && (
                                    <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px' }}
                                      onClick={() => openCollect(t)}>Collect rent</button>
                                  )}
                                  {t.phone && (
                                    <a href={getWhatsAppMsg(t)} target="_blank" rel="noreferrer"
                                      className="btn" style={{ fontSize: 11, padding: '4px 10px', textDecoration: 'none', color: 'var(--green)', borderColor: '#a8d5bb', background: 'var(--green-bg)' }}>
                                      WhatsApp
                                    </a>
                                  )}
                                </>
                              ) : (
                                (!isStaff || canCollectRent) && (
                                  <button className="btn" style={{ fontSize: 11, padding: '4px 10px', color: 'var(--text-tertiary)' }}
                                    onClick={() => openCollect(t)}>Collect early</button>
                                )
                              )}
                              {(!isStaff || canAddTenants) && (
                                <button className="btn btn-danger" style={{ fontSize: 11, padding: '4px 10px' }}
                                  onClick={() => openVacate(t)}>Vacate</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* VACATED HISTORY TAB */}
      {tab === 'vacated' && (
        <div className="card">
          {filteredVacated.length === 0 ? (
            <div className="empty">No vacated tenants yet</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Bed</th><th>Phone</th><th>Move-in</th><th>Vacated on</th><th>Rent</th></tr></thead>
                <tbody>
                  {filteredVacated.map(t => (
                    <tr key={t.id}>
                      <td><div style={{ fontWeight: 500 }}>{t.name}</div><div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.aadhar}</div></td>
                      <td><span className="badge badge-blue">{t.bed_id}</span></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{t.phone || '—'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{t.movein_date}</td>
                      <td>{t.vacate_date ? <span className="badge badge-red">{t.vacate_date}</span> : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}</td>
                      <td style={{ fontWeight: 600 }}>{fmt(t.rent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* COLLECT RENT MODAL */}
      {showCollect && selectedTenant && (
        <Modal title={`Collect rent — ${selectedTenant.name}`} onClose={() => setShowCollect(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShowCollect(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCollectRent} disabled={saving}>{saving ? 'Saving...' : 'Confirm payment'}</button>
            </>
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
              <div className="row-between" style={{ marginBottom: 4 }}><span style={{ color: 'var(--text-secondary)' }}>Tenant</span><span style={{ fontWeight: 500 }}>{selectedTenant.name}</span></div>
              <div className="row-between" style={{ marginBottom: 4 }}><span style={{ color: 'var(--text-secondary)' }}>Bed</span><span>{selectedTenant.bed_id}</span></div>
              <div className="row-between"><span style={{ color: 'var(--text-secondary)' }}>Monthly rent</span><span style={{ fontWeight: 600 }}>₹{Number(selectedTenant.rent).toLocaleString('en-IN')}</span></div>
            </div>
            {getDueMonths(selectedTenant).length > 1 && (
              <>
                <div style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: 6 }}>
                  {selectedTenant.name.split(' ')[0]} owes {getDueMonths(selectedTenant).length} months · total {fmt(getDueMonths(selectedTenant).length * selectedTenant.rent)}
                </div>
                <div className="form-group">
                  <label>Which month is this payment for?</label>
                  <select value={collectMonth} onChange={e => setCollectMonth(e.target.value)}>
                    {getDueMonths(selectedTenant).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </>
            )}
            <div className="form-grid">
              <div className="form-group"><label>Amount (₹)</label><input type="number" value={collectAmount} onChange={e => setCollectAmount(e.target.value)} /></div>
              <div className="form-group"><label>Payment date</label><input type="date" value={collectDate} onChange={e => setCollectDate(e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              <input type="checkbox" id="partial-toggle" checked={isPartialPay}
                onChange={e => { setIsPartialPay(e.target.checked); if (!e.target.checked) setDaysPaid('') }}
                style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="partial-toggle" style={{ fontSize: 13, cursor: 'pointer', color: 'var(--text)' }}>
                Paying for specific days only
              </label>
            </div>
            {isPartialPay && (
              <div className="form-grid">
                <div className="form-group">
                  <label>Number of days paid</label>
                  <input type="number" placeholder="e.g. 15" value={daysPaid} onChange={e => setDaysPaid(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Stay ends on</label>
                  <input type="text" readOnly value={(() => {
                    if (!daysPaid) return '—'
                    const base = selectedTenant.movein_date ? new Date(selectedTenant.movein_date) : new Date(collectDate)
                    base.setDate(base.getDate() + parseInt(daysPaid) - 1)
                    return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
                  })()} style={{ background: 'var(--bg)', color: 'var(--green)', fontWeight: 600 }} />
                </div>
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--green)', background: 'var(--green-bg)', padding: '8px 12px', borderRadius: 6 }}>
              {isPartialPay && daysPaid
                ? `Will alert when ${selectedTenant.name.split(' ')[0]}'s ${daysPaid} days are ending.`
                : 'Auto-adds to Income & expenses.'}
            </div>
          </div>
        </Modal>
      )}
      {/* COLLECT DAILY PAYMENT MODAL */}
      {showCollectDaily && selectedTenant && (
        <Modal title={`Collect payment — ${selectedTenant.name}`} onClose={() => setShowCollectDaily(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShowCollectDaily(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCollectDaily} disabled={saving}>{saving ? 'Saving...' : 'Confirm payment'}</button>
            </>
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-grid">
              <div className="form-group"><label>How many days is this for? *</label><input type="number" placeholder="1" value={dailyDays} onChange={e => setDailyDays(e.target.value)} /></div>
              <div className="form-group"><label>How much (₹)?</label><input type="number" placeholder="200" value={dailyAmount} onChange={e => setDailyAmount(e.target.value)} /></div>
            </div>
            <div className="form-group"><label>Payment date</label><input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)} /></div>
            <div style={{ fontSize: 12, color: 'var(--green)', background: 'var(--green-bg)', padding: '8px 12px', borderRadius: 6 }}>
              Marks {dailyDays || '…'} day{dailyDays == 1 ? '' : 's'} as paid and auto-adds to Income.
            </div>
          </div>
        </Modal>
      )}


      {/* VACATE MODAL */}
      {showVacate && selectedTenant && (
        <Modal title={`Vacate — ${selectedTenant.name}`} onClose={() => setShowVacate(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShowVacate(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleVacate}>Confirm vacate</button>
            </>
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
              <div className="row-between" style={{ marginBottom: 4 }}><span style={{ color: 'var(--text-secondary)' }}>Tenant</span><span style={{ fontWeight: 500 }}>{selectedTenant.name}</span></div>
              <div className="row-between" style={{ marginBottom: 4 }}><span style={{ color: 'var(--text-secondary)' }}>Bed</span><span>{selectedTenant.bed_id}</span></div>
              <div className="row-between"><span style={{ color: 'var(--text-secondary)' }}>Move-in</span><span>{selectedTenant.movein_date}</span></div>
            </div>
            <div className="form-group">
              <label>Vacate date</label>
              <input type="date" value={vacateDate} onChange={e => setVacateDate(e.target.value)} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: 6 }}>
              This will free up bed {selectedTenant.bed_id} and move tenant to vacated history.
            </div>
          </div>
        </Modal>
      )}

      {/* ADD TENANT MODAL */}
      {showAdd && (
        <Modal title="Add new tenant" onClose={() => setShowAdd(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>{saving ? 'Saving...' : 'Save tenant'}</button>
            </>
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-grid">
              <div className="form-group"><label>Full name *</label><input placeholder="Rahul Nair" value={form.name} onChange={f('name')} /></div>
              <div className="form-group"><label>Phone</label><input placeholder="9876543210" value={form.phone} onChange={f('phone')} /></div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Aadhaar no.</label><input placeholder="XXXX XXXX XXXX" value={form.aadhar} onChange={f('aadhar')} /></div>
              <div className="form-group"><label>Bed *</label>
                <select value={form.bed_id} onChange={f('bed_id')}>
                  <option value="">Select bed</option>
                  {vacantBeds.map(b => <option key={b.id} value={b.id}>{b.id}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid single">
              <div className="form-group"><label>Billing type</label>
                <select value={form.billing_type} onChange={f('billing_type')}>
                  <option value="monthly">Monthly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
            </div>
            {form.billing_type === 'monthly' ? (
              <>
                <div className="form-grid">
                  <div className="form-group"><label>Move-in date</label><input type="date" value={form.movein_date} onChange={f('movein_date')} /></div>
                  <div className="form-group"><label>Monthly rent (₹) *</label><input type="number" placeholder="5000" value={form.rent} onChange={f('rent')} /></div>
                </div>
                <div className="form-grid single">
                  <div className="form-group"><label>Advance paid (₹)</label><input type="number" placeholder="0" value={form.advance} onChange={f('advance')} /></div>
                </div>
              </>
            ) : (
              <>
                <div className="form-grid single">
                  <div className="form-group"><label>Check-in date</label><input type="date" value={form.movein_date} onChange={f('movein_date')} /></div>
                </div>
                <div className="form-grid">
                  <div className="form-group"><label>Days already paid (optional)</label><input type="number" placeholder="0" value={form.daily_paid_days} onChange={f('daily_paid_days')} /></div>
                  <div className="form-group"><label>Amount collected (optional, ₹)</label><input type="number" placeholder="0" value={form.daily_paid_amount} onChange={f('daily_paid_amount')} /></div>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* WHATSAPP RECEIPT POPUP */}
      {receiptData && receiptData.phone && (
        <div style={{
          position: 'fixed', bottom: 80, right: 24, zIndex: 200,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '14px 16px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxWidth: 280
        }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>✅ Rent collected!</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Send receipt to {receiptData.name.split(' ')[0]}?
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10, lineHeight: 1.6 }}>
            {receiptData.isDaily
              ? `${receiptData.amount ? '₹' + Number(receiptData.amount).toLocaleString('en-IN') + ' · ' : ''}${receiptData.days} day${receiptData.days > 1 ? 's' : ''}`
              : receiptData.isPartial
              ? `₹${Number(receiptData.amount).toLocaleString('en-IN')} · ${receiptData.days} days · till ${receiptData.till}`
              : `₹${Number(receiptData.amount).toLocaleString('en-IN')} · ${receiptData.month}`
            }
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ fontSize: 12, flex: 1 }}
              onClick={() => setReceiptData(null)}>Skip</button>
            <a href={buildReceiptUrl(receiptData)}
              target="_blank" rel="noreferrer"
              className="btn btn-primary"
              style={{ fontSize: 12, flex: 1, textDecoration: 'none', textAlign: 'center' }}
              onClick={() => setReceiptData(null)}>
              WhatsApp ↗
            </a>
          </div>
        </div>
      )}

      {/* EXPORT MODAL */}
      {showExport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}
          onClick={() => setShowExport(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 24, minWidth: 320, maxWidth: 420, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Export tenants</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              {tab === 'active'
                ? `Exporting ${tenants.length} active tenants · Month: ${month}`
                : `Exporting ${vacatedTenants.length} vacated tenants`}
            </div>

            {/* CSV */}
            <button onClick={() => { downloadCSV(); setShowExport(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', marginBottom: 10, background: 'var(--text)', color: 'white', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 22 }}>📊</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Download as CSV</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Open in Excel or Google Sheets</div>
              </div>
            </button>

            {/* PDF */}
            <button onClick={() => { downloadPDF(); setShowExport(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', marginBottom: 16, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 22 }}>📄</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Download as PDF</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Printable tenant report</div>
              </div>
            </button>

            <button className="btn" style={{ width: '100%' }} onClick={() => setShowExport(false)}>Close</button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
