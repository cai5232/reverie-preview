// fix.js v17 — debug helpers + current mem2Load
function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

function mem2BadgeColor(b){
  if(b==='PERMANENT')return'#C8956A'
  if(b==='RESOLVED')return'#8E8E93'
  if(b==='PLAN')return'#5C6BC0'
  return'#8E8E93'
}
function mem2DomainBadge(b){
  if(typeof b==='string'){return b.toLowerCase().includes('plan')?'PLAN':'DYNAMIC'}
  if(!b)return'DYNAMIC'
  if(b.pinned||(b.importance||0)>=9)return'PERMANENT'
  if(b.resolved)return'RESOLVED'
  if((b.domain||'').toLowerCase().includes('plan'))return'PLAN'
  return'DYNAMIC'
}
function mem2ParseName(name){
  // 先剥 📌 前缀
  let s=(name||'').replace(/^[\uD83D\uDCCC\s]+/,'').replace(/^📌\s*/,'').trim()
  // 格式: 2026-07-24 08-31-37 标题
  const m=s.match(/^(\d{4}-\d{2}-\d{2})\s+\d{2}-\d{2}-\d{2}\s+(.+)$/)
  if(m)return{date:m[1],title:m[2].trim()}
  // 格式: 2026-07-24 标题
  const m2=s.match(/^(\d{4}-\d{2}-\d{2})[_\s-]+(.+)$/)
  if(m2)return{date:m2[1],title:m2[2].trim()}
  return{date:'',title:s}
}
function mem2LooksLikeId(s){
  return /^[\d\-]+$/.test((s||'').trim())
}

let _mem2All=[]
let _mem2Filtered=[]
let _mem2Filter='all'
let _mem2Query=''
let _mem2Loading=false

function mem2ProxyBase(){
  const c=typeof cfg!=='undefined'?cfg:(window._cfg||{})
  return(c.api||'').replace(/\/v1\/?$/,'')+'/internal/mcp-proxy'
}
function mem2Headers(){
  const c=typeof cfg!=='undefined'?cfg:(window._cfg||{})
  return{'Content-Type':'application/json','Authorization':'Bearer '+(c.key||'')}
}
async function mem2McpCall(toolName,args){
  const res=await fetch(mem2ProxyBase(),{
    method:'POST',headers:mem2Headers(),
    body:JSON.stringify({
      url:'https://caiovo.zeabur.app/mcp',method:'POST',headers:{},
      body:{jsonrpc:'2.0',id:Date.now(),method:'tools/call',
        params:{name:toolName,arguments:args}}
    })
  })
  const j=await res.json()
  return j?.data?.result?.content||[]
}

// 调试：看 breath_advanced 原始返回
async function mem2DebugRaw(){
  const box=document.getElementById('mem2DebugBox')
  if(!box)return
  box.style.display='block'
  box.textContent='拉取中…'
  try{
    const blocks=await mem2McpCall('breath_advanced',{max_results:3,max_tokens:2000})
    box.textContent='=== breath_advanced(max_results=3) ===\n\nblocks.length: '+blocks.length+'\n\n'+
      blocks.map((b,i)=>'--- block['+i+'] type='+b.type+' ---\n'+(b.text||'(empty)')).join('\n\n')
  }catch(e){
    box.textContent='ERROR: '+String(e)
  }
}

// 调试：看 catalog 原始返回
async function mem2DebugCatalog(){
  const box=document.getElementById('mem2DebugBox')
  if(!box)return
  box.style.display='block'
  box.textContent='拉取中…'
  try{
    const blocks=await mem2McpCall('breath_advanced',{catalog:true,max_results:5})
    box.textContent='=== breath_advanced(catalog=true, max_results=5) ===\n\nblocks.length: '+blocks.length+'\n\n'+
      blocks.map((b,i)=>'--- block['+i+'] type='+b.type+' ---\n'+(b.text||'(empty)')).join('\n\n')
  }catch(e){
    box.textContent='ERROR: '+String(e)
  }
}

