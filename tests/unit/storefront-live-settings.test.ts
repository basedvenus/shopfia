import {describe,it,expect} from 'vitest';
import {DEFAULT_STOREFRONT_DESIGN,storefrontDesignSchema,bookingWithDesign,readStorefrontDesign} from '@/lib/storefront-design';
import {STOREFRONT_TEMPLATES} from '@/lib/storefront-template-library';
describe('live storefront settings',()=>{
 it('retains gallery, independent artwork, fonts and social switches after publishing',()=>{
 const design=storefrontDesignSchema.parse({...DEFAULT_STOREFRONT_DESIGN,headingFamily:STOREFRONT_TEMPLATES[0].headingFamily,bodyFamily:STOREFRONT_TEMPLATES[2].bodyFamily,subheadingFamily:STOREFRONT_TEMPLATES[1].headingFamily,aboutPhotos:['/api/vendor-media/one','/api/vendor-media/two'],aboutPhotoLayout:'cascade',effectImage:'/api/vendor-media/product',effectPresentation:'spin',effectWord:'Florals',depth:'floating',socialVisibility:{instagram:false,tiktok:true}});
 expect(readStorefrontDesign(bookingWithDesign({deposit:'Existing deposit'},design))).toEqual(design);
 expect(bookingWithDesign({deposit:'Existing deposit'},design)).toMatchObject({deposit:'Existing deposit'});
 });
 it('rejects temporary image payloads and unregistered font names',()=>{
 expect(storefrontDesignSchema.safeParse({...DEFAULT_STOREFRONT_DESIGN,effectImage:'data:image/png;base64,abc'}).success).toBe(false);
 expect(storefrontDesignSchema.safeParse({...DEFAULT_STOREFRONT_DESIGN,bodyFamily:'TemporaryUploadedFont'}).success).toBe(false);
 });
 it('prefers saved draft settings over published settings',()=>{
 const draft={...DEFAULT_STOREFRONT_DESIGN,aboutPhotoLayout:'row'};
 expect(readStorefrontDesign(bookingWithDesign({},DEFAULT_STOREFRONT_DESIGN),{design:draft}).aboutPhotoLayout).toBe('row');
 });
});
