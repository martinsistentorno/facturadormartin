import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ConfigContext = createContext(null)

export function ConfigProvider({ children }) {
  const [emisor, setEmisor] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch config on mount
  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('config_emisor')
        .select('*')
        .limit(1)
        .maybeSingle()

      if (error) throw error
      setEmisor(data) // null if no row exists
    } catch (err) {
      console.error('Error cargando config emisor:', err)
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async (configData) => {
    try {
      if (emisor?.id) {
        // Update existing
        const { data, error } = await supabase
          .from('config_emisor')
          .update({
            ...configData,
            updated_at: new Date().toISOString()
          })
          .eq('id', emisor.id)
          .select()
          .single()

        if (error) throw error
        setEmisor(data)
        return data
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('config_emisor')
          .insert([configData])
          .select()
          .single()

        if (error) throw error
        setEmisor(data)
        return data
      }
    } catch (err) {
      console.error('Error guardando config emisor:', err)
      throw err
    }
  }

  const needsSetup = !loading && !emisor

  return (
    <ConfigContext.Provider value={{ emisor, loading, needsSetup, saveConfig, loadConfig }}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig() {
  const context = useContext(ConfigContext)
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider')
  }
  return context
}
