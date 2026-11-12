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
 const [voiceError, setVoiceError] = useState("");
 useEffect(() => () => {
   const active = dictation.current;
   if (!active) return;
   dictation.current = null;
   active.onresult = active.onerror = active.onend = null;
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
   recognition.onresult = event => {
     const words = Array.from(event.results).slice(event.resultIndex)
       .map(result => result[0]?.transcript.trim()).filter(Boolean).join(" ");
     if (words) setDescription(current => [current.trimEnd(), words].filter(Boolean).join(" ").slice(0, 4000));
   };
   recognition.onerror = event => {
     if (event.error === "aborted") return;
     setVoiceError(event.error === "not-allowed" || event.error === "service-not-allowed"
       ? "Allow microphone and speech recognition access in your browser settings to dictate."
       : "Dictation couldn’t continue. Tap the microphone to try again.");
   };
   recognition.onend = () => {
     dictation.current = null;
     setListening(false);
   };
   try {
     recognition.start();
     dictation.current = recognition;
     setListening(true);
   } catch {
     setVoiceError("Couldn’t start dictation. You can still type your description.");
   }
 }

 async function generate(){if(!businessId)return;setBusy(true);setError("");setCreated(false);try{const response=await fetch(`/api/vendor/business/${encodeURIComponent(businessId)}/service-draft`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description})});const result=await response.json();if(!response.ok)throw Error((result.error||"Could not create a draft.")+(result.diagnostic?` (${result.diagnostic})`:""));const next=serviceDraftSchema.parse(result.draft);setCreated(true);onApply(serviceDraftToForm(next));}catch(error){setError(error instanceof Error?error.message:"Could not create a draft.");}finally{setBusy(false);}}
 return <section style={{fontFamily:"inherit"}} className="rounded-2xl border bg-white p-5 space-y-4"><div className="flex items-center gap-3"><SophiaPortrait/><div><h2 style={{fontFamily:'var(--font-shopfia-sans), "Instrument Sans", Inter, sans-serif',color:"#000000",fontSize:"clamp(24px, 3vw, 36px)",lineHeight:1.1}} className="font-semibold">hi, i’m <span className="shopfia-editorial-heading font-normal italic text-primary" style={{fontFamily:'var(--font-shopfia-serif), Canela, "Editorial New", "Iowan Old Style", Georgia, serif',fontWeight:400,fontSize:"1.15em",fontStyle:"italic",textTransform:"none"}}>sofia.</span></h2><p className="text-sm text-muted-foreground">I will help you create your service. Just describe it here.</p></div></div><label htmlFor="sofia-service-description" className="ml-[76px] block text-sm font-semibold">What do you offer?</label><div className="relative"><textarea id="sofia-service-description" className="w-full rounded-2xl border p-3 pb-14 text-base placeholder:italic" rows={5} maxLength={4000} placeholder="Example: I make custom sugar cookies with high-quality ingredients. I sell them in sets of 12 for $40, 24 for $80, or 36 for $120. I can decorate cookies for any theme and match the icing to your color palette. Customers can send inspiration photos with their quote. I also offer delivery within 30 miles for an additional fee." value={description} onChange={event=>setDescription(event.target.value)}/>
 <button type="button" onClick={toggleDictation} disabled={busy} aria-label={listening ? "Stop dictation" : "Dictate service description"} className="absolute bottom-3 right-3 inline-flex min-h-11 items-center gap-2 rounded-full border bg-white px-3 text-sm font-medium disabled:opacity-50">
   {listening ? <Square size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
   {listening ? "Stop" : "Dictate"}
 </button></div>
 {listening && <DictationWaveform />}
 {voiceError && <p role="alert" className="text-sm text-red-700">{voiceError}</p>}
 <Button type="button" disabled={!businessId||busy||listening||description.trim().length<10} onClick={generate}>{busy?"Sofia is creating my service…":"Ask Sofia to create my service"}</Button>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{created&&<p role="status" className="text-sm">Service details added below. You can edit them before saving.</p>}</section>;
}

function SophiaPortrait(){
 return <img src="/images/sofia-assistant.webp" alt="Sofia, a smiling pink striped candle" width={64} height={96} className="h-24 w-16 shrink-0 rounded-2xl object-contain"/>;
}

function DictationWaveform() {
 const [levels, setLevels] = useState<number[]>(() => Array(44).fill(3));
 const [unavailable, setUnavailable] = useState(false);

 useEffect(() => {
   let disposed = false;
   let stream: MediaStream | undefined;
   let context: AudioContext | undefined;
   let timer: ReturnType<typeof setInterval> | undefined;

   async function startMeter() {
     try {
       if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
         setUnavailable(true);
         return;
       }
       const microphone = await navigator.mediaDevices.getUserMedia({audio: true});
       if (disposed) {
         microphone.getTracks().forEach(track => track.stop());
         return;
       }
       stream = microphone;
       context = new AudioContext();
       const analyser = context.createAnalyser();
       analyser.fftSize = 1024;
       context.createMediaStreamSource(stream).connect(analyser);
       await context.resume();
       if (disposed) return;
       const samples = new Float32Array(analyser.fftSize);
       timer = setInterval(() => {
         analyser.getFloatTimeDomainData(samples);
         const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
         const height = Math.min(30, Math.max(3, Math.round(rms * 180)));
         setLevels(previous => [...previous.slice(1), height]);
       }, 70);
     } catch {
       stream?.getTracks().forEach(track => track.stop());
       if (!disposed) setUnavailable(true);
     }
   }

   void startMeter();
   return () => {
     disposed = true;
     clearInterval(timer);
     stream?.getTracks().forEach(track => track.stop());
     if (context && context.state !== "closed") void context.close().catch(() => {});
   };
 }, []);

 return (
   <div className="flex items-center gap-3 rounded-full border border-primary/20 bg-primary/10 px-4 py-2">
     <span role="status" className="shrink-0 text-sm font-medium">Listening…</span>
     {!unavailable && (
       <div aria-hidden="true" className="flex h-8 min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
         {levels.map((height, index) => (
           <span key={index} className="min-w-0 flex-1 rounded-full bg-foreground/60" style={{height}} />
         ))}
       </div>
     )}
   </div>
 );
}
