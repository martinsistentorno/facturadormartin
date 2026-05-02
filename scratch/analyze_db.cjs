require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('ventas')
    .select('id, cliente, monto, fecha, mp_payment_id, datos_fiscales')
    .ilike('cliente', '%martin%')
    .limit(10);

  if (error) {
    console.error(error);
    return;
  }

  console.log('--- Ventas con "Martin" en el nombre ---');
  console.log(JSON.stringify(data, null, 2));

  // También buscar en la descripción de datos_fiscales
  const { data: dataDesc, error: errorDesc } = await supabase
    .from('ventas')
    .select('id, cliente, monto, fecha, datos_fiscales')
    .order('fecha', { ascending: false })
    .limit(10);
    
  console.log('--- Últimas 10 ventas (para ver estructura de MP) ---');
  console.log(JSON.stringify(dataDesc, null, 2));
}

check();
