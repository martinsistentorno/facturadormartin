import { getValidAccessToken } from './api/_lib/meli-token.js';

async function run() {
  const token = await getValidAccessToken();
  const paymentId = '156404723521';
  
  const searchUrl = `https://api.mercadopago.com/v1/payments/${paymentId}`;
  const searchRes = await fetch(searchUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!searchRes.ok) {
    console.error('Error fetching payment:', await searchRes.text());
    return;
  }

  const p = await searchRes.json();
  console.log(JSON.stringify(p, null, 2));
}

run().catch(console.error);
