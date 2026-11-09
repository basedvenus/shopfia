type ServiceState={id:string;active:boolean;featured:boolean;isNew?:boolean;photos:string[]};
/** Saved drafts may style current services, but cannot resurrect deleted database records. */
export function mergeCurrentStorefrontServices<T extends ServiceState>(draftServices:T[],liveServices:T[]):T[]{
 const liveById=new Map(liveServices.map(service=>[service.id,service]));
 const merged=draftServices.flatMap(service=>{
  const live=liveById.get(service.id);
  if(!live)return service.isNew?[service]:[];
  return [{...live,...service,active:live.active&&service.active,photos:service.photos?.length?service.photos:live.photos??[]}];
 });
 const present=new Set(merged.map(service=>service.id));
 return [...merged,...liveServices.filter(service=>!present.has(service.id))];
}
export function applyStorefrontServiceVisibility<T extends ServiceState>(services:T[],hiddenIds:string[]=[]):T[]{
 const hidden=new Set(hiddenIds);
 return services.map(service=>({...service,active:service.active&&!hidden.has(service.id),featured:service.active&&!hidden.has(service.id)&&service.featured}));
}
