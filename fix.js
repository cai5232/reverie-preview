// fix.js v13 — 全量本地缓存 + 即时搜索 + 修奇怪标题
// 覆盖 app.js 同名函数

/* ── 工具函数 ── */
function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

function mem2BadgeColor(badge){
  if(badge==='PERMANENT')return'#C8956A'
  if(badge==='RESOLVED')return'#8E8E93'
  if(badge==='PLAN')return'#5C6BC0'
  return'#8E8E93'
}

function mem2DomainBadge(b){
  if(typeof b==='string'){const d=b.toLowerCase();return d.includes('plan')?'PLAN':'DYNAMIC'}
  if(!b)return'DYNAMIC'
  if(b.pinned||(b.importance||0)>=9)return'PERMANENT'
  if(b.resolved)return'RESOLVED'
  if((b.domain||'').toLowerCase().includes('plan'))return'PLAN'
  return'DYNAMIC'
}

// 从 name 解析日期和标题
function mem2ParseName(name){
  const m=(name||'').match(/^(\d{4}-\d{2}-\d{2})[_\s-]*(.*)/)
  if(m)return{date:m[1],title:m[2].trim()}
  return{date:'',title:name||''}
}

// 看起来像 ID/日期戳（只有数字和横线）就返回 true
function mem2LooksLikeId(s){
  return /^[\d\-]+$/.test((s||'').trim())
}

// 从 content 取第一行有意义的文字做标题
function mem2TitleFromContent(content){
  if(!content)return''
  const lines=content.split('\n')
  for(const l of lines){
    const t=l.trim()
    if(!t)continue
    // 跳过元数据行
    if(/^\[[\w_]+:[^\]]*\]/.test(t))continue
    if(/^【.*】/.test(t)){return t.replace(/【.*?】/,'').trim()||t}
    return t.slice(0,40)
  }
  return''
}

/* ── 过滤 OB 元数据行 ── */
function mem2CleanContent(raw){
  const text=Array.isArray(raw)?raw.map(c=>c.text||'').join('\n'):String(raw||'')
  return text.split('\n').filter(l=>{
    const t=l.trim()
    if(!t)return false
    if(/^\[[\w_]+:[^\]]*\]$/.test(t))return false
    if(/^\[[\w_]+:[^\]]*\]\s*\[[\w_]+:[^\]]*\]/.test(t))return false
    return true
  }).join('\n').trim()
}

/* ── 全局缓存 ── */
let _mem2All=[]       // 完整数据，每项含 content 字段
let _mem2Filter='all'
let _mem2Query=''

/* ── 获取 proxy base ── */
function mem2ProxyBase(){
  const c=typeof cfg!=='undefined'?cfg:(window._cfg||{})
  return(c.api||'').replace(/\/v1\/?$/,'')+'/internal/mcp-proxy'
}
function mem2Headers(){
  const c=typeof cfg!=='undefined'?cfg:(window._cfg||{})
  return{'Content-Type':'application/json','Authorization':'Bearer '+(c.key||'')}
}

/* ── 调用 OB MCP 工具 ── */
async function mem2McpCall(toolName,args){
  const res=await fetch(mem2ProxyBase(),{
    method:'POST',
    headers:mem2Headers(),
    body:JSON.stringify({
      url:'https://caiovo.zeabur.app/mcp',
      method:'POST',
      headers:{},
      body:{jsonrpc:'2.0',id:Date.now(),method:'tools/call',params:{name:toolName,arguments:args}}
    })
  })
  const j=await res.json()
  return j?.data?.result?.content||[]
}

