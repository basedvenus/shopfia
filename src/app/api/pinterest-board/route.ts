import { getPinterestBoard } from "@/lib/party-media";

/** Isolate Pinterest's official widget from the app and its authenticated session. */
export function GET(request: Request) {
  const board = getPinterestBoard(new URL(request.url).searchParams.get("url"));
  if (!board) return new Response("A public Pinterest board URL is required.", { status: 400 });
  const boardJson = JSON.stringify(board).replace(/</g, "\\u003c");
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pinterest mood board</title><style>html,body{margin:0;background:#fff;font-family:system-ui,sans-serif}body{padding:0 4px}#board{width:100%;text-align:center}#status{padding:16px;color:#625c57;font-size:14px}a{color:inherit}</style></head><body><div id="board"></div><p id="status" role="status">Loading Pinterest board…</p><script>
requestAnimationFrame(()=>requestAnimationFrame(()=>{
const root=document.getElementById('board');
const anchor=document.createElement('a');
anchor.href=${boardJson};
anchor.dataset.pinDo='embedBoard';
anchor.dataset.pinBoardWidth=String(Math.max(130,window.innerWidth-28));
anchor.dataset.pinScaleHeight='330';
anchor.dataset.pinScaleWidth='100';
root.appendChild(anchor);
const observer=new MutationObserver(()=>{if(root.querySelector('[data-pin-log]')){document.getElementById('status').hidden=true;observer.disconnect();}});
observer.observe(root,{childList:true,subtree:true});
setTimeout(()=>{const status=document.getElementById('status');if(!status.hidden)status.textContent='Pinterest could not load this preview. Use the board link below to view its pins.';},12000);
const script=document.createElement('script');script.src='https://assets.pinterest.com/js/pinit.js';script.async=true;document.body.appendChild(script);
}));
</script></body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600", "X-Frame-Options": "SAMEORIGIN" }
  });
}
