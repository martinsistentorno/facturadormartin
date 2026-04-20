import Afip from '@afipsdk/afip.js';
import 'dotenv/config'; 

const cuit = process.env.AFIP_CUIT;
const certBase64 = process.env.AFIP_CERT_BASE64;
const keyBase64 = process.env.AFIP_KEY_BASE64;

if (!certBase64) { console.log('no cert'); process.exit(1); }
const cert = Buffer.from(certBase64, 'base64').toString('utf-8');
const key = Buffer.from(keyBase64, 'base64').toString('utf-8');
// CHANGE: production: true
const afip = new Afip({ CUIT: parseInt(cuit), cert, key, production: true });

async function run() {
    try {
        const data = await afip.RegisterScopeFive.GetTaxpayerDetails(20337950117);
        console.log("SUCCESS:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.log("ERROR:", e);
    }
}
run();
