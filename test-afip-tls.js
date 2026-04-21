import https from 'https';
import crypto from 'crypto';

function testAfip() {
  const options = {
    hostname: 'servicios1.afip.gov.ar',
    port: 443,
    path: '/wsfev1/service.asmx',
    method: 'GET',
    // ciphers: 'DEFAULT@SECLEVEL=0'
  };

  const req = https.request(options, (res) => {
    console.log('Status:', res.statusCode);
  });

  req.on('error', (e) => {
    console.error('Request Error:', e);
  });
  req.end();
}

testAfip();
