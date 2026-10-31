"use client";
import {useEffect,useRef,useState} from 'react';

/** Session-only history of saved editor values, independent of navigation/UI state. */
export function useEditorHistory<T>(value:T,restore:(value:T)=>void) {
 const serialized=JSON.stringify(value);
 const history=useRef<string[]>([serialized]);
 const position=useRef(0);
 const replay=useRef<string|null>(null);
 const [,render]=useState(0);
 useEffect(()=>{
  if(replay.current===serialized){replay.current=null;return;}
  if(history.current[position.current]===serialized)return;
  history.current=history.current.slice(0,position.current+1);
  history.current.push(serialized);
  if(history.current.length>50)history.current.shift();
  position.current=history.current.length-1;
  render(n=>n+1);
 },[serialized]);
 function move(delta:number){
  const next=position.current+delta;
  if(next<0||next>=history.current.length)return;
  position.current=next;
  replay.current=history.current[next];
  restore(JSON.parse(history.current[next]) as T);
  render(n=>n+1);
 }
 return {canUndo:position.current>0,canRedo:position.current<history.current.length-1,undo:()=>move(-1),redo:()=>move(1)};
}
