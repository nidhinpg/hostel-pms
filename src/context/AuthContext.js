import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PushNotifications } from '@capacitor/push-notifications'
import { Capacitor } from '@capacitor/core'

const AuthContext = createContext({})

const DEFAULT_PERMISSIONS = {
  view_dashboard: true,
  view_bedmap: true,
  collect_rent: true,
  add_expenses: true,
  add_tenants: false,
  delete_entries: false,
  add_beds: false,
  view_reports: false
}

const saveFcmToken = async (userId) => {
  try {
    const permResult = await PushNotifications.requestPermissions()
    if (permResult.receive !== 'granted') return

    await PushNotifications.register()

    PushNotifications.addListener('registration', async (token) => {
      console.log('FCM Token:', token.value)
      await supabase
        .from('profiles')
        .update({ fcm_token: token.value })
        .eq('id', userId)
    })

    PushNotifications.addListener('registrationError', (err) => {
      console.error('FCM registration error:', err)
    })
  } catch (e) {
    console.error('Push notification setup error:', e)
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS)
  const [properties, setProperties] = useState([])
  const [activeProperty, setActiveProperty] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadUserData(session.user)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadUserData(session.user)
      else {
        setProfile(null)
        setPermissions(DEFAULT_PERMISSIONS)
        setProperties([])
        setActiveProperty(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadUserData = async (user) => {
    const { data: profileRows } = await supabase
      .from('profiles').select('*').eq('id', user.id)

    if (!profileRows || profileRows.length === 0) {
      setProfile(null)
      setLoading(false)
      return
    }

    const profileData = profileRows[0]
    setProfile(profileData)

    if (profileData?.role === 'staff') {
      setPermissions({ ...DEFAULT_PERMISSIONS, ...(profileData?.permissions || {}) })
    } else {
      setPermissions({
        view_dashboard: true,
        view_bedmap: true,
        collect_rent: true,
        add_expenses: true,
        add_tenants: true,
        delete_entries: true,
        add_beds: true,
        view_reports: true
      })
    }

    if (profileData?.role === 'staff' && profileData?.property_id) {
      const { data: prop } = await supabase
        .from('properties').select('*').eq('id', profileData.property_id).single()
      setProperties(prop ? [prop] : [])
      setActiveProperty(prop || null)
    } else {
      const propertyIds = profileRows.map(p => p.property_id).filter(Boolean)
      const { data: props } = await supabase
        .from('properties').select('*').in('id', propertyIds).order('created_at')
      const propList = props || []
      setProperties(propList)
      const savedId = localStorage.getItem('activePropertyId')
      const saved = propList.find(p => p.id === savedId)
      setActiveProperty(saved || propList[0] || null)
    }

    // Save FCM token for push notifications (mobile only)
    saveFcmToken(user.id)

    setLoading(false)
  }

  const selectProperty = (property) => {
    setActiveProperty(property)
    localStorage.setItem('activePropertyId', property.id)
  }

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('activePropertyId')
  }

  return (
    <AuthContext.Provider value={{
      user, profile, properties, activeProperty,
      loading, signIn, signOut, selectProperty,
      permissions,
      isAdmin: profile?.is_admin === true,
      isStaff: profile?.role === 'staff',
      isOwner: profile?.role === 'owner' || profile?.is_admin === true,
      refreshProperties: () => user && loadUserData(user)
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
