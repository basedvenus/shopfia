import {createElement} from "react";
import {act,create} from "react-test-renderer";
import {afterEach,describe,it,expect,vi} from "vitest";
vi.mock("@/components/editor-preview/color-picker",()=>({useTemplatePalette:()=>[],ColorPicker:()=>null}));
import {TextFormatting,useTextSelection,useSelectedTextColor} from "@/components/editor-preview/text-formatting";
afterEach(()=>vi.unstubAllGlobals());
it("retargets color changes to the most recently selected text",()=>{
 vi.stubGlobal("window",new EventTarget());
 vi.stubGlobal("document",{querySelector:()=>({closest:()=>({getAttribute:()=>"all-services"})})});
 vi.stubGlobal("getComputedStyle",()=>({fontFamily:"Arial",color:"rgb(10,20,30)",fontSize:"20px",fontWeight:"400",fontStyle:"normal",textAlign:"left"}));
 let actions:any;const change=vi.fn(),select=vi.fn();
 function Probe(){actions={name:useTextSelection("Storefront name","Moon Matcha",()=>{}),services:useTextSelection("Services heading","Services",()=>{}),color:useSelectedTextColor()};return null;}
 let view:ReturnType<typeof create>;
 act(()=>{view=create(createElement(TextFormatting,{styles:{name:{color:"#112233"}},onChange:change,onSelectText:select,onOpenFonts:()=>{},onOpenColors:()=>{},children:createElement(Probe)}));});
 act(()=>actions.name.onFocus());
 act(()=>actions.services.onFocus());
 act(()=>actions.color.setColor("#ff0000"));
 expect(change.mock.calls.at(-1)?.[0]).toMatchObject({name:{color:"#112233"},"services-heading":{color:"#ff0000"}});
 expect(Object.keys(change.mock.calls.at(-1)?.[0])).toEqual(["name","services-heading"]);
 expect(select).toHaveBeenLastCalledWith("all-services");
 act(()=>view!.unmount());
});
