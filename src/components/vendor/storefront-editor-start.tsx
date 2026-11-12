"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowRight} from "lucide-react";
import {Button} from "@/components/ui/button";

export function StorefrontEditorStart({href,showGuide=false}:{href:string;showGuide?:boolean}) {
 const [visible, setVisible] = useState(showGuide);
 useEffect(() => {
   if (!showGuide) return;
   const url = new URL(window.location.href);
   if (!url.searchParams.has("welcome")) return;
   url.searchParams.delete("welcome");
   window.history.replaceState(window.history.state, "", url);
 }, [showGuide]);

 return (
   <div className="inline-flex shrink-0 items-center gap-2">
     {visible && (
       <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-[#a65b66]">
         Start Here <ArrowRight aria-hidden="true" className="size-4" />
       </span>
     )}
     <Button asChild><Link href={href} onClick={() => setVisible(false)}>Edit Storefront</Link></Button>
   </div>
 );
}
