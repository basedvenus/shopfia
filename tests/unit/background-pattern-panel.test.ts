import {createElement} from 'react';
import {act,create} from 'react-test-renderer';
import {expect,it,vi} from 'vitest';
vi.mock('@/components/editor-preview/color-picker',()=>({ColorPicker:()=>null}));
vi.mock('@/components/editor-preview/text-formatting',()=>({useSelectedTextColor:()=>({})}));
import {SectionBackgroundControls} from '@/components/editor-preview/section-background-controls';
import {STOREFRONT_TEMPLATES} from '@/lib/editor-preview/storefront-template-library';
it('changes the page pattern from the color panel without modifying section patterns',async()=>{
 const change=vi.fn(),template=STOREFRONT_TEMPLATES[0];let view:ReturnType<typeof create>;
 await act(async()=>{view=create(createElement(SectionBackgroundControls,{template,section:'page-background',label:'Page background',onChange:change}));});
 act(()=>view!.root.findByProps({'aria-label':'Choose background pattern'}).props.onClick());
 act(()=>view!.root.findByProps({'aria-label':'Set background pattern to stripes'}).props.onClick());
 expect(change.mock.calls[0][0].backgroundDesign.pattern).toBe('stripes');expect(change.mock.calls[0][0].sectionDesigns).toEqual(template.sectionDesigns);
 act(()=>view!.unmount());
});
