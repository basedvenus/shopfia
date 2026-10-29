export type SectionLayout = Record<string, { height?: number; beside?: string }>;
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
