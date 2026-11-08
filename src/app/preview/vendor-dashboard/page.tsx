import {notFound} from "next/navigation";
import {VendorProfileStatus} from "@prisma/client";
import {BusinessDashboardView} from "@/components/vendor/business-dashboard-view";
import type {DashboardBusiness} from "@/lib/vendor-dashboard-select";
export default async function VendorDashboardPreview({searchParams}:{searchParams?:Promise<{name?:string;slug?:string}>}){
 if(process.env.NODE_ENV!=="development")notFound();
 const query=await searchParams;
 const business:DashboardBusiness={
  id:"preview-business",name:query?.name?.slice(0,80)||"Your business name",slug:query?.slug||"your-business",status:VendorProfileStatus.CLAIMED,
  availabilityNotes:null,bio:null,city:"Los Angeles",state:"CA",formattedAddress:"Los Angeles, CA",googlePlaceId:null,locationLat:34.0522,locationLng:-118.2437,
  coverPhoto:null,instagramUrl:null,logoCrop:null,logoUrl:null,photos:[],serviceAreaNotes:null,serviceRadiusMiles:25,
  stripeChargesEnabled:false,stripeOnboardingComplete:false,stripePayoutsEnabled:false,tiktokUrl:null,website:null,
  categories:[],verificationDocuments:[],inquiries:[],offerings:[],orders:[],quoteRequests:[]
 };
 return <BusinessDashboardView business={business} stats={{activeServices:0,openRequests:0,activeBookings:0,revenueCents:0}} welcome editorHref="/preview/storefront-editor" />;
}
