import {createElement} from 'react';
import {act,create} from 'react-test-renderer';
import {expect,it,vi} from 'vitest';
import {TextSpacingControl} from '@/components/editor-preview/text-spacing-control';
it('offers matching sliders and numeric values for separate letter and line spacing',()=>{
 const update=vi.fn();let view:ReturnType<typeof create>;
 act(()=>{view=create(createElement(TextSpacingControl,{style:{letterSpacing:0,lineHeight:1.2},onChange:update,controlClass:'control'}));});
 const ranges=view!.root.findAll(node=>node.type==='input'&&node.props.type==='range');expect(ranges).toHaveLength(2);
 act(()=>ranges[0].props.onChange({target:{value:'2'}}));expect(update).toHaveBeenLastCalledWith({letterSpacing:2});
 act(()=>view!.root.findByProps({'aria-label':'Line spacing value'}).props.onChange({target:{value:'1.8'}}));expect(update).toHaveBeenLastCalledWith({lineHeight:1.8});
 act(()=>view!.root.findByProps({'aria-label':'Letter spacing value'}).props.onChange({target:{value:'99'}}));expect(update).toHaveBeenLastCalledWith({letterSpacing:12});
 act(()=>view!.unmount());
});
