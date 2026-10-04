const crypto = require('crypto');
const { webcrypto } = require('crypto');

const secret = 'fallback-secret-for-preptea-offline';
const payload = 'test@example.com:true:batch1,batch2';

// Server side
const signatureHex = crypto.createHmac('sha256', secret).update(payload).digest('hex');
console.log('Server hex:', signatureHex);

// Client side
async function verify() {
  const encoder = new TextEncoder();
  const key = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  
  const sigBytes = new Uint8Array(signatureHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  
  const isValid = await webcrypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    encoder.encode(payload)
  );
  console.log('Is Valid:', isValid);
}

verify();
