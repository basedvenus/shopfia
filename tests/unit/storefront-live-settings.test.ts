import {sanitizeStorefrontSections} from '@/lib/businesses';
import {describe,it,expect} from 'vitest';
import {DEFAULT_STOREFRONT_DESIGN,storefrontDesignSchema,bookingWithDesign,readStorefrontDesign} from '@/lib/storefront-design';
import {STOREFRONT_TEMPLATES} from '@/lib/storefront-template-library';
describe('live storefront settings',()=>{
 it('preserves text formatting and pattern transparency through the saved design',()=>{
 const template={...STOREFRONT_TEMPLATES[0],sectionDesigns:{hero:{background:'#ffffff',ink:'#333333',pattern:'stripes',patternOpacity:.35}}};
 const design=storefrontDesignSchema.parse({...DEFAULT_STOREFRONT_DESIGN,template,textStyles:{headline:{fontFamily:STOREFRONT_TEMPLATES[0].headingFamily,fontSize:38,fontStyle:'italic',textAlign:'center',letterSpacing:2,lineHeight:1.3}}});
 const saved=readStorefrontDesign(bookingWithDesign({},design));
 expect(saved.textStyles).toEqual(design.textStyles);
 expect(saved.template?.sectionDesigns?.hero.patternOpacity).toBe(.35);
 });

 it('preserves explicit effect position and inserts a new effect after profile for older layouts',()=>{
 const legacy=sanitizeStorefrontSections(['hero','final-quote','reviews']);
 expect(legacy.slice(0,4)).toEqual(['hero','effects','final-quote','reviews']);
 const reordered=sanitizeStorefrontSections(['final-quote','hero','socials','reviews','effects']);
 expect(reordered.slice(0,5)).toEqual(['final-quote','hero','socials','reviews','effects']);
 expect(new Set(reordered).size).toBe(reordered.length);
 });

 it('migrates old section names without resetting their saved positions',()=>{
 const order=sanitizeStorefrontSections(['inquiry-form','portfolio','hero','services','effects','reviews']);
 expect(order.slice(0,6)).toEqual(['final-quote','portfolio','hero','all-services','effects','reviews']);
 expect(sanitizeStorefrontSections(order)).toEqual(order);
 });

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
