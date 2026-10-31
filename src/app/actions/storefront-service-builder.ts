"use server";
import {auth} from '@/auth';
import {db} from '@/lib/db';
import {businessManagerWhere} from '@/lib/businesses';
import {CategoryAudience} from '@prisma/client';
export async function loadStorefrontServiceBuilder(businessId:string,previewOnly=false){
 const session=await auth();
 if(!session?.user?.id)throw new Error('Please sign in again to add a service. Your storefront edits are still here.');
 const business=await db.vendorProfile.findFirst({where:{id:businessId,...businessManagerWhere(session.user.id,session.user.role)},select:{id:true}});
 if(!business&&!previewOnly)throw new Error('You do not have access to this business.');
 const [categories,eventCategories,services]=await Promise.all([
 db.category.findMany({where:{audience:CategoryAudience.VENDOR},select:{id:true,name:true},orderBy:{name:'asc'}}),
 db.category.findMany({where:{audience:CategoryAudience.BUYER},select:{id:true,name:true},orderBy:{name:'asc'}}),
 previewOnly ? Promise.resolve([]) : db.offering.findMany({where:{vendorId:businessId},select:{id:true,active:true,basePriceCents:true,categoryId:true,description:true,messageForPricing:true,photos:true,title:true,turnaroundDays:true}})
 ]);
 return {categories,eventCategories,services:services.map(service=>({...service,featured:false}))};
}
