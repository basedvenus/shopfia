"use client";

import { useEffect, useRef, useState } from "react";

export type LogoMount = "round" | "square" | "artwork";

// A single, textured, bevelled brand emblem. Draw on demand and stop at rest.
export function StorefrontBrandSculpture({ image, name, interactive, mount, edgeColor, touchPreview, onReady }: { image: string; name: string; interactive: boolean; mount: LogoMount; edgeColor: string; touchPreview: boolean; onReady?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const turnRef = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true, powerPreference: "low-power" });
    if (!gl) return;
    let disposed = false;
    let frame = 0;
    let visible = true;
    let loaded = false;
    let lost = false;
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const hover = window.matchMedia("(hover: hover) and (pointer: fine)");
    let turning = false;
    let targetX = -.22, targetY = -.48;
    let currentX = -.22, currentY = -.48;
    const shader = (kind: number, source: string) => {
      const result = gl.createShader(kind);
      if (!result) return null;
      gl.shaderSource(result, source); gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) { gl.deleteShader(result); return null; }
      return result;
    };
    const vertex = shader(gl.VERTEX_SHADER, `
      attribute vec3 aPosition; attribute vec3 aNormal; attribute vec2 aUv;
      uniform vec2 uRotation; uniform float uAspect;
      varying vec3 vNormal; varying vec3 vPosition; varying vec2 vUv;
      void main() {
        float cx=cos(uRotation.x), sx=sin(uRotation.x), cy=cos(uRotation.y), sy=sin(uRotation.y);
        mat3 rx=mat3(1.,0.,0., 0.,cx,sx, 0.,-sx,cx);
        mat3 ry=mat3(cy,0.,-sy, 0.,1.,0., sy,0.,cy);
        float cz=cos(-.16), sz=sin(-.16);
        mat3 rz=mat3(cz,sz,0., -sz,cz,0., 0.,0.,1.);
        mat3 rotation=rz*ry*rx;
        vec3 p=rotation*aPosition;
        vNormal=rotation*aNormal; vPosition=p; vUv=aUv;
        float z=p.z-3.7;
        gl_Position=vec4(p.x*2.55/uAspect,p.y*2.55,-1.002*z-.2002,-z);
      }
    `);
    const fragment = shader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform sampler2D uImage; uniform bool uArtwork; uniform vec3 uEdge;
      varying vec3 vNormal; varying vec3 vPosition; varying vec2 vUv;
      void main() {
        vec3 n=normalize(vNormal);
        vec3 light=normalize(vec3(-1.5,2.,3.));
        vec3 view=normalize(vec3(0.,0.,3.7)-vPosition);
        float diffuse=max(dot(n,light),0.);
        float spec=pow(max(dot(n,normalize(light+view)),0.),44.);
        bool side=vUv.x < -1.;
        vec4 sampleColor=side ? vec4(uEdge,1.) : texture2D(uImage,vUv);
        if(uArtwork && (side || sampleColor.a<.15)) discard;
        vec3 base=sampleColor.rgb;
        float rim=pow(1.-max(dot(n,view),0.),3.);
        vec3 color=base*(.58+.36*diffuse)+vec3(1.,.96,.83)*spec*.22+vec3(.11,.13,.06)*rim;
        gl_FragColor=vec4(color,1.);
      }
    `);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) { if (vertex) gl.deleteShader(vertex); if (fragment) gl.deleteShader(fragment); if (program) gl.deleteProgram(program); return; }
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment); return; }
    gl.useProgram(program);
    const data: number[] = [];
    const push = (x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number) => data.push(x,y,z,nx,ny,nz,u,v);
    const segments = 96;
    // A bevel around both faces gives the edge a real highlight, rather than a flat cutout.
    const rings = [{r:.94,z:.15},{r:1,z:.09},{r:1,z:-.09},{r:.94,z:-.15}];
    for (let i=0;i<segments;i++) {
      const a=i/segments*Math.PI*2, b=(i+1)/segments*Math.PI*2;
      const boundary=(value:number)=>mount === "round" ? value : Math.sign(value)*Math.pow(Math.abs(value),mount === "square" ? .28 : .07)*.84;
      const ca=boundary(Math.cos(a)), sa=boundary(Math.sin(a)), cb=boundary(Math.cos(b)), sb=boundary(Math.sin(b));
      push(0,0,.15,0,0,1,.5,.5);
      const uvScale=mount === "round" ? 1 : 1/.84;
      push(ca*.94,sa*.94,.15,0,0,1,ca*uvScale*.5+.5,sa*uvScale*.5+.5);
      push(cb*.94,sb*.94,.15,0,0,1,cb*uvScale*.5+.5,sb*uvScale*.5+.5);
      push(0,0,-.15,0,0,-1,-2,0);
      push(cb*.94,sb*.94,-.15,0,0,-1,-2,0);
      push(ca*.94,sa*.94,-.15,0,0,-1,-2,0);
      for (let j=0;j<rings.length-1;j++) {
        const p=rings[j], q=rings[j+1];
        const nz=j===0?.7:j===2?-.7:0;
        const point=(c:number,s:number,r:number,z:number)=>push(c*r,s*r,z,c,s,nz,-2,0);
        point(ca,sa,p.r,p.z);point(ca,sa,q.r,q.z);point(cb,sb,p.r,p.z);
        point(cb,sb,p.r,p.z);point(ca,sa,q.r,q.z);point(cb,sb,q.r,q.z);
      }
    }
    const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
    for (const [attr,size,offset] of [["aPosition",3,0],["aNormal",3,12],["aUv",2,24]] as const) {
      const loc=gl.getAttribLocation(program,attr); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,size,gl.FLOAT,false,32,offset);
    }
    const rotation=gl.getUniformLocation(program,"uRotation"), aspect=gl.getUniformLocation(program,"uAspect");
    const texture=gl.createTexture();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program,"uImage"),0);
    gl.uniform1i(gl.getUniformLocation(program,"uArtwork"),mount === "artwork" ? 1 : 0);
    const color=/^#[0-9a-f]{6}$/i.test(edgeColor) ? edgeColor : "#877a78";
    gl.uniform3f(gl.getUniformLocation(program,"uEdge"),parseInt(color.slice(1,3),16)/255,parseInt(color.slice(3,5),16)/255,parseInt(color.slice(5,7),16)/255);
    gl.enable(gl.DEPTH_TEST);
    function draw() {
      frame=0;
      if (disposed || lost || !visible || !loaded) return;
      currentX+=(targetX-currentX)*.1; currentY+=(targetY-currentY)*.1;
      gl!.viewport(0,0,canvas!.width,canvas!.height); gl!.clearColor(0,0,0,0); gl!.clear(gl!.COLOR_BUFFER_BIT|gl!.DEPTH_BUFFER_BIT);
      gl!.uniform2f(rotation,currentX,currentY); gl!.uniform1f(aspect,canvas!.width/canvas!.height);
      gl!.drawArrays(gl!.TRIANGLES,0,data.length/8);
      if (Math.abs(targetX-currentX)+Math.abs(targetY-currentY)>.001) frame=requestAnimationFrame(draw);
      else if (turning) {turning=false; currentY=targetY=((currentY+Math.PI)%(Math.PI*2))-Math.PI;}
    }
    const schedule=()=>{if (!frame && !disposed && !lost) frame=requestAnimationFrame(draw);};
    const resize=new ResizeObserver(()=>{
      const rect=canvas.getBoundingClientRect(), dpr=Math.min(window.devicePixelRatio||1,1.5);
      canvas.width=Math.max(1,Math.round(rect.width*dpr)); canvas.height=Math.max(1,Math.round(rect.height*dpr)); schedule();
    }); resize.observe(canvas);
    const visibility=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting; if(visible) schedule(); else {cancelAnimationFrame(frame);frame=0;}}); visibility.observe(canvas);
    const move=(event:PointerEvent)=>{
      if (touchPreview || !interactive || !motion.matches || !hover.matches || turning || event.pointerType!=="mouse") return;
      const bounds=canvas.getBoundingClientRect();
      targetY=-.48+(event.clientX-bounds.left-bounds.width/2)/bounds.width*.9;
      targetX=-.22-(event.clientY-bounds.top-bounds.height/2)/bounds.height*.5; schedule();
    };
    const leave=()=>{if(turning)return;targetX=-.22;targetY=-.48;schedule();};
    const scroll=()=>{
      if (touchPreview || !interactive || !motion.matches || !hover.matches || !visible || turning) return;
      const rect=canvas.getBoundingClientRect();
      const progress=Math.max(0,Math.min(1,(90-rect.top)/Math.max(rect.height,1)));
      targetY=-.48-progress*1.1; targetX=-.22+progress*.15; schedule();
    };
    turnRef.current=()=>{if(!interactive || !motion.matches || !loaded || turning)return;turning=true;targetY=currentY+Math.PI*2;schedule();};
    const preference=()=>{turning=false;currentX=targetX=-.22;currentY=targetY=-.48;schedule();};
    const contextLost=(event:Event)=>{event.preventDefault();lost=true;cancelAnimationFrame(frame);frame=0;setReady(false);};
    canvas.addEventListener("pointermove",move); canvas.addEventListener("pointerleave",leave); canvas.addEventListener("webglcontextlost",contextLost); motion.addEventListener("change",preference); window.addEventListener("scroll",scroll,{capture:true,passive:true});
    const asset=new Image(); asset.crossOrigin="anonymous";
    asset.onload=()=>{
      if(disposed || lost) return;
      try {
        // Normalize to a square texture without stretching the vendor's logo.
        const tile=document.createElement("canvas");tile.width=tile.height=512;const ctx=tile.getContext("2d");if(!ctx)return;
        if(mount !== "artwork") {ctx.fillStyle="#f5f0e7";ctx.fillRect(0,0,512,512);}
        const scale=460/Math.max(asset.width,asset.height),w=asset.width*scale,h=asset.height*scale;ctx.drawImage(asset,(512-w)/2,(512-h)/2,w,h);
        gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,tile);
        loaded=true;setReady(true);onReady?.();
        if(interactive && motion.matches) {currentY=-1.8; currentX=.12;}
        schedule();
      } catch {setReady(false);}
    };
    asset.src=image;
    return ()=>{
      turnRef.current=null;disposed=true;cancelAnimationFrame(frame);resize.disconnect();visibility.disconnect();asset.onload=null;asset.onerror=null;
      canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerleave",leave);canvas.removeEventListener("webglcontextlost",contextLost);motion.removeEventListener("change",preference);window.removeEventListener("scroll",scroll,true);
      gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
    };
  }, [image, interactive, mount, edgeColor, touchPreview, onReady]);
  return <div className="brand-sculpture">
    {/* The real saved asset is also the no-WebGL / failed-texture fallback. */}
    <div className={`sculpture-fallback mount-${mount}`} style={{opacity:ready?0:1}}>{image ? <img src={image} alt="" /> : <span>{name || "Your brand"}</span>}</div>
    {interactive && ready ? <button type="button" className="sculpture-turn" onClick={(event)=>{event.stopPropagation();turnRef.current?.();}}>Turn logo ↻</button> : null}
    <canvas ref={canvasRef} role="img" aria-label={`${name || "Storefront"} sculptural brand emblem`} style={{opacity:ready?1:0}} />
  </div>;
}
