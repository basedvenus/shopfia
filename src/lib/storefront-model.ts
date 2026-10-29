export const MODEL_TYPE = 'model/gltf-binary';
export const MODEL_JOB_TYPE = 'application/x-shopfia-meshy-job';
export const MAX_MODEL_BYTES = 4 * 1024 * 1024;
export function validateGlb(bytes: Buffer) {
  if (bytes.length < 24 || bytes.length > MAX_MODEL_BYTES || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Choose a valid GLB under 4 MB.');
  const length = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== 0x4e4f534a || length > bytes.length - 20) throw new Error('The GLB is incomplete. Export it again with embedded textures.');
  const doc = JSON.parse(bytes.subarray(20,20+length).toString('utf8'));
  if (doc.asset?.version !== '2.0' || !doc.meshes?.length) throw new Error('This file does not contain a 3D mesh.');
  if ((doc.extensionsUsed || []).some((name:string)=>['KHR_draco_mesh_compression','KHR_texture_basisu','EXT_meshopt_compression'].includes(name))) throw new Error('Export an uncompressed GLB with standard PNG or JPG textures.');
  // Embedded GLBs only: no network requests to vendor-controlled texture URLs.
  const check=(node:unknown):void=>{if(!node || typeof node!=='object')return;for(const [key,value] of Object.entries(node)){if(key==='uri')throw new Error('Export a self-contained GLB with embedded textures.');check(value);}};
  check(doc);
}
export function isMeshyAsset(value:string) {
  try { const url=new URL(value); return url.protocol==='https:' && (url.hostname==='assets.meshy.ai' || url.hostname.endsWith('.assets.meshy.ai')) && !url.username && !url.password && (!url.port || url.port==='443'); } catch { return false; }
}
export async function fetchModel(value:string) {
  if(!isMeshyAsset(value)) throw new Error('The generation service returned an unsupported model address.');
  const response=await fetch(value,{redirect:'error',signal:AbortSignal.timeout(25000)});
  if(!response.ok || !response.body)throw new Error('Could not download the model. Try checking again.');
  const reader=response.body.getReader(), chunks:Buffer[]=[];let size=0;
  try { for(;;){const {done,value:chunk}=await reader.read();if(done)break;size+=chunk.length;if(size>MAX_MODEL_BYTES)throw new Error('The generated model exceeds 4 MB. Download and optimize it in Meshy, then upload the GLB.');chunks.push(Buffer.from(chunk));} } finally { await reader.cancel(); }
  const bytes=Buffer.concat(chunks);validateGlb(bytes);return bytes;
}
