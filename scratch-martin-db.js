import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('ventas')
    .select('*')
    .ilike('cliente', '%martin%')
    .order('fecha', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Encontrados ${data.length} registros con 'martin' en el nombre del cliente:`);
  for (const v of data) {
    console.log(`\nID: ${v.id} | Fecha: ${v.fecha} | Monto: ${v.monto} | Origen: ${v.datos_fiscales?.origen}`);
    console.log(`Cliente: ${v.cliente}`);
    console.log(`MP Payment ID: ${v.mp_payment_id}`);
    console.log(`Datos Fiscales:`, JSON.stringify(v.datos_fiscales, null, 2));
  }
}

run();
