import {createElement,useState} from 'react';
import {act,create} from 'react-test-renderer';
import {afterEach,expect,it,vi} from 'vitest';
import {storefrontDesignSchema,DEFAULT_STOREFRONT_DESIGN} from '@/lib/storefront-design';
import {STOREFRONT_TEMPLATES,type StorefrontTemplate} from '@/lib/editor-preview/storefront-template-library';
import {stickerScale} from '@/lib/storefront-stickers';
import {StickerEditor,TemplateSticker,StickersPanel,StickerLayer} from '@/components/editor-preview/storefront-stickers';
afterEach(()=>vi.unstubAllGlobals());
const template=STOREFRONT_TEMPLATES.find(item=>item.illustration==='balloons')!;
it('preserves stickers and deleted template illustrations in saved and published designs',()=>{
 const design=storefrontDesignSchema.parse({...DEFAULT_STOREFRONT_DESIGN,template:{...template,illustrationHidden:true,illustrationSize:120,stickers:[{id:'cake',kind:'cake',x:10,y:20,size:15}]}});
 expect(design.template).toMatchObject({illustrationHidden:true,illustrationSize:120,stickers:[{kind:'cake',size:15}]});
 expect(storefrontDesignSchema.safeParse({...design,template:{...design.template,stickers:[{id:'bad',kind:'cake',x:101,y:0,size:90}]}}).success).toBe(false);
});
it.each([[-1,-1],[1,-1],[-1,1],[1,1]])('scales sticker corner %s,%s diagonally', (sx,sy)=>{
 expect(stickerScale(80,80,20*sx,20*sy,sx,sy)).toBe(1.25);
 expect(stickerScale(80,80,-20*sx,-20*sy,sx,sy)).toBe(.75);
});
it('resizes, deletes, and restores the template sticker without losing its artwork',()=>{
 vi.stubGlobal('document',new EventTarget());vi.stubGlobal('window',new EventTarget());let saved=template;
 function Harness(){const [value,setValue]=useState(template);saved=value;return createElement(StickerEditor,{template:value,onChange:setValue,children:createElement('div',{},createElement(TemplateSticker,{kind:'balloons',template:value}),createElement(StickersPanel,{template:value,onChange:setValue}))});}
 let view:ReturnType<typeof create>;act(()=>{view=create(createElement(Harness));});
 act(()=>view!.root.findByProps({'data-sticker':'template-illustration'}).props.onKeyDown({key:'Enter',preventDefault(){}}));
 act(()=>view!.root.findByProps({'aria-label':'Resize Balloons sticker 1,1'}).props.onKeyDown({key:'ArrowRight',preventDefault(){},stopPropagation(){}}));
 expect(saved.illustrationSize).toBe(84);
 act(()=>view!.root.findByProps({'aria-label':'Delete sticker'}).props.onClick({stopPropagation(){}}));
 expect(saved.illustrationHidden).toBe(true);expect(view!.root.findAllByProps({'data-sticker':'template-illustration'})).toHaveLength(0);
 act(()=>view!.root.findAllByType('button').find(node=>node.children.includes('Restore template sticker'))!.props.onClick());
 expect(saved.illustration).toBe('balloons');expect(saved.illustrationHidden).toBe(false);act(()=>view!.unmount());
});
it('adds a new library sticker and renders public stickers without editing controls',()=>{
 const change=vi.fn();vi.stubGlobal('crypto',{randomUUID:()=> 'new-sticker'});let view:ReturnType<typeof create>;
 act(()=>{view=create(createElement(StickersPanel,{template,onChange:change}));});
 act(()=>view!.root.findByProps({'aria-label':'Add Cake sticker'}).props.onClick());
 const changed:StorefrontTemplate=change.mock.calls[0][0];expect(changed.stickers?.[0]).toMatchObject({id:'new-sticker',kind:'cake'});
 act(()=>view!.update(createElement(StickerLayer,{template:changed})));expect(view!.root.findAllByType('button')).toHaveLength(0);act(()=>view!.unmount());
});
