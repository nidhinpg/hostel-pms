import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
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
        setProperties([])
        setActiveProperty(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadUserData = async (user) => {
    const { data: profileData } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()

    setProfile(profileData)

    // Staff: load their assigned property directly
    if (profileData?.role === 'staff' && profileData?.property_id) {
      const { data: prop } = await supabase
        .from('properties').select('*').eq('id', profileData.property_id).single()
      setProperties(prop ? [prop] : [])
      setActiveProperty(prop || null)
    } else {
      // Owner/admin: load all their properties
      const { data: props } = await supabase
        .from('properties').select('*').eq('owner_id', user.id).order('created_at')
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
