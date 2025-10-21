"use client";

import { memo, useEffect, useMemo, useState } from "react";

export type V0CardEvent = {
  id: string;
  type: string;
  detail: Record<string, any>;
};

export const V0Card = memo(function V0Card({
  id,
  html,
  onEvent,
}: {
  id: string;
  html: string;
  onEvent?: (evt: V0CardEvent) => void;
}) {
  const [height, setHeight] = useState(260);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as any;
      if (!d || d.__v0card !== true || d.id !== id) return;

      // Always forward the raw event to the caller
      if (typeof onEvent === "function") {
        try {
          onEvent({ id, type: String(d.type ?? ""), detail: (d.detail ?? {}) as Record<string, any> });
        } catch {
          // swallow user callback errors to avoid breaking sizing
        }
      }

      // Built-in handling for size updates
      if (d.type === "size" && typeof d.detail?.height === "number") {
        const h = Math.min(Math.max(d.detail.height, 120), 2000);
        setHeight(h);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [id, onEvent]);

  const srcDoc = useMemo(() => {
    const bridge = `
<script>
(function(){
  const ID=${JSON.stringify(id)};
  const post=(type,detail)=>parent.postMessage({__v0card:true,id:ID,type,detail},"*");
  const sendSize=()=>{try{
    const h=document.documentElement.scrollHeight||document.body.scrollHeight||260;
    post("size",{height:h});
  }catch(_){}};
  new ResizeObserver(sendSize).observe(document.documentElement);
  window.addEventListener("load",()=>sendSize()); setTimeout(sendSize,50);

  function bySlot(slotId){ return document.querySelector('[data-slot-id="'+slotId+'"]'); }
  function bySel(sel){ try { return document.querySelector(sel); } catch { return null; } }

  window.addEventListener("message",(e)=>{
    const m=e.data; if(!m||m.__v0parent!==true||m.id!==ID) return;

    if(m.type==="set-text"){
      const el = m.selector ? bySel(m.selector) : (m.slotId ? bySlot(m.slotId) : null);
      if(el){ el.textContent = m.text ?? ""; sendSize(); }
      else { post("error",{ message:"Target not found for set-text", target:m.slotId||m.selector }); }
      return;
    }

    if(m.type==="replace-slot"){
      const el = m.selector ? bySel(m.selector) : (m.slotId ? bySlot(m.slotId) : null);
      if(el){
        el.innerHTML = m.html || "";
        const first=el.firstElementChild;
        if(first && first.tagName && first.tagName.toLowerCase()==="svg"){
          first.setAttribute("style",(first.getAttribute("style")||"")+";display:block;width:100%");
        }
        sendSize();
      } else {
        post("error",{ message:"Target not found for replace-slot", target:m.slotId||m.selector });
      }
      return;
    }

    if(m.type==="set-attrs"){
      const el = m.selector ? bySel(m.selector) : (m.slotId ? bySlot(m.slotId) : null);
      if(el && m.attrs && typeof m.attrs==="object"){
        for(const k in m.attrs){
          const v=m.attrs[k];
          if(v==null) el.removeAttribute(k); else el.setAttribute(k,String(v));
        }
        sendSize();
      } else {
        post("error",{ message:"Target not found for set-attrs", target:m.slotId||m.selector });
      }
      return;
    }

    if(m.type==="set-cssvars"){
      const root=document.documentElement;
      const vars=m.vars||{};
      for(const k in vars){ root.style.setProperty("--"+k,String(vars[k])); }
      return;
    }
  });
})();
</script>`;
    return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>
      :root{--accent:#60a5fa}
      html,body{margin:0;padding:0;background:transparent;color:#e5e7eb;font:14px system-ui}
      table{width:100%;border-collapse:collapse}
      th,td{border-bottom:1px solid #334155;padding:6px 8px;text-align:left}
    </style></head><body>${bridge}${html}</body></html>`;
  }, [id, html]);

  return (
    <div className="overflow-hidden rounded-2xl border bg-background dark:border-zinc-700">
      <iframe
        title={`v0-card-${id}`}
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-forms"
        className="block w-full"
        style={{ height }}
      />
    </div>
  );
});
