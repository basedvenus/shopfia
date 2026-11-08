"use client";
import {useId,useState} from 'react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {useRouter} from 'next/navigation';
import {updatePreferredLanguageAction} from '@/app/actions/language';
import {normalizeLanguage,type Language} from '@/lib/language';
import {useLanguage} from './language-provider';
export function LanguagePreferenceField({value,onChange}:{value?:Language;onChange?:(value:Language)=>void}){
 const {language,t}=useLanguage();
 const id=useId();
 return <div className="grid gap-2 text-sm font-medium">
  <label htmlFor={id}>Preferred language / Idioma preferido</label>
  <Select name="preferredLanguage" value={value} defaultValue={value===undefined?language:undefined} onValueChange={next=>onChange?.(normalizeLanguage(next))}>
   <SelectTrigger id={id} aria-describedby={`${id}-help`} className="rounded-2xl border-[#e3e3e3] bg-[#f3f3f3] font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary"><SelectValue /></SelectTrigger>
   <SelectContent position="popper" sideOffset={6} className="w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border-[#e3e3e3] bg-[#f3f3f3] p-1.5 shadow-lg">
    <SelectItem value="en" className="rounded-xl data-[highlighted]:bg-[#e5e5e5] data-[state=checked]:bg-[#e9e9e9]">English</SelectItem>
    <SelectItem value="es" className="rounded-xl data-[highlighted]:bg-[#e5e5e5] data-[state=checked]:bg-[#e9e9e9]">Español</SelectItem>
   </SelectContent>
  </Select>
  <span id={`${id}-help`} className="text-xs font-normal text-muted-foreground">{t('Choose the language you prefer. You can change it anytime in Settings.')}</span>
 </div>;
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
