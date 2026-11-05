import type {CSSProperties} from 'react';
import type {SectionDesign} from './storefront-template-library';
import {sectionDesignStyle} from './template-section-design';
/** Keep several repeats visible in a small swatch without changing the page's pattern scale. */
export function patternPreviewStyle(design:SectionDesign):CSSProperties {
 const color=design.patternColor??design.ink;
 const style=sectionDesignStyle({...design,patternOpacity:1,overlayOpacity:0,patternColor:color});
 if(design.pattern==='stripes')return {...style,backgroundImage:`repeating-linear-gradient(90deg,transparent 0 4px,${color} 4px 8px)`,backgroundSize:'auto'};
 if(design.pattern==='clouds')return {...style,backgroundSize:'100% 100%',backgroundPosition:'center'};
 if(design.pattern==='grid'||design.pattern==='dots')return {...style,backgroundSize:'8px 8px'};
 if(design.pattern==='checker')return {...style,backgroundSize:'14px 14px'};
 if(design.pattern==='waves')return {...style,backgroundImage:`radial-gradient(circle at 6px 0,${color} 6px,transparent 6.5px)`,backgroundSize:'12px 12px'};
 return style;
}
