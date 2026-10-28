"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Text keeps its template styling until selected; drafts commit on blur or Enter. */
export function InlineStorefrontText({value,placeholder,label,onChange,children}: {value:string;placeholder:string;label:string;onChange:(value:string)=>void;children?:ReactNode}) {
 const [editing,setEditing]=useState(false);
 const [draft,setDraft]=useState(value);
 const field=useRef<HTMLTextAreaElement>(null);
 const cancelled=useRef(false);
 useLayoutEffect(()=>{if(editing && field.current){field.current.style.height="0px";field.current.style.height=`${field.current.scrollHeight}px`;}},[editing,draft]);
 function commit(){if(!cancelled.current && draft!==value)onChange(draft);setEditing(false);}
 if(editing)return <textarea ref={field} autoFocus aria-label={label} value={draft} placeholder={placeholder} rows={1} className="storefront-inline-field" onClick={event=>event.stopPropagation()} onChange={event=>setDraft(event.target.value)} onBlur={commit} onKeyDown={event=>{if(event.key==="Escape"){event.preventDefault();cancelled.current=true;setEditing(false);}else if(event.key==="Enter" && !event.shiftKey && !event.nativeEvent.isComposing){event.preventDefault();event.currentTarget.blur();}}}/>;
 return <button type="button" className="storefront-inline-text" aria-label={`Edit ${label.toLowerCase()}`} title="Click to edit" onClick={event=>{event.stopPropagation();cancelled.current=false;setDraft(value);setEditing(true);}}>{value ? children ?? value : <span className="storefront-inline-placeholder">{placeholder}</span>}</button>;
}
