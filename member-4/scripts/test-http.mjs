import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://localhost:3011';
const checks=[
 ['/api/business',{},401],['/api/auth',{},401],['/api/test-db',{},401],
 ...['me','catalog','slots','analytics','partner/inbox','admin/catalog','businesses/5/roadmap','businesses/5/documents'].map(path=>['/api/platform/'+path,{},401]),
 ['/api/platform/identity/mock',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"consent":true}'},401],
 ['/api/platform/catalog',{headers:{Cookie:'sb-cxyotoxczbhgdciuzcjs-auth-token=forged'}},401],
 ['/api/platform/location',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.org'},body:'{}'},403],
 ['/api/platform/location',{method:'POST',body:'test'},415],
 ['/',{},200],['/backend',{},200]
];
for(const [path,options,expected] of checks){const response=await fetch(base+path,options);assert.equal(response.status,expected,`${path}: expected ${expected}, got ${response.status}`);if(path.startsWith('/api/'))assert.match(response.headers.get('cache-control')||'',/no-store/);}
console.log(`PASS: ${checks.length} HTTP checks for private routes, forged session, origin, content type and demo pages.`);
