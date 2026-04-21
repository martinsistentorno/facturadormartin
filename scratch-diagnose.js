import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase.from('ventas').select('*').order('fecha', { ascending: false }).limit(20);
  if (error) { console.error(error); return; }

  for (let v of data) {
    console.log(`Cliente: ${v.cliente.padEnd(20)} | Origen: ${(v.datos_fiscales?.origen||'').padEnd(15)} | Status: ${v.status} | ID: ${v.mp_payment_id} | Fecha: ${v.fecha} | Monto: ${v.monto}`);
  }
}
main();
