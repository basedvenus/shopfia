import {describe,it,expect} from 'vitest';
import {placeSection,sectionRows} from '@/lib/storefront-section-layout';
import {bookingWithDesign,DEFAULT_STOREFRONT_DESIGN,readStorefrontDesign,storefrontDesignSchema} from '@/lib/storefront-design';
describe('storefront section layout',()=>{
 const order=['hero','effects','about','final-quote','reviews'];
 it('places a section beside another without losing content or height',()=>{
  const next=placeSection(order,{effects:{height:500}},'effects','about','right');
  expect(next.order).toEqual(['hero','about','effects','final-quote','reviews']);
  expect(sectionRows(next.order,next.layout)).toEqual([['hero'],['about','effects'],['final-quote'],['reviews']]);
  expect(next.layout.effects.height).toBe(500);
 });
 it('breaks old pairs when moving into another row and never creates three columns',()=>{
  const first=placeSection(order,{},'effects','about','right');
  const next=placeSection(first.order,first.layout,'reviews','about','left');
  expect(sectionRows(next.order,next.layout)).toEqual([['hero'],['reviews','about'],['effects'],['final-quote']]);
  const stacked=placeSection(next.order,next.layout,'about','hero','above');
  expect(stacked.order[0]).toBe('about');
  expect(sectionRows(stacked.order,stacked.layout).every(row=>row.length===1)).toBe(true);
 });
 it('falls back to full rows when a paired section is hidden or moved away',()=>{
  expect(sectionRows(['hero','effects','reviews'],{effects:{beside:'about'}})).toEqual([['hero'],['effects'],['reviews']]);
 });
 it('round trips layout settings and rejects invalid sizes and section identifiers',()=>{
  const design={...DEFAULT_STOREFRONT_DESIGN,sectionLayout:{effects:{height:560,beside:'about'}}};
  expect(readStorefrontDesign(bookingWithDesign({},storefrontDesignSchema.parse(design))).sectionLayout).toEqual(design.sectionLayout);
  for(const sectionLayout of [{effects:{height:-1}},{effects:{height:1201}},{effects:{beside:'unknown'}},{unknown:{height:200}}])expect(storefrontDesignSchema.safeParse({...DEFAULT_STOREFRONT_DESIGN,sectionLayout}).success).toBe(false);
 });
});
