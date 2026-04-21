import { getAfipRazonSocial } from './api/lib/afip-helper.js'
import dotenv from 'dotenv'

dotenv.config()

async function test() {
  const data = await getAfipRazonSocial(process.env.AFIP_CUIT)
  console.log(data)
}

test()
