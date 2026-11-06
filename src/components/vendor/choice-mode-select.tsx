"use client";
import {useRef,useState} from "react";
import * as Select from "@radix-ui/react-select";
import {Check,ChevronDown} from "lucide-react";
type Mode="display"|"single"|"multiple";
const options:[Mode,string][]=[["display","None — show the list only"],["single","Let customers choose one"],["multiple","Let customers choose more than one"]];
export function ChoiceModeSelect({value,onChange}:{value:Mode;onChange:(value:Mode)=>void}){
 const trigger=useRef<HTMLButtonElement>(null);
 const [container,setContainer]=useState<HTMLElement|undefined>();
 return <Select.Root value={value} onValueChange={next=>onChange(next as Mode)} onOpenChange={open=>{if(open)setContainer(trigger.current?.closest("dialog")??undefined);}}>
  <Select.Trigger ref={trigger} aria-label="How many options can customers choose?" className="flex min-h-11 w-full items-center justify-between gap-3 rounded-full border border-[#eadbd7] bg-white px-4 py-2 text-left text-sm text-[#675f59] outline-none focus-visible:ring-2 focus-visible:ring-stone-300"><Select.Value/><Select.Icon><ChevronDown className="h-4 w-4"/></Select.Icon></Select.Trigger>
  <Select.Portal container={container}><Select.Content position="popper" sideOffset={5} collisionPadding={12} className="z-[150] max-h-[min(300px,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] overflow-auto rounded-2xl border border-stone-200 bg-white p-1.5 font-sans text-sm text-[#675f59] shadow-lg"><Select.Viewport>{options.map(([mode,label])=><Select.Item key={mode} value={mode} className="relative flex min-h-10 cursor-pointer select-none items-center rounded-xl py-2 pl-9 pr-3 outline-none data-[highlighted]:bg-stone-100 data-[state=checked]:bg-stone-100"><Select.ItemIndicator className="absolute left-3"><Check className="h-4 w-4"/></Select.ItemIndicator><Select.ItemText>{label}</Select.ItemText></Select.Item>)}</Select.Viewport></Select.Content></Select.Portal>
 </Select.Root>;
}
