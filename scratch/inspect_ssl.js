const https = require('https');

const options = {
  hostname: 'perpustakaanahmad.my.id',
  port: 443,
  path: '/api/health',
  method: 'GET',
  rejectUnauthorized: false // so we can connect and inspect the cert
};

const req = https.request(options, (res) => {
  const cert = res.socket.getPeerCertificate();
  console.log('Certificate Details:');
  console.log('Subject:', cert.subject);
  console.log('Issuer:', cert.issuer);
  console.log('Valid From:', cert.valid_from);
  console.log('Valid To:', cert.valid_to);
  console.log('Subject Alternative Names (SANs):', cert.subjectaltname);
});

req.on('error', (e) => {
  console.error('Request Error:', e);
});

req.end();
