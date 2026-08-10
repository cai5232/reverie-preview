// fix.js - mem2 badge/card/detail 覆写（override app.js同名函数）
// badge映射：DYNAMIC/PERMANENT/RESOLVED/PLAN，对应filter行那一排
function mem2DomainBadge(b){
  if(typeof b==='string'){const d=b.toLowerCase();return d.includes('plan')?'PLAN':'DYNAMIC'}
  if(!b)return'DYNAMIC'
  if(b.pinned||(b.importance||0)>=9)return'PERMANENT'
  if(b.resolved)return'RESOLVED'
  if((b.domain||'').toLowerCase().includes('plan'))return'PLAN'
  return'DYNAMIC'
}
function mem2BadgeColor(badge){
  if(badge==='PERMANENT')return'#C8956A'
  if(badge==='RESOLVED')return'#8E8E93'
  if(badge==='PLAN')return'#5C6BC0'
  return'#8E8E93'
}
function mem2CardHTML(b,i){
  const{date,title}=mem2ParseName(b.name||b.bucket_id||'')
  const displayTitle=title||(b.name||'未命名')
  const imp=Math.min(10,Math.max(0,parseInt(b.importance)||0))
  const dots=Array.from({length:9},(_,k)=>`<div class="mem2-dot-item${k>=imp?' empty':''}"></div>`).join('')
  const tags=(b.domain||'').split(',').map(t=>t.trim()).filter(Boolean).slice(0,3)
  const tagsHTML=tags.map(t=>`<div class="mem2-tag">${escHtml(t)}</div>`).join('')
  const badge=mem2DomainBadge(b)
  const color=mem2BadgeColor(badge)
  const timeDisplay=date?date.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$2/$3'):''
  const pinEmoji=b.pinned?'📌 ':''
  return`<div class="mem2-card" onclick="mem2OpenDetail(${i})">
    <div class="mem2-card-head"><span class="mem2-card-type" style="color:${color}">${escHtml(badge)}</span>${timeDisplay?`<span class="mem2-card-time">${escHtml(timeDisplay)}</span>`:''}</div>
    <div class="mem2-card-title">${pinEmoji}${escHtml(displayTitle||date||'未命名')}</div>
    <div class="mem2-card-footer"><div class="mem2-dots">${dots}</div><svg class="mem2-heart" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 12S1.5 8.5 1.5 5a2.5 2.5 0 015 0 2.5 2.5 0 015 0C11.5 8.5 7 12 7 12z" stroke="#E5E5EA" stroke-width="1.2"/></svg><div class="mem2-card-tags">${tagsHTML}</div></div>
  </div>`
}
async function mem2OpenDetail(i){
  const b=(_mem2Filtered&&_mem2Filtered[i])||_mem2Data[i]
  if(!b)return
  const overlay=document.getElementById('mem2Overlay')
  const body=document.getElementById('mem2SheetBody')
  const{date,title}=mem2ParseName(b.name||'')
  const displayTitle=title||(b.name||'未命名')
  const badge=mem2DomainBadge(b)
  const color=mem2BadgeColor(badge)
  const imp=Math.min(10,Math.max(0,parseInt(b.importance)||0))
  const dots=Array.from({length:10},(_,k)=>`<div class="mem2-dot-item${k>=imp?' empty':''}"></div>`).join('')
  body.innerHTML=`
    <div class="mem2-sheet-title">${b.pinned?'📌 ':''}${escHtml(displayTitle||date||'未命名')}</div>
    <div class="mem2-sheet-meta" style="color:${color}">${escHtml(badge)}${date?' · '+escHtml(date):''}</div>
    <div class="mem2-sheet-div"></div>
    <div id="mem2SheetContent"><div class="mem2-loading" style="font-size:13px;padding:10px 0">加载内容…</div></div>
    <div class="mem2-sheet-div"></div>
    <div class="mem2-meta-row"><span class="mem2-meta-label">importance</span><div class="mem2-dots">${dots}</div></div>
    <button class="mem2-rest-btn" onclick="mem2CloseDetail()">关闭</button>
    <div class="mem2-sheet-id">${escHtml(b.bucket_id||b.name||'')} · tap to copy</div>`
  overlay.classList.add('open')
  try{
    const proxyBase=(cfg.api||'').replace(/\/v1\/?$/,'')+'/internal/mcp-proxy'
    const query=b.name||b.bucket_id||''
    const res=await fetch(proxyBase,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},body:JSON.stringify({url:'https://caiovo.zeabur.app/mcp',method:'POST',headers:{},body:{jsonrpc:'2.0',id:Date.now(),method:'tools/call',params:{name:'breath_search',arguments:{query,max_results:1}}}})})
    const j=await res.json()
    const raw=j?.data?.result?.content||[]
    const raw2=Array.isArray(raw)?raw.map(c=>c.text||'').join('\n'):''
    // 过滤OB元数据行：[bucket_id:...] [content_role:...] 等
    const text=raw2.split('\n').filter(l=>{
      const t=l.trim()
      if(!t)return false
      if(/^\[[\w_]+:[^\]]*\]$/.test(t))return false  // 纯元数据行如 [bucket_id:xxx]
      if(/^\[[\w_]+:[^\]]*\]\s*\[[\w_]+:[^\]]*\]/.test(t))return false  // 多个元数据连在一行
      return true
    }).join('\n').trim()
    const el=document.getElementById('mem2SheetContent')
    if(el)el.innerHTML=text?`<div class="mem2-sheet-content">${escHtml(text)}</div>`:'<div class="mem2-sheet-content" style="color:#aaa">（无内容）</div>'
  }catch(e){
    const el=document.getElementById('mem2SheetContent')
    if(el)el.innerHTML=`<div class="mem2-sheet-content" style="color:#f66">加载失败</div>`
  }
}
