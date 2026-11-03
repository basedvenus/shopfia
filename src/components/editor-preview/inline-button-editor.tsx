"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
export function InlineButtonEditor({onChange}:{onChange:(text:string)=>void}) {
 const [target,setTarget]=useState<HTMLElement|null>(null);
 const [value,setValue]=useState("");
 const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{const click=(event:MouseEvent)=>{const element=event.target as HTMLElement;const button=element.closest<HTMLElement>('.editor-canvas [data-storefront-button]');if(button){setValue(button.innerText.trim());setTarget(button);}};document.addEventListener('click',click,true);return()=>document.removeEventListener('click',click,true);},[]);
 useEffect(()=>{if(target){input.current?.focus();input.current?.select();}},[target]);
 if(!target)return null;
 const rect=target.getBoundingClientRect();const style=getComputedStyle(target);
 return createPortal(<input ref={input} aria-label="Button label" value={value} maxLength={60} onChange={event=>setValue(event.target.value)} onBlur={()=>{if(value.trim())onChange(value.trim());setTarget(null);}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}if(event.key==='Escape'){setTarget(null);}}} style={{position:'fixed',left:rect.left,top:rect.top,width:rect.width,height:rect.height,zIndex:80,background:style.backgroundColor,color:style.color,font:style.font,textAlign:'center',borderRadius:style.borderRadius,border:'2px solid #d96996',outline:'none',padding:'4px'}}/>,document.body);
}
