import { getValidAccessToken } from './api/_lib/meli-token.js';

async function run() {
  const token = await getValidAccessToken();
  console.log('Token obtenido');
  
  const searchUrl = `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=10&status=approved`;
  const searchRes = await fetch(searchUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!searchRes.ok) {
    console.error('Error fetching payments:', await searchRes.text());
    return;
  }

  const searchData = await searchRes.json();
  const payments = searchData.results || [];
  
  for (const p of payments) {
    console.log(`\n--- Payment ${p.id} ---`);
    console.log(`Type: ${p.payment_type_id} | Method: ${p.payment_method_id} | Amount: ${p.transaction_amount}`);
    console.log(`Description: ${p.description}`);
    console.log(`Payer ID: ${p.payer?.id} | Email: ${p.payer?.email} | Name: ${p.payer?.first_name} ${p.payer?.last_name}`);
    console.log(`Payer Identification:`, p.payer?.identification);
    console.log(`Point of Interaction:`, JSON.stringify(p.point_of_interaction?.business_info, null, 2));
    console.log(`Transaction details:`, JSON.stringify(p.transaction_details, null, 2));
  }
}

run().catch(console.error);
