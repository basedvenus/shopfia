"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {updatePreferredLanguageAction} from '@/app/actions/language';
import {normalizeLanguage,type Language} from '@/lib/language';
import {useLanguage} from './language-provider';
export function LanguagePreferenceField({value,onChange}:{value?:Language;onChange?:(value:Language)=>void}){
 const {language,t}=useLanguage();
 return <label className="grid gap-2 text-sm font-medium">Preferred language / Idioma preferido<select name="preferredLanguage" aria-label="Preferred language / Idioma preferido" value={value} defaultValue={value?undefined:language} onChange={event=>onChange?.(normalizeLanguage(event.target.value))} className="h-10 w-full rounded-2xl border bg-white px-3 py-2 text-sm font-normal outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary"><option value="en">English</option><option value="es">Español</option></select><span className="text-xs font-normal text-muted-foreground">{t('Choose the language you prefer. You can change it anytime in Settings.')}</span></label>;
}
export function LanguagePreferenceSettings(){
 const {language,t}=useLanguage();
 const [selected,setSelected]=useState(language),[saved,setSaved]=useState(language),[pending,setPending]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const router=useRouter();
 async function saveLanguage(next:Language){
  if(pending)return;
  setSelected(next);setPending(true);setError('');setMessage('');
  try{
   const result=await updatePreferredLanguageAction(next);
   if(result.ok){setSaved(next);setMessage(result.message??'');router.refresh();}
   else{setSelected(saved);setError(result.error??'Please try again.');}
  }catch{setSelected(saved);setError('Your language could not be saved. Please try again.');}
  finally{setPending(false);}
 }
 return <div>
  <label className="flex items-center justify-between gap-3 py-2 text-sm font-medium">
   {t('Preferred language')}
   <select name="preferredLanguage" aria-label="Preferred language / Idioma preferido" value={selected} disabled={pending} onChange={event=>void saveLanguage(normalizeLanguage(event.target.value))} className="h-9 rounded-lg border bg-white px-3 text-sm disabled:opacity-60">
    <option value="en">English</option><option value="es">Español</option>
   </select>
  </label>
  <p role="status" className="sr-only">{pending?t('Saving…'):message}</p>
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 </div>;
}
