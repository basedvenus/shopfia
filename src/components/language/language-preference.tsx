"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {updatePreferredLanguageAction} from '@/app/actions/language';
import {normalizeLanguage,type Language} from '@/lib/language';
import {useLanguage} from './language-provider';
import {Button} from '@/components/ui/button';
export function LanguagePreferenceField({value,onChange}:{value?:Language;onChange?:(value:Language)=>void}){
 const {language,t}=useLanguage();
 return <label className="grid gap-2 text-sm font-medium">{t('Preferred language')} / Idioma<select name="preferredLanguage" aria-label="Preferred language / Idioma" value={value} defaultValue={value?undefined:language} onChange={event=>onChange?.(normalizeLanguage(event.target.value))} className="h-11 w-full rounded-xl border bg-white px-3"><option value="en">English</option><option value="es">Español</option></select><span className="text-xs font-normal text-muted-foreground">{t('Choose the language you prefer. You can change it anytime in Settings.')}</span></label>;
}
export function LanguagePreferenceSettings(){
 const {language,t}=useLanguage();const [selected,setSelected]=useState(language),[pending,setPending]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');const router=useRouter();
 return <form className="space-y-3 rounded-2xl border bg-white p-4" onSubmit={async event=>{event.preventDefault();if(pending)return;setPending(true);setError('');setMessage('');try{const result=await updatePreferredLanguageAction(selected);if(result.ok){setMessage(result.message??'');router.refresh();}else setError(result.error??'Please try again.');}catch{setError('Your language could not be saved. Please try again.');}finally{setPending(false);}}}>
  <fieldset disabled={pending} className="space-y-3"><LanguagePreferenceField value={selected} onChange={setSelected}/><p className="text-xs text-muted-foreground">{t('Your preference is saved to your account and remembered when you sign in on another device.')}</p><Button type="submit">{pending?t('Saving…'):t('Save language')}</Button></fieldset>{message&&<p role="status" className="text-sm">{message}</p>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 </form>;
}
