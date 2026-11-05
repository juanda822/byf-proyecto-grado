const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
const publicRoot = path.resolve(__dirname, '../frontend');
const absentMedia = new Set([
  '/assets/VIDEO BYF.mp4',
  '/artifacts/blog_ciclismo_evento_1790547633752.jpg',
  '/artifacts/video_fabricamos_amor_1790547605583.jpg',
  '/artifacts/uniformes_line_1790547525555.jpg',
  '/artifacts/moda_accesorios_1790547541896.jpg',
  '/artifacts/ropa_reflectiva_1790547560327.jpg',
  '/artifacts/merchandising_sublimado_1790547580797.jpg'
]);
let checks = 0;
async function run() {
  const resources = new Set();
  function collect(text, regex, source) {
    for (const match of text.matchAll(regex)) {
      const value = match[1];
      if (!value || /^(?:[a-z]+:|#|\/\/)/i.test(value)) continue;
      resources.add(decodeURI(new URL(value, `http://local${source}`).pathname));
    }
  }
  for (const page of ['index.html', 'uniformes.html', 'reflectivo.html', 'printbordados.html', 'pqrs.html']) {
    const response = await fetch(`${base}/${page}`);
    assert.equal(response.status, 200, page);
    assert.match(response.headers.get('content-type'), /text\/html/);
    collect(await response.text(), /(?:src|href)=["']([^"']+)["']/g, `/${page}`);
    checks++;
  }
  for (const entry of fs.readdirSync(path.join(publicRoot, 'css'), { recursive: true })) {
    if (!entry.endsWith('.css')) continue;
    const source = '/css/' + entry.split(path.sep).join('/');
    collect(fs.readFileSync(path.join(publicRoot, source), 'utf8'), /url\(["']?([^\s)'";]+)["']?\)/g, source);
  }
  for (const resource of resources) {
    const response = await fetch(base + encodeURI(resource));
    if (absentMedia.has(resource)) {
      assert.ok([200, 404].includes(response.status), resource);
      if (response.status === 404) console.log('MISSING MEDIA:', resource);
    } else {
      assert.equal(response.status, 200, resource);
      if (!resource.endsWith('.html')) assert.ok(!response.headers.get('content-type').includes('text/html'), resource);
    }
    await response.arrayBuffer();
    checks++;
  }
  for (const endpoint of ['products', 'products/uniformes', 'services', 'blog', 'clients', 'stats', 'newsletter', 'contact', 'health']) {
    const response = await fetch(`${base}/api/${endpoint}`);
    assert.equal(response.status, 200, endpoint);
    const data = await response.json();
    assert.ok(endpoint === 'health' ? data.status === 'online' : data.success, endpoint);
    checks++;
  }
  for (const endpoint of ['newsletter', 'contact']) {
    const response = await fetch(`${base}/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).success, false);
    checks++;
  }
  {
    const response = await fetch(`${base}/api/pqrs/estado`);
    assert.equal(response.status, 200, 'pqrs/estado');
    assert.equal((await response.json()).success, true);
    checks++;
  }
  assert.equal((await fetch(`${base}/missing-resource.png`)).status, 404);
  console.log(`PASS: ${checks + 1} checks; missing optional media listed separately.`);
}
run().catch(error => { console.error(error); process.exitCode = 1; });
