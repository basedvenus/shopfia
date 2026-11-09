"use client";
import {useEffect,useRef,useState} from "react";
import {serviceMapBounds,serviceAreasZoom,areaRadiusMiles,mapPoint,milesFromPixels,radiusPixels,radiusZoom} from "@/lib/service-radius-map";

export function ServiceRadiusMap({lat,lng,radius,onChange,areas=[],readOnly=false}:{lat:number;lng:number;radius:number;onChange?:(miles:number)=>void;readOnly?:boolean;areas?:import("@/lib/places").PlaceDetails[]}) {
 const root=useRef<HTMLDivElement>(null);
 const [width,setWidth]=useState(400);
 const [zoom,setZoom]=useState(()=>radiusZoom(lat,radius));
 useEffect(()=>{const element=root.current;if(!element)return;const observer=new ResizeObserver(()=>setWidth(element.clientWidth));observer.observe(element);return()=>observer.disconnect();},[]);
 const height=300,center=serviceMapBounds(lat,lng,radius,areas,zoom),base=mapPoint(lat,lng,zoom),baseX=base.x-center.x+width/2,baseY=base.y-center.y+height/2,r=radiusPixels(radius,lat,zoom),tiles=[];
 const areaKey=areas.map(area=>area.placeId).join("|");
 useEffect(()=>{if(areas.length)setZoom(serviceAreasZoom(lat,lng,radius,areas,width,height));},[areaKey,width]);
 for(let x=Math.floor((center.x-width/2)/256);x<=Math.floor((center.x+width/2)/256);x++)for(let y=Math.floor((center.y-height/2)/256);y<=Math.floor((center.y+height/2)/256);y++) {
  const count=2**zoom;if(y<0||y>=count)continue;
  tiles.push({x,y,url:`https://tile.openstreetmap.org/${zoom}/${((x%count)+count)%count}/${y}.png`});
 }
 return <div className="space-y-2">
  <p className="text-xs text-muted-foreground">{readOnly ? "Service radius and selected service areas." : "Drag the circle’s handle, or use the radius slider below."}{areas.length > 0 ? " Blue bubbles mark your selected service areas." : ""}</p>
  <div ref={root} role="group" aria-label="Service area map" className="relative overflow-hidden rounded-2xl border bg-stone-100" style={{height}}>
   {tiles.map(tile=><img key={`${zoom}:${tile.x}:${tile.y}`} src={tile.url} alt="" draggable={false} width={256} height={256} style={{position:'absolute',maxWidth:'none',left:tile.x*256-center.x+width/2,top:tile.y*256-center.y+height/2,width:256,height:256}}/>)}
   <svg aria-hidden="true" width="100%" height={height} className="pointer-events-none absolute inset-0"><circle cx={baseX} cy={baseY} r={r} fill="#d86b9333" stroke="#c74d7f" strokeWidth={3}/>{areas.map(area=>{const point=mapPoint(area.lat,area.lng,zoom),x=point.x-center.x+width/2,y=point.y-center.y+height/2,size=radiusPixels(areaRadiusMiles(area),area.lat,zoom);return <g key={area.placeId} data-service-area-bubble={area.formattedAddress}><circle cx={x} cy={y} r={size} fill="#84a9ba55" stroke="#386d85" strokeWidth={2}/><text x={x} y={y-size-6} textAnchor="middle" fontSize={11} fontWeight={600} fill="#244b5d" stroke="white" strokeWidth={3} paintOrder="stroke">{area.name||area.city}</text></g>;})}<circle cx={baseX} cy={baseY} r={5} fill="#9e315d" stroke="white" strokeWidth={2}/></svg>
   {!readOnly&&<button type="button" aria-label="Drag to resize service radius" className="absolute h-7 w-7 touch-none rounded-full border-2 border-[#c74d7f] bg-white shadow" style={{left:baseX+r-14,top:baseY-14,cursor:'ew-resize'}} onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event=>{if(!event.currentTarget.hasPointerCapture(event.pointerId)||!root.current)return;const rect=root.current.getBoundingClientRect();onChange?.(milesFromPixels(Math.hypot(event.clientX-rect.left-baseX,event.clientY-rect.top-baseY),lat,zoom));}} onPointerUp={event=>event.currentTarget.releasePointerCapture(event.pointerId)} onKeyDown={event=>{if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(event.key)){event.preventDefault();onChange?.(Math.max(1,Math.min(200,radius+(['ArrowLeft','ArrowDown'].includes(event.key)?-1:1))));}}}/>}
   <div className="absolute left-2 top-2 flex gap-1 rounded-xl bg-white p-1 shadow"><button type="button" aria-label="Zoom in service map" className="px-3 py-1" onClick={()=>setZoom(value=>Math.min(14,value+1))}>+</button><button type="button" aria-label="Zoom out service map" className="px-3 py-1" onClick={()=>setZoom(value=>Math.max(2,value-1))}>−</button><button type="button" className="px-2 text-xs" onClick={()=>setZoom(serviceAreasZoom(lat,lng,radius,areas,width,height))}>{areas.length?"Fit all areas":"Fit circle"}</button></div>
   <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="absolute bottom-0 right-0 bg-white/90 px-2 py-1 text-[10px]">© OpenStreetMap contributors</a>
  </div>
 </div>;
}
