import { readFile, readdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
const market=pkg.name==='jev-skills-market';
const plugin=market?resolve(root,'plugins/jev-assistant'):root;
const skills=resolve(plugin,'skills');
const manifest=JSON.parse(await readFile(resolve(plugin,'.codex-plugin/plugin.json'),'utf8'));
assert.equal(manifest.version,pkg.version);
assert.equal(manifest.name,market?'jev-assistant':'jev-computer-use');
assert.equal(manifest.skills,'./skills/');
const names=[];
for(const dir of await readdir(skills,{withFileTypes:true})){
  if(!dir.isDirectory())continue;
  const path=resolve(skills,dir.name,'SKILL.md');
  const text=await readFile(path,'utf8');
  const header=text.match(/^---\n([\s\S]+?)\n---/);
  assert.ok(header,`Frontmatter missing: ${dir.name}`);
  assert.match(header[1],new RegExp(`^name: ${dir.name}$`,'m'));
  assert.match(header[1],/^description: .+/m);
  assert.ok(!text.includes('[TODO:'),`Unfinished scaffold: ${dir.name}`);
  await access(resolve(skills,dir.name,'LICENSE'));
  for(const match of text.matchAll(/\]\(([^)]+)\)/g)){
    const link=match[1];
    if(/^(https?:|#)/.test(link))continue;
    const target=resolve(dirname(path),link.split('#')[0]);
    assert.ok(!relative(resolve(skills,dir.name),target).startsWith('..'),`Reference escapes skill: ${link}`);
    await access(target);
  }
  names.push(dir.name);
}
const lock=JSON.parse(await readFile(resolve(root,'upstream.lock.json'),'utf8'));
assert.match(lock.revision,/^[0-9a-f]{40}$/);
for(const [file,sha] of Object.entries(lock.importedFiles)){
  assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),sha,`Imported source changed: ${file}`);
}
if(market){
  const {validateCatalog}=await import('../plugins/jev-assistant/skills/jev-assistant/scripts/catalog.mjs');
  const catalog=validateCatalog(JSON.parse(await readFile(resolve(skills,'jev-assistant/references/catalog.json'),'utf8')));
  for(const entry of catalog.skills){
    if(entry.distribution==='bundled'){
      assert.ok(names.includes(entry.id));
      assert.equal(entry.path,`plugins/jev-assistant/skills/${entry.id}`);
      await access(resolve(root,entry.path,'SKILL.md'));
    }else{
      assert.notEqual(entry.repository,'kangshifu1/jev-skills-market');
      assert.ok(!names.includes(entry.id),'External runtime must remain independent');
    }
  }
  const marketplace=JSON.parse(await readFile(resolve(root,'.agents/plugins/marketplace.json'),'utf8'));
  assert.equal(marketplace.name,'jev-skills-market');
  for(const entry of marketplace.plugins){
    assert.ok(entry.policy.installation && entry.policy.authentication && entry.category);
    assert.equal(entry.name,manifest.name);
    await access(resolve(root,entry.source.path,'.codex-plugin/plugin.json'));
  }
}
console.log(`Validated ${pkg.name} ${pkg.version}: ${names.length} skills, manifest, references and upstream checksums.`);
