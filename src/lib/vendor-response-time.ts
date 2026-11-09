export function formatResponseTime(seconds:number|null){
 if(seconds===null||!Number.isFinite(seconds)||seconds<0)return "Not available yet";
 if(seconds<60)return "Under 1 minute";
 if(seconds<3600){const minutes=Math.ceil(seconds/60);return `${minutes} ${minutes===1?"minute":"minutes"}`;}
 if(seconds<86400){const hours=Math.round(seconds/360)/10;return `${hours} ${hours===1?"hour":"hours"}`;}
 const days=Math.round(seconds/8640)/10;return `${days} ${days===1?"day":"days"}`;
}
