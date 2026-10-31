import {createElement,useState} from 'react';
import {act,create} from 'react-test-renderer';
import {describe,it,expect} from 'vitest';
import {useEditorHistory} from '@/hooks/use-editor-history';
describe('editor undo and redo',()=>{
 it('restores deleted content and clears redo after a new edit',()=>{
  let api:any;
  function Editor(){const [value,setValue]=useState({hidden:[] as string[],font:'A'});const history=useEditorHistory(value,setValue);api={value,setValue,...history};return null;}
  let view:ReturnType<typeof create>;
  act(()=>{view=create(createElement(Editor));});
  expect(api.canUndo).toBe(false);
  act(()=>api.setValue({hidden:['portfolio'],font:'B'}));
  expect(api.canUndo).toBe(true);
  act(()=>api.undo());
  expect(api.value).toEqual({hidden:[],font:'A'});
  expect(api.canRedo).toBe(true);
  act(()=>api.redo());
  expect(api.value.hidden).toEqual(['portfolio']);
  act(()=>api.undo());
  act(()=>api.setValue({hidden:[],font:'C'}));
  expect(api.canRedo).toBe(false);
  act(()=>view!.unmount());
 });
});
