export const SERVICE_EVENT_TYPES = [
 {id:"shopfia-event-pet-party",name:"Pet Party",iconName:"paw-print"},
 {id:"shopfia-event-bachelor-party",name:"Bachelor Party",iconName:"party-popper"},
 {id:"shopfia-event-bachelorette-party",name:"Bachelorette Party",iconName:"party-popper"}
] as const;
export const PET_PARTY_OPTION_ID=SERVICE_EVENT_TYPES[0].id;
export function eventTypeOptions<T extends {id:string;name:string}>(options:T[]){
 return [...options,...SERVICE_EVENT_TYPES.filter(type=>!options.some(option=>option.name.trim().toLowerCase()===type.name.toLowerCase())).map(({id,name})=>({id,name}))];
}
