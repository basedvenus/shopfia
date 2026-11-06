import React from "react";
import {act,create,type ReactTestRenderer} from "react-test-renderer";
import {afterEach,expect,it,vi} from "vitest";
import {ServicePhotos} from "@/components/vendor/service-photos";
let view:ReactTestRenderer;
afterEach(()=>{if(view)act(()=>view.unmount());vi.useRealTimers();vi.unstubAllGlobals();});
function mount(reduced=false){
 vi.useFakeTimers();
 vi.stubGlobal("ResizeObserver",class{observe(){}disconnect(){}});
 vi.stubGlobal("matchMedia",(q:string)=>({matches:q.includes("reduced-motion")?reduced:true,addEventListener(){},removeEventListener(){}}));
 vi.stubGlobal("IntersectionObserver",class{constructor(private callback:Function){}observe(){this.callback([{isIntersecting:true}]);}disconnect(){}});
 act(()=>{view=create(React.createElement(ServicePhotos,{photos:["/first.jpg","/second.jpg"],title:"Service"}),{createNodeMock:()=>({closest:()=>null,clientWidth:200,clientHeight:200})});});
}
it("rotates visible mobile service photos and uses a square filled crop",()=>{mount();expect(view.root.findByType("img").props.src).toBe("/first.jpg");act(()=>{vi.advanceTimersByTime(3000);});expect(view.root.findByType("img").props.src).toBe("/second.jpg");expect(view.root.findByType("img").props.className).toContain("object-cover");});
it("respects reduced motion",()=>{mount(true);act(()=>{vi.advanceTimersByTime(6000);});expect(view.root.findByType("img").props.src).toBe("/first.jpg");});

it("renders the same saved square crop geometry as the crop editor",()=>{mount();const crop={x:50,y:100,zoom:1.5};act(()=>view.update(React.createElement(ServicePhotos,{photos:["/portrait.jpg"],title:"Cart",crops:[crop]})));act(()=>view.root.findByType("img").props.onLoad({currentTarget:{naturalWidth:800,naturalHeight:1600}}));const style=view.root.findByType("img").props.style;expect(style.width).toBe(300);expect(style.height).toBe(600);expect(style.left).toBe(-50);expect(style.top).toBe(-400);expect(JSON.stringify(view.toJSON())).not.toContain("1 / 1");});
