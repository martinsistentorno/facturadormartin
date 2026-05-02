import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanGhostRecords() {
  console.log('Buscando registros con status o cliente "procesando"...');
  
  const { data, error } = await supabase
    .from('ventas')
    .select('id, cliente, status, monto');
    
  if (error) {
    console.error('Error buscando:', error);
    return;
  }
  
  const toDelete = data.filter(v => 
    (v.cliente && v.cliente.toUpperCase().includes('PROCESANDO')) || 
    (v.status && v.status.toLowerCase() === 'procesando')
  );
  
  if (toDelete.length === 0) {
    console.log('No se encontraron registros. Total registros en BD:', data.length);
    return;
  }
  
  console.log(`Se encontraron ${toDelete.length} registros:`, toDelete);
  
  const idsToDelete = toDelete.map(v => v.id);
  
  const { error: deleteError } = await supabase
    .from('ventas')
    .delete()
    .in('id', idsToDelete);
    
  if (deleteError) {
    console.error('Error eliminando:', deleteError);
  } else {
    console.log('✅ Registros eliminados exitosamente.');
  }
}

cleanGhostRecords();
