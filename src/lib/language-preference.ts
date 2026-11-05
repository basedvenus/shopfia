import {cookies} from 'next/headers';
import {db} from '@/lib/db';
import {LANGUAGE_COOKIE,normalizeLanguage,type Language} from './language';
export async function readUserLanguage(userId:string):Promise<Language|null>{
 try {const users=await db.$queryRaw<Array<{preferredLanguage:string}>>`SELECT "preferredLanguage" FROM "User" WHERE "id" = ${userId} LIMIT 1`;return users[0]?normalizeLanguage(users[0].preferredLanguage):null;}catch{return null;}
}
export async function writeLanguageCookie(language:Language){(await cookies()).set(LANGUAGE_COOKIE,language,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*24*365});}
export async function persistUserLanguage(userId:string,language:Language){
 // Keep this additive preference independent of the generated client's version during rollout.
 const updated=await db.$executeRaw`UPDATE "User" SET "preferredLanguage" = ${language}, "updatedAt" = NOW() WHERE "id" = ${userId}`;
 if(updated!==1)throw new Error("Account could not be found.");
 await writeLanguageCookie(language);
}
