import dotenv from 'dotenv';
dotenv.config();

import { getValidAccessToken } from './api/lib/meli-token.js';

async function main() {
  const token = await getValidAccessToken();
  const res = await fetch('https://api.mercadopago.com/v1/payments/155049614593', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(JSON.stringify({ order: data.order }, null, 2));
}
main();
