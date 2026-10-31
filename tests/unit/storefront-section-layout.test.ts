import {describe,it,expect} from 'vitest';
import {placeSection,sectionRows,resizeSectionWidth,rowColumns} from '@/lib/storefront-section-layout';
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

describe('horizontal section resizing',()=>{
 it('shrinks and expands a single section from either edge without moving the opposite edge',()=>{
  const right=resizeSectionWidth({},['about'],'about','right',-30);
  expect(right.about).toEqual({width:70,offset:0});
  const left=resizeSectionWidth(right,['about'],'about','left',20);
  expect(left.about).toEqual({width:50,offset:20});
  expect(resizeSectionWidth(left,['about'],'about','left',-20).about).toEqual({width:70,offset:0});
  expect(resizeSectionWidth(right,['about'],'about','right',30).about.width).toBe(100);
 });
 it('changes both sides of a paired row while preserving height and pairing',()=>{
  const next=resizeSectionWidth({about:{height:400},reviews:{beside:'about'}},['about','reviews'],'reviews','left',15);
  expect(next.about).toEqual({height:400,width:65,offset:0});
  expect(next.reviews).toEqual({beside:'about',width:35,offset:0});
  expect(rowColumns(['about','reviews'],next)).toBe('minmax(0,65fr) minmax(0,35fr)');
 });
 it('clamps to the page and round trips saved widths',()=>{
  const layout=resizeSectionWidth({},['about'],'about','left',200);
  expect(layout.about).toEqual({width:25,offset:75});
  const design=storefrontDesignSchema.parse({...DEFAULT_STOREFRONT_DESIGN,sectionLayout:layout});
  expect(readStorefrontDesign(bookingWithDesign({},design)).sectionLayout).toEqual(layout);
  expect(storefrontDesignSchema.safeParse({...DEFAULT_STOREFRONT_DESIGN,sectionLayout:{about:{width:80,offset:30}}}).success).toBe(false);
 });
});

 it('can return a paired section to its original full row',()=>{
  const original=['hero','effects','photos'];
  const paired=placeSection(original,{},'effects','photos','right');
  const restored=placeSection(paired.order,paired.layout,'effects','photos','above');
  expect(restored.order).toEqual(original);
  expect(sectionRows(restored.order,restored.layout)).toEqual([['hero'],['effects'],['photos']]);
 });
