const Afip = require('@afipsdk/afip.js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const tls = require('tls');
const crypto = require('crypto');

// SSL Monkeypatch
const _createSecureContext = tls.createSecureContext;
tls.createSecureContext = function(options) {
  options = options || {};
  options.ciphers = 'DEFAULT@SECLEVEL=0';
  options.secureOptions = options.secureOptions | crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT;
  options.minDHSize = 512;
  return _createSecureContext.call(tls, options);
};

const tmpDir = os.tmpdir();
fs.writeFileSync(path.join(tmpDir, 'afip_cert.crt'), Buffer.from(process.env.AFIP_CERT_BASE64, 'base64').toString('utf8'));
fs.writeFileSync(path.join(tmpDir, 'afip_key.key'), Buffer.from(process.env.AFIP_KEY_BASE64, 'base64').toString('utf8'));

const afip = new Afip({
  CUIT: parseInt(process.env.AFIP_CUIT),
  res_folder: tmpDir,
  cert: 'afip_cert.crt',
  key: 'afip_key.key',
  production: true
});

async function checkVoucher4() {
  try {
    const info = await afip.ElectronicBilling.getVoucherInfo(4, 3, 11);
    console.log('--- AFIP VOUCHER 4 INFO ---');
    console.log(JSON.stringify(info, null, 2));
  } catch (err) {
    console.error('Error fetching voucher 4:', err.message);
  }
}

checkVoucher4();
