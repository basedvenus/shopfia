"use server";
import {auth} from '@/auth';
import {validLanguage,translate} from '@/lib/language';
import {persistUserLanguage,writeLanguageCookie} from '@/lib/language-preference';
import {revalidatePath} from 'next/cache';
import {checkServerActionRateLimit} from '@/lib/security/request';
export async function updatePreferredLanguageAction(language:unknown){
 if(!validLanguage(language))return {ok:false,error:'Choose English or Español.'};
 const session=await auth();
 const rate=await checkServerActionRateLimit([{key:`preferred-language:${session?.user?.id??'ip:{ip}'}`,limit:30,intervalMs:60000}]);
 if(!rate.ok)return {ok:false,error:'Please wait a moment before trying again.'};
 try {
  if(session?.user?.id)await persistUserLanguage(session.user.id,language);else await writeLanguageCookie(language);
  revalidatePath('/','layout');return {ok:true,message:translate(language,'Language saved.')};
 }catch{return {ok:false,error:'Your language could not be saved. Please try again.'};}
}
