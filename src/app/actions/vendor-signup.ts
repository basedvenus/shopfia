"use server";
import { CategoryAudience, Prisma, UserRole, VendorProfileStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { vendorOnboardingSchema } from "@/lib/validators/vendor";
import { isReservedStorefrontSlug, storefrontUrl } from "@/lib/businesses";
import { parseImageCrop } from "@/lib/image-crop";
import { checkServerActionRateLimit } from "@/lib/security/request";

export async function createVendorSignupAction(form: FormData) {
  const session = await auth();
  if (!session?.user?.id) return {ok:false as const,error:"Please sign in again."};
  const userId=session.user.id;
  const user=await db.user.findUnique({where:{id:userId},select:{name:true,username:true}});
  if (!user?.name?.trim() || !user.username?.trim()) return {ok:false as const,error:"Complete your personal username and display name first."};
  const rate=await checkServerActionRateLimit([{key:`vendor-signup:user:${userId}`,limit:5,intervalMs:60_000}]);
  if (!rate.ok) return {ok:false as const,error:"Please wait a minute before trying again."};
  const username=String(form.get("storefrontUsername")??"").trim().toLowerCase();
  const parsed=vendorOnboardingSchema.safeParse({name:String(form.get("storefrontName")??"").trim(),username,slug:username,city:form.get("locationCity"),state:form.get("locationState")||undefined,formattedAddress:form.get("formattedAddress")||undefined,locationLat:form.get("locationLat"),locationLng:form.get("locationLng"),googlePlaceId:form.get("googlePlaceId")||undefined,logoUrl:form.get("logoUrl")||undefined,categoryIds:[...new Set(form.getAll("categoryIds").map(String))],photoUrls:[]});
  if (!parsed.success) return {ok:false as const,error:parsed.error.issues[0].message};
  if(isReservedStorefrontSlug(username)) return {ok:false as const,error:"That business username is reserved."};
  const data=parsed.data;
  const valid=await db.category.count({where:{id:{in:data.categoryIds},audience:CategoryAudience.VENDOR}});
  if(valid!==data.categoryIds.length) return {ok:false as const,error:"Choose valid business categories."};
  try {
    const business=await db.$transaction(async tx=>{
      // Serialize creation for this account so retries cannot create duplicate businesses.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const conflict=await tx.vendorProfile.findFirst({where:{OR:[{slug:username},{username}]},select:{id:true,slug:true,userId:true,managers:{where:{userId,role:"OWNER"},select:{userId:true}}}});
      if(conflict) {
        if(conflict.userId===userId || conflict.managers.length) return conflict;
        throw new Error("USERNAME_TAKEN");
      }
      const primary=await tx.vendorProfile.findUnique({where:{userId},select:{id:true}});
      const created=await tx.vendorProfile.create({data:{userId:primary?null:userId,name:data.name,slug:username,username,status:VendorProfileStatus.CLAIMED,claimedAt:new Date(),city:data.city,state:data.state??null,formattedAddress:data.formattedAddress??null,locationLat:data.locationLat??null,locationLng:data.locationLng??null,googlePlaceId:data.googlePlaceId??null,logoUrl:data.logoUrl??null,logoCrop:parseImageCrop(form.get("logoUrlCrop"))??Prisma.JsonNull,photos:[],categories:{create:data.categoryIds.map(categoryId=>({categoryId}))},managers:{create:{userId,role:"OWNER"}}},select:{id:true,slug:true}});
      await tx.$executeRaw`INSERT INTO "VendorIdentityChange" ("vendorId", "changedAt") VALUES (${created.id}, NOW())`;
      await tx.user.updateMany({where:{id:userId,role:UserRole.BUYER},data:{role:UserRole.VENDOR}});
      return created;
    });
    revalidatePath("/", "layout");
    revalidatePath(`/vendor/business/${business.slug}`);
    return {ok:true as const,slug:business.slug,url:storefrontUrl(business.slug)};
  } catch(error) {
    if(error instanceof Error && error.message==="USERNAME_TAKEN" || error instanceof Prisma.PrismaClientKnownRequestError && error.code==="P2002") return {ok:false as const,error:"That business username was just taken. Please choose another."};
    return {ok:false as const,error:"Your business could not be saved. Please try again."};
  }
}
