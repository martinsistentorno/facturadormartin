import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Pasá --apply para borrar de verdad. Sin flag corre dry-run.
const APPLY = process.argv.includes('--apply')

/**
 * Deduplica filas en `ventas` agrupando por mp_payment_id.
 *
 * Regla por grupo:
 *  - Si hay alguna fila con status='facturado' o con cae no nulo,
 *    se conservan TODAS las facturadas y se borran solo las que NO lo están.
 *    (no tocamos facturas ya emitidas en AFIP)
 *  - Si ninguna está facturada, se conserva la más vieja (menor created_at)
 *    y se borran las demás.
 */
async function dedupe() {
  console.log(`Modo: ${APPLY ? 'APPLY (DELETE REAL)' : 'DRY-RUN (no borra nada)'}\n`)

  // Traemos todo. En las tablas no enormes esto es lo más simple y seguro.
  const { data: ventas, error } = await supabase
    .from('ventas')
    .select('id, mp_payment_id, cliente, monto, status, cae, nro_comprobante, fecha, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error leyendo ventas:', error.message)
    process.exit(1)
  }

  console.log(`Total filas en ventas: ${ventas.length}`)

  // Agrupar por mp_payment_id (ignoramos null)
  const groups = new Map()
  for (const v of ventas) {
    if (!v.mp_payment_id) continue
    const arr = groups.get(v.mp_payment_id) || []
    arr.push(v)
    groups.set(v.mp_payment_id, arr)
  }

  const dupGroups = [...groups.entries()].filter(([, rows]) => rows.length > 1)
  console.log(`Grupos con duplicados (mp_payment_id repetido): ${dupGroups.length}\n`)

  let totalToDelete = 0
  let totalFacturadasIntactas = 0
  const toDeleteIds = []
  const skipped = []

  for (const [mpId, rows] of dupGroups) {
    const facturadas = rows.filter(r => r.status === 'facturado' || r.cae)
    const noFacturadas = rows.filter(r => r.status !== 'facturado' && !r.cae)

    let keep = []
    let drop = []

    if (facturadas.length > 0) {
      // Conservar TODAS las facturadas, borrar solo las no facturadas
      keep = facturadas
      drop = noFacturadas
      totalFacturadasIntactas += facturadas.length
      if (facturadas.length > 1) {
        // Más de una facturada con el mismo mp_payment_id — bandera para revisar
        // (CAE distintos = facturas reales distintas, NO borrar)
        skipped.push({
          mp_payment_id: mpId,
          razon: `Múltiples facturadas (${facturadas.length}) — revisar a mano`,
          rows: facturadas.map(r => ({ id: r.id, cae: r.cae, nro: r.nro_comprobante }))
        })
      }
    } else {
      // Conservar la más vieja, borrar las demás
      const sorted = [...rows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      keep = [sorted[0]]
      drop = sorted.slice(1)
    }

    if (drop.length > 0) {
      console.log(`mp_payment_id: ${mpId}`)
      console.log(`  cliente: ${rows[0].cliente} | monto: ${rows[0].monto} | total filas: ${rows.length}`)
      console.log(`  CONSERVAR (${keep.length}): ${keep.map(r => r.id.substring(0,8)).join(', ')}${facturadas.length > 0 ? ' [facturadas]' : ' [más vieja]'}`)
      console.log(`  BORRAR    (${drop.length}): ${drop.map(r => r.id.substring(0,8)).join(', ')}`)
      toDeleteIds.push(...drop.map(r => r.id))
      totalToDelete += drop.length
    }
  }

  console.log(`\n────────────────────────────────────────`)
  console.log(`Filas a borrar: ${totalToDelete}`)
  console.log(`Facturadas conservadas (intocables): ${totalFacturadasIntactas}`)
  console.log(`Grupos con >1 facturada (revisar a mano): ${skipped.length}`)
  if (skipped.length > 0) {
    console.log('Detalle:')
    console.log(JSON.stringify(skipped, null, 2))
  }

  if (!APPLY) {
    console.log('\n⚠️  DRY-RUN. Para borrar de verdad: node scratch-dedupe.js --apply')
    return
  }

  if (toDeleteIds.length === 0) {
    console.log('\nNada que borrar.')
    return
  }

  console.log(`\nBorrando ${toDeleteIds.length} filas en lotes de 100...`)
  let borradas = 0
  for (let i = 0; i < toDeleteIds.length; i += 100) {
    const lote = toDeleteIds.slice(i, i + 100)
    const { error: delError } = await supabase.from('ventas').delete().in('id', lote)
    if (delError) {
      console.error(`❌ Error borrando lote ${i}:`, delError.message)
      break
    }
    borradas += lote.length
    console.log(`  lote ${Math.floor(i/100)+1}: ${lote.length} borradas (${borradas}/${toDeleteIds.length})`)
  }
  console.log(`\n✅ Borradas ${borradas} filas.`)
}

dedupe().catch(err => {
  console.error('Error fatal:', err)
  process.exit(1)
})
