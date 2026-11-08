import {notFound} from "next/navigation";
import {StorefrontCustomizer} from "@/components/editor-preview/storefront-customizer";
import {APPROVED_STOREFRONT_SECTIONS} from "@/lib/businesses";
import type {ComponentProps} from "react";
export default function StorefrontEditorPreview(){
 if(process.env.NODE_ENV!=="development")notFound();
 const business:ComponentProps<typeof StorefrontCustomizer>["business"]={
  id:"preview-business",slug:"your-business",name:"Your business name",city:"Los Angeles",state:"CA",averageRating:0,reviewCount:0,availabilityNotes:null,bio:null,categories:[],offerings:[],photos:[],coverPhoto:null,coverPhotoCrop:null,logoUrl:null,logoCrop:null,instagramUrl:null,tiktokUrl:null,website:null,serviceAreaNotes:null,serviceRadiusMiles:25,startingPriceCents:null,
  storefrontAboutHeading:null,storefrontAboutImage:null,storefrontBookingJson:null,storefrontButtonStyle:"PILL",storefrontDraftJson:null,storefrontFaqJson:null,storefrontFeaturedOfferingIds:[],storefrontFontStyle:"MODERN",storefrontHiddenSections:[],storefrontHiddenOfferingIds:[],storefrontImageShape:"ROUNDED",storefrontInstagramFeedEnabled:false,storefrontInstagramFeedUrl:null,storefrontLayout:"PORTFOLIO_FIRST",storefrontOfferingOrder:[],storefrontPalette:"BLUSH",storefrontPoliciesJson:null,storefrontSectionLabels:null,storefrontSectionOrder:[...APPROVED_STOREFRONT_SECTIONS],storefrontTagline:null,storefrontTextTone:"AUTO"
 };
 return <StorefrontCustomizer business={business} publicUrl="https://www.shopfia.app/your-business" previewOnly initialTemplateLibraryOpen />;
}
