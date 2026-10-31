import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
describe('service-area Google map',()=>{
 it('permits the map iframe and Google redirect without allowing arbitrary frames',()=>{
  const config=readFileSync(new URL('../../next.config.mjs',import.meta.url),'utf8');
  const directive=config.match(/"frame-src ([^"]+)"/)![1].split(' ');
  expect(directive).toContain('https://maps.google.com');
  expect(directive).toContain('https://www.google.com');
  expect(directive).not.toContain('*');
  expect(directive).not.toContain('https:');
 });
});
