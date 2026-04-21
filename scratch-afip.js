import { getAfipRazonSocial } from './api/lib/afip-helper.js';

async function test() {
  // Use a known CUIT. You can replace it with any real CUIT if needed.
  const cuit = '20354302684'; // Example CUIT
  console.log(`Checking CUIT: ${cuit}`);
  
  // Actually, getAfipRazonSocial just returns razonSocial! I need to test the raw queryAfipByCuit response
}

test();
