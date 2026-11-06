import React from "react";
import {act,create,type ReactTestRenderer} from "react-test-renderer";
import {afterEach,expect,it} from "vitest";
import {ServicePhotoGrid} from "@/components/vendor/service-photo-grid";
let view:ReactTestRenderer;
afterEach(()=>{if(view)act(()=>view.unmount());});
function mount(photos:string[]){act(()=>{view=create(React.createElement(ServicePhotoGrid,{photos}));});}
function values(){return view.root.findAllByType("input").filter(node=>node.props.name==="photos").map(node=>node.props.value);}
it("keeps more than ten photos and makes the first photo the cover",()=>{mount(Array.from({length:12},(_,i)=>`/photo-${i}.jpg`));expect(values()).toHaveLength(12);expect(view.root.findByProps({"aria-label":"Edit service photo 1, cover"})).toBeDefined();});
it("dragging a photo to the first position changes the cover and serialized order",()=>{mount(["/one.jpg","/two.jpg","/three.jpg"]);const cards=view.root.findAll(node=>Boolean(node.props["data-service-photo"]));act(()=>cards[2].props.onDragStart({dataTransfer:{setData(){}}}));act(()=>cards[0].props.onDrop({preventDefault(){},stopPropagation(){},dataTransfer:{files:[]}}));expect(values()).toEqual(["/three.jpg","/one.jpg","/two.jpg"]);});
it("supports keyboard reordering",()=>{mount(["/one.jpg","/two.jpg"]);act(()=>view.root.findByProps({"aria-label":"Move service photo 2"}).props.onKeyDown({key:"ArrowLeft",preventDefault(){}}));expect(values()).toEqual(["/two.jpg","/one.jpg"]);});
