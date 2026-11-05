import {createElement} from "react";
import {act,create} from "react-test-renderer";
import {afterEach,describe,expect,it,vi} from "vitest";
vi.mock("@/components/editor-preview/color-picker",()=>({ColorPicker:()=>null}));
import {InlineButtonEditor} from "@/components/editor-preview/inline-button-editor";
import {ButtonControls} from "@/components/editor-preview/button-controls";
import {STOREFRONT_TEMPLATES} from "@/lib/editor-preview/storefront-template-library";
afterEach(()=>vi.unstubAllGlobals());
describe("phone button label editing",()=>{
 it("does not open a floating text input when a phone user taps a storefront button",()=>{
  let click:(event:unknown)=>void=()=>{};
  vi.stubGlobal("window",{matchMedia:()=>({matches:true})});
  vi.stubGlobal("document",{addEventListener:(_name:string,handler:typeof click)=>{click=handler;},removeEventListener:vi.fn()});
  const change=vi.fn(),closest=vi.fn();let view:ReturnType<typeof create>;
  act(()=>{view=create(createElement(InlineButtonEditor,{onChange:change}));});
  act(()=>{click({target:{closest}});});
  expect(view!.toJSON()).toBeNull();
  expect(closest).not.toHaveBeenCalled();
  expect(change).not.toHaveBeenCalled();
  act(()=>view!.unmount());
 });
 it("edits the label in the settings panel without losing button styling",()=>{
  const template={...STOREFRONT_TEMPLATES[0],buttonText:"Request a quote",buttonColor:"#123456"};
  const change=vi.fn();let view:ReturnType<typeof create>;
  act(()=>{view=create(createElement(ButtonControls,{template,section:"hero",onChange:change}));});
  const input=view!.root.findByProps({"aria-label":"Button label"});
  expect(input.props.value).toBe("Request a quote");
  act(()=>input.props.onChange({target:{value:"Book now"}}));
  expect(change).toHaveBeenCalledWith({...template,buttonText:"Book now"});
  act(()=>view!.unmount());
 });
});