async function mem2Load(force){
  if(!force&&_mem2All.length>0){mem2Render();return}
  if(_mem2Loading)return
  _mem2Loading=true
  const statusDot=document.getElementById('mem2StatusDot')
  const statusText=document.getElementById('mem2StatusText')
  const list=document.getElementById('mem2List')
  if(statusDot)statusDot.style.background='#FF9500'
  if(statusText)statusText.textContent='Loading…'
  if(list)list.innerHTML='<div class="mem2-loading">加载中…</div>'
  try{
    const blocks=await mem2McpCall('breath_advanced',{catalog:true,max_results:100})
    const rows=[]
    blocks.forEach(b=>{
      (b.text||'').split('\n').forEach(line=>{
        const parts=line.split('|').map(s=>s.trim())
        if(parts.length>=2&&parts[0]&&!/^工具/.test(parts[0])){
          rows.push({
            bucket_id:parts[0],
            name:parts[0],
            domain:parts[1]||'',
            importance:parseInt(parts[2])||0
          })
        }
      })
    })
    _mem2All=rows
    if(statusDot)statusDot.style.background='#34C759'
    if(statusText)statusText.textContent='Memory · '+rows.length+' records'
    mem2Render()
  }catch(e){
    if(statusDot)statusDot.style.background='#FF3B30'
    if(statusText)statusText.textContent='加载失败'
    if(list)list.innerHTML='<div class="mem2-loading" style="color:#f66">'+escHtml(String(e))+'</div>'
  }finally{
    _mem2Loading=false
  }
}

function mem2Render(){
  const list=document.getElementById('mem2List')
  if(!list)return
  let arr=_mem2All
  if(_mem2Filter&&_mem2Filter!=='all'){
    arr=arr.filter(b=>{
      if(_mem2Filter==='pinned')return b.pinned
      return mem2DomainBadge(b).toLowerCase()===_mem2Filter
    })
  }
  if(_mem2Query){
    const q=_mem2Query.toLowerCase()
    arr=arr.filter(b=>{
      const{title}=mem2ParseName(b.name||'')
      return(b.name||'').toLowerCase().includes(q)||
        title.toLowerCase().includes(q)||
        (b.domain||'').toLowerCase().includes(q)
    })
  }
  _mem2Filtered=arr
  if(!arr.length){
    list.innerHTML='<div class="mem2-loading">'+(_mem2All.length?'没有匹配的记忆':'点上方“查看目录数据”按鈕调试')+'</div>'
    return
  }
  list.innerHTML=arr.map((b,i)=>mem2CardHTML(b,i)).join('')
}

function mem2CardHTML(b,i){
  const{date,title}=mem2ParseName(b.name||b.bucket_id||'')
  let displayTitle=title
  if(!displayTitle||mem2LooksLikeId(displayTitle)){
    displayTitle=(b.domain||'').split(',')[0].trim()||(b.bucket_id||'').slice(-8)||'未命名'
  }
  const imp=Math.min(10,Math.max(0,parseInt(b.importance)||0))
  const dots=Array.from({length:9},(_,k)=>`<div class="mem2-dot-item${k<imp?'':' empty'}"></div>`).join('')
  const tags=(b.domain||'').split(',').map(t=>t.trim()).filter(Boolean).slice(0,3)
  const tagsHTML=tags.map(t=>`<div class="mem2-tag">${escHtml(t)}</div>`).join('')
  const badge=mem2DomainBadge(b)
  const color=mem2BadgeColor(badge)
  const timeDisplay=date?date.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$2/$3'):''
  return`<div class="mem2-card" onclick="mem2OpenDetail(${i})">
    <div class="mem2-card-head"><span class="mem2-card-type" style="color:${color}">${escHtml(badge)}</span>${timeDisplay?`<span class="mem2-card-time">${escHtml(timeDisplay)}</span>`:''}</div>
    <div class="mem2-card-title">${b.pinned?'\uD83D\uDCCC ':''} ${escHtml(displayTitle)}</div>
    <div class="mem2-card-footer"><div class="mem2-dots">${dots}</div><svg class="mem2-heart" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 12S1.5 8.5 1.5 5a2.5 2.5 0 015 0 2.5 2.5 0 015 0C11.5 8.5 7 12 7 12z" stroke="#E5E5EA" stroke-width="1.2"/></svg><div class="mem2-card-tags">${tagsHTML}</div></div>
  </div>`
}