/* ── 全量加载 ── */
async function mem2Load(){
  const statusDot=document.getElementById('mem2StatusDot')
  const statusText=document.getElementById('mem2StatusText')
  const list=document.getElementById('mem2List')
  if(statusDot)statusDot.style.background='#FF9500'
  if(statusText)statusText.textContent='Loading…'
  if(list)list.innerHTML='<div class="mem2-loading">加载中…</div>'
  try{
    // 1. 先用 catalog 模式拿所有桶的元数据列表
    const catRaw=await mem2McpCall('breath_advanced',{catalog:true,max_results:100})
    const catText=catRaw.map(c=>c.text||'').join('\n')
    // 解析 catalog 行：bucket_id | name | domain | importance
    const buckets=[]
    catText.split('\n').forEach(line=>{
      const parts=line.split('|').map(s=>s.trim())
      if(parts.length>=2){
        buckets.push({
          bucket_id:parts[0],
          name:parts[1],
          domain:parts[2]||'',
          importance:parseInt(parts[3])||0
        })
      }
    })
    // 2. 批量拉内容：用 breath_advanced 不带 catalog，一次50条
    const fullRaw=await mem2McpCall('breath_advanced',{max_results:80,max_tokens:40000})
    // breath_advanced 返回多个 text block，每个 block 是一个桶的完整内容
    // 解析：找 bucket_id 对应正文
    const contentMap={}
    let curId=''
    const fullText=fullRaw.map(c=>c.text||'').join('\n')
    // OB 返回格式：每桶开头有 [bucket_id:xxx] 行
    fullText.split('\n').forEach(line=>{
      const m=line.match(/^\[bucket_id:([^\]]+)\]/)
      if(m){curId=m[1];if(!contentMap[curId])contentMap[curId]='';return}
      if(curId)contentMap[curId]+=(contentMap[curId]?'\n':'')+line
    })
    // 3. 合并元数据 + 内容；缺少元数据的桶也补上
    const merged=buckets.map(b=>({
      ...b,
      content:mem2CleanContent([{text:contentMap[b.bucket_id]||''}])
    }))
    // 补上 breath_advanced 返回了但 catalog 没有的桶（极少情况）
    Object.keys(contentMap).forEach(id=>{
      if(!merged.find(b=>b.bucket_id===id)){
        merged.push({bucket_id:id,name:id,domain:'',importance:0,content:mem2CleanContent([{text:contentMap[id]}])})
      }
    })
    _mem2All=merged
    if(statusDot)statusDot.style.background='#34C759'
    if(statusText)statusText.textContent='Memory · '+_mem2All.length+' records'
    mem2Render()
  }catch(e){
    if(statusDot)statusDot.style.background='#FF3B30'
    if(statusText)statusText.textContent='加载失败'
    if(list)list.innerHTML='<div class="mem2-loading" style="color:#f66">'+escHtml(String(e))+'</div>'
  }
}

/* ── 本地过滤+搜索后渲染 ── */
function mem2Render(){
  const list=document.getElementById('mem2List')
  if(!list)return
  let arr=_mem2All
  // filter
  if(_mem2Filter&&_mem2Filter!=='all'){
    arr=arr.filter(b=>{
      const badge=mem2DomainBadge(b).toLowerCase()
      if(_mem2Filter==='pinned')return b.pinned
      return badge===_mem2Filter
    })
  }
  // search
  if(_mem2Query){
    const q=_mem2Query.toLowerCase()
    arr=arr.filter(b=>{
      return(b.name||'').toLowerCase().includes(q)||
        (b.content||'').toLowerCase().includes(q)||
        (b.domain||'').toLowerCase().includes(q)
    })
  }
  _mem2Filtered=arr
  if(!arr.length){list.innerHTML='<div class="mem2-loading">没有匹配的记忆</div>';return}
  list.innerHTML=arr.map((b,i)=>mem2CardHTML(b,i)).join('')
}

