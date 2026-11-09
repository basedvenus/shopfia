import * as React from "react";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/components/ui/image-crop-editor",()=>({ImageCropEditor:()=>null}));
import { ImageCropEditor } from "@/components/ui/image-crop-editor";
import { ImageUploadField } from "@/components/ui/image-upload-field";
let root: ReactTestRenderer;
const oldCrop={x:50,y:55,zoom:1};
const newCrop={x:45,y:60,zoom:2};
const completed=vi.fn();
beforeEach(()=>{vi.stubGlobal("React",React);vi.stubGlobal("document",{addEventListener:vi.fn(),removeEventListener:vi.fn()});completed.mockClear();});
afterEach(()=>{act(()=>root?.unmount());vi.unstubAllGlobals();});
function openCrop(){act(()=>{root=create(createElement(ImageUploadField,{editMenu:true,rounded:"full",name:"image",label:"Profile picture",value:"/saved.jpg",valueCrop:oldCrop,uploadEndpoint:"/api/uploads/avatar",onUploadComplete:completed}));});act(()=>root.root.findByProps({title:"Adjust image"}).props.onClick());act(()=>root.root.findAllByType("button").find(node=>node.props.children==="Crop picture")!.props.onClick());return root.root.findByType(ImageCropEditor);}
it("persists existing-photo crops immediately instead of only changing the preview",async()=>{const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({url:"/saved.jpg",profile:{id:"user_1",imageCrop:newCrop},persisted:true})});vi.stubGlobal("fetch",fetcher);const editor=openCrop();await act(async()=>editor.props.onSave(newCrop));expect(fetcher).toHaveBeenCalledWith("/api/uploads/avatar",expect.objectContaining({method:"PATCH",body:JSON.stringify({image:"/saved.jpg",crop:newCrop})}));expect(completed).toHaveBeenCalled();expect(root.root.findAllByType(ImageCropEditor)).toHaveLength(0);});
it("keeps the saved crop and exposes an error when persistence fails",async()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,json:async()=>({error:"Try again"})}));const editor=openCrop();await act(async()=>editor.props.onSave(newCrop));expect(completed).not.toHaveBeenCalled();expect(root.root.findByType(ImageCropEditor).props.errorMessage).toBe("Try again");const hidden=root.root.findAllByType("input").find(node=>node.props.name==="imageCrop")!;expect(JSON.parse(hidden.props.value)).toMatchObject(oldCrop);});
