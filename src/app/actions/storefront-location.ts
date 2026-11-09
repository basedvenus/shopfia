"use server";
import {auth} from "@/auth";
import {db} from "@/lib/db";
import {businessManagerWhere} from "@/lib/businesses";
export async function loadStorefrontLocation(businessId:string){
 const session=await auth();if(!session?.user?.id)throw new Error("Sign in to edit service areas.");
 const business=await db.vendorProfile.findFirst({where:{id:businessId,...businessManagerWhere(session.user.id,session.user.role)},select:{id:true,city:true,state:true,formattedAddress:true,googlePlaceId:true,locationLat:true,locationLng:true,serviceRadiusMiles:true,serviceAreaNotes:true}});
 if(!business)throw new Error("This business could not be found for your account.");
 return business;
}
