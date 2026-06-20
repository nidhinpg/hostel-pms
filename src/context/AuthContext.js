import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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
    // Fetch all profile rows for this user (owners can have multiple — one per property)
    const { data: profileRows } = await supabase
      .from('profiles').select('*').eq('id', user.id)

    if (!profileRows || profileRows.length === 0) {
      setProfile(null)
      setLoading(false)
      return
    }

    // Use first row for role/permissions (same across all rows for an owner)
    const profileData = profileRows[0]
    setProfile(profileData)

    // Set permissions
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

    // Staff: load their single assigned property
    if (profileData?.role === 'staff' && profileData?.property_id) {
      const { data: prop } = await supabase
        .from('properties').select('*').eq('id', profileData.property_id).single()
      setProperties(prop ? [prop] : [])
      setActiveProperty(prop || null)
    } else {
      // Owner: load properties for all their profile rows
      const propertyIds = profileRows.map(p => p.property_id).filter(Boolean)
      const { data: props } = await supabase
        .from('properties').select('*').in('id', propertyIds).order('created_at')
      const propList = props || []
      setProperties(propList)
      const savedId = localStorage.getItem('activePropertyId')
      const saved = propList.find(p => p.id === savedId)
      setActiveProperty(saved || propList[0] || null)
    }

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