async function mem2OpenDetail(i){
  const b=(_mem2Filtered.length?_mem2Filtered[i]:_mem2All[i])
  if(!b)return
  const overlay=document.getElementById('mem2Overlay')
  const body=document.getElementById('mem2SheetBody')
  const{date,title}=mem2ParseName(b.name||b.bucket_id||'')
  let displayTitle=title||b.name||'未命名'
  const badge=mem2DomainBadge(b)
  const color=mem2BadgeColor(badge)
  const imp=Math.min(10,Math.max(0,parseInt(b.importance)||0))
  const dots=Array.from({length:10},(_,k)=>`<div class="mem2-dot-item${k<imp?'':' empty'}"></div>`).join('')
  const tags=(b.domain||'').split(',').map(t=>t.trim()).filter(Boolean)
  const tagsHTML=tags.map(t=>`<span style="font-size:11px;color:#8E8E93;background:#F2F2F7;border-radius:6px;padding:2px 8px">${escHtml(t)}</span>`).join('')
  body.innerHTML=`
    <div style="font-size:18px;font-weight:700;color:#1C1C1E;line-height:1.4;margin-bottom:6px">${b.pinned?'📌 ':''}${escHtml(displayTitle)}</div>
    <div style="font-size:13px;color:${color};margin-bottom:12px">${escHtml(badge)}${date?' · '+escHtml(date):''}</div>
    <div style="height:.5px;background:#E5E5EA;margin-bottom:12px"></div>
    <div id="mem2SheetContent" style="font-size:13px;line-height:1.75;color:#3A3A3C;white-space:pre-wrap;word-break:break-word;margin-bottom:12px">加载中…</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">${tagsHTML}</div>
    <div style="height:.5px;background:#E5E5EA;margin-bottom:12px"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <span style="font-size:12px;color:#8E8E93">importance</span>
      <div style="display:flex;gap:3px">${dots}</div>
    </div>
    <div onclick="mem2CloseDetail()" style="width:100%;padding:14px 0;text-align:center;background:#F2F2F7;border-radius:12px;font-size:15px;color:#1C1C1E;cursor:pointer;-webkit-tap-highlight-color:transparent;position:relative;z-index:10;touch-action:manipulation">关闭</div>
  `
  if(overlay)overlay.classList.add('open')
  try{
    const blocks=await mem2McpCall('breath_search',{query:b.name||b.bucket_id,max_results:1})
    const raw=blocks.map(c=>c.text||'').join('\n')
    // 1. 去掉所有 [key:value] 格式的 OB 元数据 token
    // 2. 去掉 Footprint 行
    // 3. 去掉纯 emoji+tag 行（如 📌 [核心准则]）
    const cleaned=raw
      .replace(/\[[^\]\n]*:[^\]\n]*\]/g,'')   // [bucket_id:xxx] [content_role:yyy] 等
      .replace(/🦶\s*Footprint[^\n]*/g,'')
      .split('\n')
      .map(l=>l.trim())
      .filter(l=>{
        if(!l||l==='---')return false
        // 剩下只有 emoji 或方括号标签的行也去掉
        if(/^[\[\]📌🦶\s]*$/.test(l))return false
        return true
      })
      .join('\n')
      .trim()
    const el=document.getElementById('mem2SheetContent')
    if(el)el.textContent=cleaned||'（无内容）'
  }catch(e){
    const el=document.getElementById('mem2SheetContent')
    if(el)el.textContent='加载失败'
  }
}
function mem2CloseDetail(){
  const o=document.getElementById('mem2Overlay')
  if(o)o.classList.remove('open')
}

function mem2OnSearch(val){
  _mem2Query=(val||'').trim()
  mem2Render()
}
function mem2SetFilter(el,val){
  document.querySelectorAll('.mem2-filter-pill').forEach(p=>p.classList.remove('active'))
  if(el)el.classList.add('active')
  _mem2Filter=val
  mem2Render()
}
function mem2Refresh(){
  _mem2All=[]
  mem2Load(true)
}

// 打开小窝时调：轻量拉一次 catalog 对比条数，有新记忆才刷新
async function mem2CheckAndLoad(){
  try{
    const blocks=await mem2McpCall('breath_advanced',{catalog:true,max_results:100})
    let count=0
    blocks.forEach(b=>{
      (b.text||'').split('\n').forEach(line=>{
        const parts=line.split('|').map(s=>s.trim())
        if(parts.length>=2&&parts[0]&&!/^工具/.test(parts[0]))count++
      })
    })
    const lastCount=parseInt(localStorage.getItem('mem2_last_count')||'0')
    if(count!==lastCount){
      localStorage.setItem('mem2_last_count',String(count))
      _mem2All=[]
      // 直接用已拉到的 blocks 填充，不再发第二次请求
      const rows=[]
      blocks.forEach(b=>{
        (b.text||'').split('\n').forEach(line=>{
          const parts=line.split('|').map(s=>s.trim())
          if(parts.length>=2&&parts[0]&&!/^工具/.test(parts[0])){
            rows.push({bucket_id:parts[0],name:parts[1]||parts[0],domain:parts[2]||'',importance:parseInt(parts[3])||0})
          }
        })
      })
      _mem2All=rows
      const statusDot=document.getElementById('mem2StatusDot')
      const statusText=document.getElementById('mem2StatusText')
      if(statusDot)statusDot.style.background='#34C759'
      if(statusText)statusText.textContent='Memory · '+rows.length+' records'
      mem2Render()
    }
  }catch(e){
    // 静默失败，不影响主界面
  }
}
