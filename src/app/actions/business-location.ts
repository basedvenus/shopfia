"use server";
import {z} from "zod";
import {auth} from "@/auth";
import {db} from "@/lib/db";
import {businessManagerWhere,storefrontPath} from "@/lib/businesses";
import {revalidatePath} from "next/cache";
import {checkServerActionRateLimit} from "@/lib/security/request";
import type {Prisma} from "@prisma/client";
const schema=z.object({businessId:z.string().min(1),city:z.string().trim().min(2).max(80),state:z.string().max(40),formattedAddress:z.string().max(240),googlePlaceId:z.string().max(180),lat:z.number().min(-90).max(90).nullable(),lng:z.number().min(-180).max(180).nullable(),radius:z.number().int().min(1).max(200),serviceAreaNotes:z.string().max(500)});
export async function updateBusinessLocationAction(input:unknown) {
 const session=await auth();if(!session?.user?.id)return {ok:false,error:"Sign in to update your business."};
 const rate=await checkServerActionRateLimit([{key:`business-location:${session.user.id}`,limit:20,intervalMs:60000}]);if(!rate.ok)return {ok:false,error:"Please wait a moment before saving again."};
 const result=schema.safeParse(input);if(!result.success)return {ok:false,error:result.error.issues[0].message};
 const value=result.data;
 const business=await db.vendorProfile.findFirst({where:{id:value.businessId,...businessManagerWhere(session.user.id,session.user.role)},select:{id:true,slug:true,storefrontDraftJson:true,city:true,state:true}});
 if(!business)return {ok:false,error:"This business could not be found for your account."};
 if((value.city!==business.city||value.state!==(business.state??""))&&(!value.googlePlaceId||value.lat===null||value.lng===null))return {ok:false,error:"Select your city from the location suggestions."};
 const draft=business.storefrontDraftJson;
 await db.vendorProfile.update({where:{id:business.id},data:{city:value.city,state:value.state,formattedAddress:value.formattedAddress||null,googlePlaceId:value.googlePlaceId||null,locationLat:value.lat,locationLng:value.lng,serviceRadiusMiles:value.radius,serviceAreaNotes:value.serviceAreaNotes||null,...(draft&&typeof draft==='object'&&!Array.isArray(draft)?{storefrontDraftJson:{...draft,city:value.city,state:value.state,serviceAreaNotes:value.serviceAreaNotes} as Prisma.InputJsonObject}:{})}});
 for(const path of ['/vendor/dashboard',`/vendor/business/${business.slug}`,`/vendor/business/${business.slug}/storefront`,`/vendor/profile/${business.slug}`,storefrontPath(business.slug),'/explore'])revalidatePath(path);
 return {ok:true};
}