/* ── 卡片 HTML ── */
function mem2CardHTML(b,i){
  const{date,title}=mem2ParseName(b.name||b.bucket_id||'')
  // 如果 name 像ID/日期戳，从正文第一行取标题
  let displayTitle=title
  if(!displayTitle||mem2LooksLikeId(displayTitle)){
    displayTitle=mem2TitleFromContent(b.content)||b.name||'未命名'
  }
  const imp=Math.min(10,Math.max(0,parseInt(b.importance)||0))
  const dots=Array.from({length:9},(_,k)=>`<div class="mem2-dot-item${k>=imp?' empty':''}"></div>`).join('')
  const tags=(b.domain||'').split(',').map(t=>t.trim()).filter(Boolean).slice(0,3)
  const tagsHTML=tags.map(t=>`<div class="mem2-tag">${escHtml(t)}</div>`).join('')
  const badge=mem2DomainBadge(b)
  const color=mem2BadgeColor(badge)
  const timeDisplay=date?date.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$2/$3'):''
  return`<div class="mem2-card" onclick="mem2OpenDetail(${i})">
    <div class="mem2-card-head"><span class="mem2-card-type" style="color:${color}">${escHtml(badge)}</span>${timeDisplay?`<span class="mem2-card-time">${escHtml(timeDisplay)}</span>`:''}</div>
    <div class="mem2-card-title">${b.pinned?'📌 ':''}${escHtml(displayTitle)}</div>
    <div class="mem2-card-footer"><div class="mem2-dots">${dots}</div><svg class="mem2-heart" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 12S1.5 8.5 1.5 5a2.5 2.5 0 015 0 2.5 2.5 0 015 0C11.5 8.5 7 12 7 12z" stroke="#E5E5EA" stroke-width="1.2"/></svg><div class="mem2-card-tags">${tagsHTML}</div></div>
  </div>`
}

/* ── 打开详情（本地，不再 fetch） ── */
function mem2OpenDetail(i){
  const b=(_mem2Filtered&&_mem2Filtered[i])||_mem2All[i]
  if(!b)return
  const overlay=document.getElementById('mem2Overlay')
  const body=document.getElementById('mem2SheetBody')
  const{date,title}=mem2ParseName(b.name||'')
  let displayTitle=title
  if(!displayTitle||mem2LooksLikeId(displayTitle)){
    displayTitle=mem2TitleFromContent(b.content)||b.name||'未命名'
  }
  const badge=mem2DomainBadge(b)
  const color=mem2BadgeColor(badge)
  const imp=Math.min(10,Math.max(0,parseInt(b.importance)||0))
  const dots=Array.from({length:10},(_,k)=>`<div class="mem2-dot-item${k>=imp?' empty':''}"></div>`).join('')
  const content=b.content||''
  body.innerHTML=`
    <div class="mem2-sheet-title">${b.pinned?'📌 ':''}${escHtml(displayTitle)}</div>
    <div class="mem2-sheet-meta" style="color:${color}">${escHtml(badge)}${date?' · '+escHtml(date):''}</div>
    <div class="mem2-sheet-div"></div>
    <div id="mem2SheetContent">${content
      ?`<div class="mem2-sheet-content">${escHtml(content)}</div>`
      :'<div class="mem2-sheet-content" style="color:#aaa">（无内容）</div>'
    }</div>
    <div class="mem2-sheet-div"></div>
    <div class="mem2-meta-row"><span class="mem2-meta-label">importance</span><div class="mem2-dots">${dots}</div></div>
    <button class="mem2-rest-btn" onclick="mem2CloseDetail()">关闭</button>
    <div class="mem2-sheet-id">${escHtml(b.bucket_id||b.name||'')} · tap to copy</div>`
  if(overlay)overlay.classList.add('open')
}

/* ── 搜索回调（本地） ── */
function mem2OnSearch(val){
  _mem2Query=(val||'').trim()
  mem2Render()
}

/* ── filter pill ── */
function mem2SetFilter(el,val){
  document.querySelectorAll('.mem2-filter-pill').forEach(p=>p.classList.remove('active'))
  if(el)el.classList.add('active')
  _mem2Filter=val
  mem2Render()
}
