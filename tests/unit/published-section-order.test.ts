import React from 'react';
import { create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/components/vendor/storefront-fonts',()=>({default:({children}:{children:React.ReactNode})=>children}));
vi.mock('@/components/vendor/storefront-section-size',()=>({StorefrontSectionSize:({children}:{children:React.ReactNode})=>children}));
import { PublishedStorefrontSurface } from '@/components/vendor/published-storefront-surface';
import { sectionRows } from '@/lib/storefront-section-layout';

describe('published storefront section order',()=>{
 it.each([
  ['final-quote','portfolio','hero','reviews','effects'],
  ['effects','reviews','final-quote','hero','portfolio'],
  ['portfolio','hero','effects','reviews','final-quote'],
 ])('renders saved order regardless of JSX source order (%s first)',(...order)=>{
  const layout={reviews:{beside:'effects'}};
  const children=['hero','portfolio','reviews','effects','final-quote'].map(id=>React.createElement('section',{key:id,id,style:{order:order.indexOf(id)}},id));
  const view=create(React.createElement(PublishedStorefrontSurface,{template:null,style:{},className:'',sectionOrder:order,sectionLayout:layout,children}));
  expect(view.root.findAll(node=>Boolean(node.props['data-public-section'])).map(node=>node.props['data-public-section'])).toEqual(order);
  const rows=view.root.findAll(node=>node.props.className==='storefront-section-row');
  expect(rows.map(row=>row.findAll(node=>Boolean(node.props['data-public-section'])).map(node=>node.props['data-public-section']))).toEqual(sectionRows(order,layout));
 });
});
