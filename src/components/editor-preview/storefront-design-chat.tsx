"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, Sparkles } from "lucide-react";

export function StorefrontDesignChat({ name, onName, onBrief, onContinue, logoEditor, previewOnly, onLocalLogo }: {
  name: string;
  onName: (name: string) => void;
  onBrief: (brief: string) => void;
  onContinue: () => void;
  logoEditor: ReactNode;
  previewOnly?: boolean;
  onLocalLogo?: (url: string) => void;
}) {
  const [answers, setAnswers] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [typing, setTyping] = useState(false);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (replyTimer.current) clearTimeout(replyTimer.current); }, []);
  const questions = [
    "Hi! Let’s give your business a storefront that feels like you. What’s your business called?",
    `Nice to meet you! ${answers[0] || name} sounds amazing! Tell me what you create and the kind of celebrations you work on.`,
    "What should your brand feel like? Think soft and romantic, playful and colorful, natural and relaxed, or clean and elevated. You can describe it in your own words.",
    "Let’s bring that feeling to life! First, choose your colors. Then we’ll find a font pairing you love. You can always change your choices later. Have a logo? Add it below to see it in your preview."
  ];
  function send(value = input) {
    if (typing || answers.length >= 3) return;
    const answer = value.trim();
    if (!answer) { setError("Add a message to continue."); return; }
    if (answer.length > (answers.length === 0 ? 120 : 1000)) { setError(answers.length === 0 ? "Keep the business name under 120 characters." : "Keep this message under 1,000 characters."); return; }
    const next = [...answers, answer];
    setTyping(true);
    replyTimer.current = setTimeout(() => { setTyping(false); replyTimer.current = null; }, 900);
    setAnswers(next); setInput(""); setError("");
    if (answers.length === 0) onName(answer);
    else onBrief(next.slice(1).join(" "));
  }
  return <div className="space-y-6">
    <div className="flex items-center gap-2 text-sm font-medium"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#f6e3eb]"><Sparkles className="h-4 w-4 text-[#83576e]" /></span>ShopFia Design Studio<span className="ml-auto text-[10px] font-normal text-muted-foreground">Conversation preview</span></div>
    <div className="space-y-5" role="log" aria-label="Storefront design conversation" aria-live="polite">
      {questions.slice(0, answers.length + (typing ? 0 : 1)).map((question, index) => <div key={index} className="space-y-4">
        <p className="max-w-[95%] text-base leading-7 text-[#40373b]">{question}</p>
        {answers[index] ? <div className="ml-10 rounded-2xl rounded-br-sm bg-[#f6eff2] px-4 py-3 text-sm leading-6 text-[#56414d]">{answers[index]}</div> : null}
      </div>)}
      {typing ? <div role="status" aria-label="Design assistant is typing" className="flex gap-1.5 py-3">{[0, 1, 2].map((dot) => <span key={dot} className="h-2 w-2 rounded-full bg-[#a88d9d] motion-safe:animate-bounce" style={{ animationDelay: `${dot * 150}ms` }} />)}</div> : null}
    </div>
    {answers.length < 3 ? <>
      <div className="flex flex-wrap gap-2">
        {(answers.length === 0 ? [name].filter(Boolean) : answers.length === 2 ? ["Natural & relaxed", "Soft & romantic", "Playful & colorful", "Clean & elevated"] : []).map((suggestion) => <button key={suggestion} type="button" disabled={typing} onClick={() => send(suggestion)} className="rounded-full border border-[#e7dce2] px-3 py-2 text-xs text-[#68515e] transition hover:bg-[#f9f1f5]">{suggestion}</button>)}
      </div>
      <div className="flex items-end gap-2 rounded-3xl border border-[#e6dce3] bg-white p-3 shadow-[0_5px_24px_rgba(76,46,70,0.04)] focus-within:border-[#bda2b3]">
        <textarea aria-label="Message the storefront design assistant" rows={2} disabled={typing} value={input} maxLength={answers.length === 0 ? 120 : 1000} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} placeholder={answers.length === 0 ? "Your business name…" : "Tell me a little more…"} className="min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-1 text-sm leading-6 outline-none" />
        <button type="button" onClick={() => send()} disabled={typing || !input.trim()} aria-label="Send design message" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#5f4558] text-white transition hover:bg-[#493243] disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
      </div>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}

    </> : typing ? null : <div className="space-y-5"> {previewOnly ? <label className="grid gap-3 text-sm font-medium">Add your logo to the preview<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) { setError("Choose an image smaller than 8 MB."); return; } const url = URL.createObjectURL(file); onLocalLogo?.(url); }} /><span className="text-xs font-normal text-muted-foreground">Stays in this browser preview. Nothing is uploaded.</span></label> : logoEditor}<button type="button" onClick={onContinue} className="w-full rounded-full bg-[#5f4558] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#493243]">Show my looks <span aria-hidden="true">→</span></button></div>}
  </div>;
}
