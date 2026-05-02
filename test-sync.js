import syncHandler from './api/sync-payments.js'

async function runSync() {
  console.log('🚀 Iniciando Sincronización Local (sin límite de tiempo)...')
  
  const mockReq = { method: 'GET' }
  const mockRes = {
    setHeader: () => {},
    status: (code) => ({
      json: (data) => console.log('✅ Finalizado con código', code, ':', JSON.stringify(data, null, 2)),
      end: () => console.log('Finalizado sin data')
    })
  }

  await syncHandler(mockReq, mockRes)
  console.log('🎉 Terminado.')
}

runSync().catch(console.error)
