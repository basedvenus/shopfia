import {db} from "@/lib/db";
/** Average first vendor reply in the 100 most recent conversations that received a reply. No message content is returned. */
export async function getVendorAverageResponseSeconds(vendorProfileId:string):Promise<number|null>{
 const rows=await db.$queryRaw<{seconds:number|null}[]>`
 SELECT AVG(EXTRACT(EPOCH FROM (reply."createdAt"-request."createdAt")))::double precision AS seconds
 FROM (SELECT id,"buyerId" FROM "Conversation" WHERE "vendorProfileId"=${vendorProfileId} ORDER BY "createdAt" DESC LIMIT 100) c
 JOIN LATERAL (SELECT "createdAt" FROM "Message" WHERE "conversationId"=c.id AND "senderId"=c."buyerId" ORDER BY "createdAt" ASC LIMIT 1) request ON true
 JOIN LATERAL (SELECT "createdAt" FROM "Message" WHERE "conversationId"=c.id AND "senderId"<>c."buyerId" AND "createdAt">=request."createdAt" ORDER BY "createdAt" ASC LIMIT 1) reply ON true`;
 return rows[0]?.seconds??null;
}
