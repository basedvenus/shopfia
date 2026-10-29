export type SectionLayout = Record<string, { height?: number; beside?: string; width?: number; offset?: number }>;
export type SectionPlacement = 'above' | 'below' | 'left' | 'right';

export function sectionRows(order: string[], layout: SectionLayout) {
 const rows: string[][] = [];
 for (const id of order) {
  const previous = rows.at(-1);
  if (previous?.length === 1 && layout[id]?.beside === previous[0]) previous.push(id);
  else rows.push([id]);
 }
 return rows;
}

export function placeSection(order: string[], layout: SectionLayout, source: string, target: string, placement: SectionPlacement) {
 if (source === target || !order.includes(source) || !order.includes(target)) return {order, layout};
 const nextLayout: SectionLayout = Object.fromEntries(Object.entries(layout).map(([id,value]) => {
  const next = {...value};
  if (id === source || id === target || next.beside === source || next.beside === target) delete next.beside;
  return [id,next];
 }));
 const nextOrder = order.filter(id => id !== source);
 const index = nextOrder.indexOf(target) + (placement === 'below' || placement === 'right' ? 1 : 0);
 nextOrder.splice(index,0,source);
 if (placement === 'left') nextLayout[target] = {...nextLayout[target],beside:source};
 if (placement === 'right') nextLayout[source] = {...nextLayout[source],beside:target};
 return {order:nextOrder,layout:nextLayout};
}

const clamp = (value:number,min:number,max:number) => Math.round(Math.max(min,Math.min(max,value))*10)/10;
export function rowColumns(row:string[],layout:SectionLayout) {
 const left=clamp(layout[row[0]]?.width??50,25,75);
 return `minmax(0,${left}fr) minmax(0,${100-left}fr)`;
}
export function resizeSectionWidth(layout:SectionLayout,row:string[],id:string,edge:'left'|'right',delta:number):SectionLayout {
 if(!Number.isFinite(delta)||!row.includes(id))return layout;
 if(row.length===2){
  const left=clamp(clamp(layout[row[0]]?.width??50,25,75)+delta,25,75);
  return {...layout,[row[0]]:{...layout[row[0]],width:left,offset:0},[row[1]]:{...layout[row[1]],width:100-left,offset:0}};
 }
 const current=layout[id]??{}, width=current.width??100,offset=current.offset??0;
 if(edge==='left'){
  const nextOffset=clamp(offset+delta,0,offset+width-25);
  return {...layout,[id]:{...current,width:clamp(offset+width-nextOffset,25,100),offset:nextOffset}};
 }
 return {...layout,[id]:{...current,width:clamp(width+delta,25,100-offset),offset}};
}
