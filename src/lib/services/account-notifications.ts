import { db } from "@/lib/db";
import { sendAccountNotificationEmail } from "@/lib/email";
import { getUserProfileImage } from "@/lib/profile-image";
import { securityLog } from "@/lib/security/audit-log";

/** A saved inbox entry survives an unavailable mail provider. Repeat actions reuse it. */
export async function notifyAccount({userId, kind, title, href, dedupeKey, requesterId, businessId}: {
  userId:string; kind:"NEW_FOLLOWER" | "SERVICE_REQUEST"; title:string; href:string; dedupeKey:string; requesterId?:string; businessId?:string;
}) {
  try {
    const notification = await db.notification.upsert({
      where: {dedupeKey}, update: {}, create: {userId,kind,title,href,dedupeKey},
      select: {id:true,emailSentAt:true,user:{select:{email:true}}}
    });
    if(notification.emailSentAt || !notification.user.email) return;
    let identities = {};
    if (kind === "SERVICE_REQUEST" && requesterId && businessId) {
      const [requester, business] = await Promise.all([
        db.user.findUnique({where:{id:requesterId},select:{id:true,name:true,image:true,avatar:{select:{updatedAt:true}}}}),
        db.vendorProfile.findUnique({where:{id:businessId},select:{name:true,logoUrl:true}})
      ]);
      if (requester && business) identities = {requester:{name:requester.name || "Guest",image:getUserProfileImage(requester)},business:{name:business.name,image:business.logoUrl}};
    }
    const result = await sendAccountNotificationEmail({to:notification.user.email,title,path:href,kind,...identities});
    if(result.ok) await db.notification.updateMany({where:{id:notification.id,emailSentAt:null},data:{emailSentAt:new Date()}});
  } catch(error) {
    // Notification/email failures must not undo a completed follow or service request.
    securityLog("account_notification_failed",{kind,error:error instanceof Error ? error.message : "Unknown notification error"});
  }
}
