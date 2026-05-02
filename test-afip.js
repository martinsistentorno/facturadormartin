import { getAfipRazonSocial } from './api/lib/afip-helper.js'
import dotenv from 'dotenv'

dotenv.config()
process.env.AFIP_PRODUCTION = 'true'
process.env.AFIP_SANDBOX = 'false'

async function lookup() {
  const r1 = await getAfipRazonSocial('20354302684')
  console.log("20354302684 :", r1)

  const r2 = await getAfipRazonSocial('20337950117')
  console.log("20337950117 :", r2)
}

lookup().catch(console.error)
