import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useVentas() {
  const [ventas, setVentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchVentas = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('ventas')
        .select('*')
        .order('fecha', { ascending: false })

      if (fetchError) throw fetchError
      setVentas(data || [])
    } catch (err) {
      console.error('[useVentas] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVentas()

    // ─── Auto-polling cada 15 segundos ───
    // Esto asegura que la UI se actualice sola sin depender de F5 o del socket realtime si falla
    const pollInterval = setInterval(() => {
      // Background re-fetch sin mostrar cartel de loading si ya hay datos
      supabase
        .from('ventas')
        .select('*')
        .order('fecha', { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) {
            setVentas(data)
          }
        })
        
      // También podríamos disparar el sync silenciosamente, lo hacemos cada 30 min o si es necesario
    }, 15000)

    // ─── Realtime subscription ───
    const channel = supabase
      .channel('ventas-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ventas' },
        (payload) => {
          console.log('[Realtime] Cambio en ventas:', payload.eventType)

          if (payload.eventType === 'INSERT') {
            setVentas(prev => {
              // evitar duplicados si el fetch de polling ya lo trajo
              if (prev.some(v => v.id === payload.new.id)) return prev;
              return [payload.new, ...prev].sort((a,b) => new Date(b.fecha) - new Date(a.fecha))
            })
          } else if (payload.eventType === 'UPDATE') {
            setVentas(prev =>
              prev.map(v => v.id === payload.new.id ? payload.new : v)
            )
          } else if (payload.eventType === 'DELETE') {
            setVentas(prev => prev.filter(v => v.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      clearInterval(pollInterval)
      supabase.removeChannel(channel)
    }
  }, [fetchVentas])

  const updateVentaStatus = useCallback(async (id, status, extraFields = {}) => {
    const { error: updateError } = await supabase
      .from('ventas')
      .update({ status, ...extraFields })
      .eq('id', id)

    if (updateError) throw updateError
  }, [])

  const updateVenta = useCallback(async (id, payload) => {
    const { error: updateError } = await supabase
      .from('ventas')
      .update(payload)
      .eq('id', id)

    if (updateError) throw updateError
  }, [])

  const createVenta = useCallback(async (payload) => {
    const { data, error: createError } = await supabase
      .from('ventas')
      .insert([payload])
      .select()
      .single()

    if (createError) throw createError
    return data
  }, [])

  const deleteVenta = useCallback(async (id) => {
    const { error: deleteError } = await supabase
      .from('ventas')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError
  }, [])

  const bulkCreateVentas = useCallback(async (payloads) => {
    const { data, error: createError } = await supabase
      .from('ventas')
      .insert(payloads)
      .select()

    if (createError) throw createError
    return data
  }, [])

  return { ventas, setVentas, loading, error, refetch: fetchVentas, updateVentaStatus, updateVenta, createVenta, deleteVenta, bulkCreateVentas }
}
