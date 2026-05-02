import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const anonClient = createClient(supabaseUrl, supabaseAnonKey)
const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

async function testDeletes() {
  console.log('=== TEST SUPABASE PERMISSIONS ===')

  // 1. Create a quick test row using service client
  const { data: insertData, error: insertError } = await serviceClient
    .from('ventas')
    .insert([{ monto: 1, cliente: 'TEST_DELETE', status: 'borrada' }])
    .select()

  if (insertError) {
    return console.error('Failed to create test row:', insertError)
  }
  const testId = insertData[0].id
  console.log('Test row created:', testId)

  // 2. Try to update it to "pendiente" using ANON client (simulating Restore)
  console.log('-> Testing RESTORE (anon client)...')
  const { data: updateData, error: updateError } = await anonClient
    .from('ventas')
    .update({ status: 'pendiente' })
    .eq('id', testId)
    .select()
  
  if (updateError) {
    console.log('❌ RESTORE ERROR:', updateError.message)
  } else {
    console.log('RESTORE RESULT:', updateData.length === 0 ? '❌ RLS Blocked Update (Returned 0 rows)' : '✅ OK')
  }

  // 3. Try to hard delete it using ANON client
  console.log('-> Testing DELETE (anon client)...')
  const { data: deleteData, error: deleteError } = await anonClient
    .from('ventas')
    .delete()
    .eq('id', testId)
    .select()
  
  if (deleteError) {
    console.log('❌ DELETE ERROR:', deleteError.message)
  } else {
    console.log('DELETE RESULT:', deleteData.length === 0 ? '❌ RLS Blocked Delete (Returned 0 rows)' : '✅ OK')
  }

  // Cleanup with service client
  await serviceClient.from('ventas').delete().eq('id', testId)
  console.log('Cleanup completed.')
}

testDeletes()
