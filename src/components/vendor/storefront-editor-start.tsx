"use client";
import {useState} from "react";
import Link from "next/link";
import {ArrowLeft} from "lucide-react";
import {Button} from "@/components/ui/button";

export function StorefrontEditorStart({href,showGuide=false}:{href:string;showGuide?:boolean}) {
 const [visible,setVisible]=useState(showGuide);
 return <div className="mt-4 flex flex-wrap items-center gap-4">
  <Button asChild><Link href={href}>Edit storefront</Link></Button>
  {visible ? <aside aria-label="Storefront tutorial" className="flex max-w-sm items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm">
   <ArrowLeft aria-hidden="true" className="h-6 w-6 shrink-0 text-[#a65b66] motion-safe:animate-pulse" />
   <div><p className="font-semibold">Start here</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Add your photos, business details, and services to make your storefront yours.</p><button type="button" className="mt-2 text-xs font-semibold underline" onClick={()=>setVisible(false)}>Got it</button></div>
  </aside> : null}
 </div>;
}
