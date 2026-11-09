const EARTH_CIRCUMFERENCE_METERS = 40075016.686;
export function metersPerPixel(latitude:number,zoom:number) {
  return Math.cos(Math.max(-85,Math.min(85,latitude))*Math.PI/180)*EARTH_CIRCUMFERENCE_METERS/(256*2**zoom);
}
export function radiusPixels(miles:number,latitude:number,zoom:number) { return miles*1609.344/metersPerPixel(latitude,zoom); }
export function milesFromPixels(pixels:number,latitude:number,zoom:number) { return Math.max(1,Math.min(200,Math.round(pixels*metersPerPixel(latitude,zoom)/1609.344))); }
export function mapPoint(latitude:number,longitude:number,zoom:number) {
 const sin=Math.sin(Math.max(-85,Math.min(85,latitude))*Math.PI/180),size=256*2**zoom;
 return {x:(longitude+180)/360*size,y:(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*size};
}
export function radiusZoom(latitude:number,miles:number) {
 for(let zoom=14;zoom>=2;zoom--) if(radiusPixels(miles,latitude,zoom)<=105)return zoom;
 return 2;
}

/** Geographic bubbles use the selected place's viewport, rather than a fixed visual size. */
export function areaRadiusMiles(area:{viewport?:{low:{latitude:number;longitude:number};high:{latitude:number;longitude:number}};types?:string[];lat:number}) {
 if(!area.viewport)return area.types?.includes('administrative_area_level_2')?20:5;
 const {low,high}=area.viewport;
 const height=Math.abs(high.latitude-low.latitude)*69.09;
 const longitudeSpan=Math.min(Math.abs(high.longitude-low.longitude),360-Math.abs(high.longitude-low.longitude));
 const width=longitudeSpan*69.09*Math.cos(area.lat*Math.PI/180);
 return Math.max(1,Math.min(150,Math.hypot(width,height)/2));
}

export function serviceMapBounds(lat:number,lng:number,radius:number,areas:{lat:number;lng:number;viewport?:{low:{latitude:number;longitude:number};high:{latitude:number;longitude:number}};types?:string[]}[],zoom:number){
 const base=mapPoint(lat,lng,zoom),r=radiusPixels(radius,lat,zoom);
 let left=base.x-r,right=base.x+r,top=base.y-r,bottom=base.y+r;
 for(const area of areas){const point=mapPoint(area.lat,area.lng,zoom),size=radiusPixels(areaRadiusMiles(area),area.lat,zoom);left=Math.min(left,point.x-size);right=Math.max(right,point.x+size);top=Math.min(top,point.y-size);bottom=Math.max(bottom,point.y+size);}
 return {x:(left+right)/2,y:(top+bottom)/2,width:right-left,height:bottom-top};
}
export function serviceAreasZoom(lat:number,lng:number,radius:number,areas:Parameters<typeof serviceMapBounds>[3],width:number,height:number){
 for(let zoom=14;zoom>=2;zoom--){const bounds=serviceMapBounds(lat,lng,radius,areas,zoom);if(bounds.width<=width-48&&bounds.height<=height-60)return zoom;}return 2;
}
