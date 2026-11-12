"use client";
import {useEffect, useRef, useState} from "react";
import {Mic, Square} from "lucide-react";
import {Button} from "@/components/ui/button";
import {serviceDraftSchema,serviceDraftToForm} from "@/lib/service-ai-draft";
import type {ServicePricing} from "@/lib/service-pricing";
type Dictation = {
  lang: string;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: {resultIndex: number; results: ArrayLike<ArrayLike<{transcript: string}>>}) => void) | null;
  onerror: ((event: {error: string}) => void) | null;
  onstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onend: (() => void) | null;
};

function dictationConstructor() {
  const browser = window as Window & {
    SpeechRecognition?: new () => Dictation;
    webkitSpeechRecognition?: new () => Dictation;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

export function ServiceAiSetup({businessId,onApply}:{businessId?:string;onApply:(service:ServicePricing)=>void}){
 const [description,setDescription]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[created,setCreated]=useState(false);
 const dictation = useRef<Dictation | null>(null);
 const [listening, setListening] = useState(false);
 const [speaking, setSpeaking] = useState(false);
 const [voiceError, setVoiceError] = useState("");
 useEffect(() => () => {
   const active = dictation.current;
   if (!active) return;
   dictation.current = null;
   active.onresult = active.onerror = active.onend = null;
   active.onstart = active.onspeechstart = active.onspeechend = null;
   active.abort();
 }, []);

 function toggleDictation() {
   if (dictation.current) {
     dictation.current.stop();
     return;
   }
   setVoiceError("");
   const Recognition = dictationConstructor();
   if (!Recognition) {
     setVoiceError("This browser doesn’t support the microphone button. You can type or use your keyboard’s dictation.");
     return;
   }
   const recognition = new Recognition();
   recognition.lang = document.documentElement.lang || navigator.language;
   recognition.continuous = true;
   recognition.onstart = () => setListening(true);
   recognition.onspeechstart = () => setSpeaking(true);
   recognition.onspeechend = () => setSpeaking(false);
   recognition.onresult = event => {
     const words = Array.from(event.results).slice(event.resultIndex)
       .map(result => result[0]?.transcript.trim()).filter(Boolean).join(" ");
     if (words) setDescription(current => [current.trimEnd(), words].filter(Boolean).join(" ").slice(0, 4000));
   };
   recognition.onerror = event => {
     dictation.current = null;
     setListening(false);
     setSpeaking(false);
     if (event.error === "aborted") return;
     setVoiceError(event.error === "not-allowed" || event.error === "service-not-allowed"
       ? "The browser couldn’t start speech recognition. Reload this page and try again, or use your keyboard’s dictation."
       : "Dictation couldn’t continue. Tap the microphone to try again.");
   };
   recognition.onend = () => {
     if (dictation.current !== recognition) return;
     dictation.current = null;
     setSpeaking(false);
     setListening(false);
   };
   try {
     dictation.current = recognition;
     recognition.start();
   } catch {
     dictation.current = null;
     setVoiceError("Couldn’t start dictation. You can still type your description.");
   }
 }

 async function generate(){if(!businessId)return;setBusy(true);setError("");setCreated(false);try{const response=await fetch(`/api/vendor/business/${encodeURIComponent(businessId)}/service-draft`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description})});const result=await response.json();if(!response.ok)throw Error((result.error||"Could not create a draft.")+(result.diagnostic?` (${result.diagnostic})`:""));const next=serviceDraftSchema.parse(result.draft);setCreated(true);onApply(serviceDraftToForm(next));}catch(error){setError(error instanceof Error?error.message:"Could not create a draft.");}finally{setBusy(false);}}
 return <section style={{fontFamily:"inherit"}} className="rounded-2xl border bg-white p-5 space-y-4"><div className="flex items-center gap-3"><SophiaPortrait/><div><h2 style={{fontFamily:'var(--font-shopfia-sans), "Instrument Sans", Inter, sans-serif',color:"#000000",fontSize:"clamp(24px, 3vw, 36px)",lineHeight:1.1}} className="font-semibold">hi, i’m <span className="shopfia-editorial-heading font-normal italic text-primary" style={{fontFamily:'var(--font-shopfia-serif), Canela, "Editorial New", "Iowan Old Style", Georgia, serif',fontWeight:400,fontSize:"1.15em",fontStyle:"italic",textTransform:"none"}}>sofia.</span></h2><p className="text-sm text-muted-foreground">I will help you create your service. Just describe it here.</p></div></div><label htmlFor="sofia-service-description" className="ml-[76px] block text-sm font-semibold">What do you offer?</label><div className="relative"><textarea id="sofia-service-description" className="w-full rounded-2xl border p-3 pb-14 text-base placeholder:italic" rows={5} maxLength={4000} placeholder="Example: I make custom sugar cookies with high-quality ingredients. I sell them in sets of 12 for $40, 24 for $80, or 36 for $120. I can decorate cookies for any theme and match the icing to your color palette. Customers can send inspiration photos with their quote. I also offer delivery within 30 miles for an additional fee." value={description} onChange={event=>setDescription(event.target.value)}/>
 <button type="button" onClick={toggleDictation} disabled={busy} aria-label={listening ? "Stop dictation" : "Dictate service description"} className="absolute bottom-3 right-3 inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border bg-white px-3 text-sm font-medium disabled:opacity-50">
   {listening ? <Square size={12} fill="currentColor" aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
   {!listening && "Dictate"}
 </button></div>
 {listening && <DictationWaveform speaking={speaking} />}
 {voiceError && <p role="alert" className="text-sm text-red-700">{voiceError}</p>}
 <Button type="button" disabled={!businessId||busy||listening||description.trim().length<10} onClick={generate}>{busy?"Sofia is creating my service…":"Ask Sofia to create my service"}</Button>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{created&&<p role="status" className="text-sm">Service details added below. You can edit them before saving.</p>}</section>;
}

function SophiaPortrait(){
 return <img src="/images/sofia-assistant.webp" alt="Sofia, a smiling pink striped candle" width={64} height={96} className="h-24 w-16 shrink-0 rounded-2xl object-contain"/>;
}

function DictationWaveform({speaking}: {speaking: boolean}) {
 return (
   <div className="inline-flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1">
     <span role="status" className="text-xs text-muted-foreground">Listening…</span>
     <div aria-hidden="true" className="flex h-4 items-center gap-0.5">
       {[4, 7, 12, 8, 14, 9, 5].map((height, index) => (
         <span key={index} className="w-0.5 rounded-full bg-muted-foreground/60 motion-safe:transition-[height]" style={{height: speaking ? height : 2}} />
       ))}
     </div>
   </div>
 );
}
