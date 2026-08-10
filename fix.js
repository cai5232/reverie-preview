// fix.js v14
// 覆盖 app.js 同名函数

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

function mem2ParseName(name){
  // 匹配 YYYY-MM-DD 开头
  const m=(name||'').match(/^(\d{4}-\d{2}-\d{2})[_\s-]*(.*)/)
  if(m)return{date:m[1],title:m[2].trim()}
  return{date:'',title:name||''}
}

// 只有数字和横线 → 像ID
function mem2LooksLikeId(s){
  return /^[\d\-]+$/.test((s||'').trim())
}

// 从 content 提第一行有意义的文字
function mem2TitleFromContent(content){
  if(!content)return''
  for(const l of content.split('\n')){
    const t=l.trim()
    if(!t)continue
    return t.replace(/^【.*?】/,'').trim().slice(0,40)||t.slice(0,40)
  }
  return''
}

// 清洗单个桶的原始文本：去掉所有元数据行
// OB 的元数据行特征：整行由多个 [key:val] 组成
function mem2CleanBlock(text){
  return (text||'').split('\n').filter(l=>{
    const t=l.trim()
    if(!t)return false
    // 整行都是 [key:val] 片段 → 元数据行
    if(/^(\[[\w_]+:[^\]]*\]\s*)+$/.test(t))return false
    // meaning: 行（OB 自动生成）可以保留也可以去掉，这里保留
    return true
  }).join('\n').trim()
}

// ── 全局缓存 ──
let _mem2All=[]
let _mem2Filtered=[]
let _mem2Filter='all'
let _mem2Query=''

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

// ── 全量加载 ──
async function mem2Load(){
  const statusDot=document.getElementById('mem2StatusDot')
  const statusText=document.getElementById('mem2StatusText')
  const list=document.getElementById('mem2List')
  if(statusDot)statusDot.style.background='#FF9500'
  if(statusText)statusText.textContent='Loading…'
  if(list)list.innerHTML='<div class="mem2-loading">加载中…</div>'
  try{
    // Step1: catalog 拿元数据
    const catBlocks=await mem2McpCall('breath_advanced',{catalog:true,max_results:100})
    // catalog 模式每个 text block 是一行 "bucket_id | name | domain | importance"
    const metaMap={} // bucket_id → {name,domain,importance}
    catBlocks.forEach(block=>{
      const text=block.text||''
      text.split('\n').forEach(line=>{
        const parts=line.split('|').map(s=>s.trim())
        if(parts.length>=2&&parts[0]){
          metaMap[parts[0]]={
            bucket_id:parts[0],
            name:parts[1]||parts[0],
            domain:parts[2]||'',
            importance:parseInt(parts[3])||0
          }
        }
      })
    })

    // Step2: 全量内容，每个 block 是一个桶
    const fullBlocks=await mem2McpCall('breath_advanced',{max_results:80,max_tokens:40000})
    // 每个 block.text 第一行含 [bucket_id:xxx]，提取后清洗
    const merged=[]
    const seen=new Set()
    fullBlocks.forEach(block=>{
      const raw=block.text||''
      // 提取 bucket_id
      const idMatch=raw.match(/\[bucket_id:([^\]]+)\]/)
      const bid=idMatch?idMatch[1].trim():''
      if(!bid||seen.has(bid))return
      seen.add(bid)
      const meta=metaMap[bid]||{bucket_id:bid,name:bid,domain:'',importance:0}
      const content=mem2CleanBlock(raw)
      merged.push({...meta,content})
    })
    // 补上 catalog 有但 full 里没返回的（只显示元数据，无内容）
    Object.values(metaMap).forEach(m=>{
      if(!seen.has(m.bucket_id))merged.push({...m,content:''})
    })

    _mem2All=merged
    if(statusDot)statusDot.style.background='#34C759'
    if(statusText)statusText.textContent='Memory · '+_mem2All.length+' records'
    mem2Render()
  }catch(e){
    console.error(e)
    if(statusDot)statusDot.style.background='#FF3B30'
    if(statusText)statusText.textContent='加载失败'
    if(list)list.innerHTML='<div class="mem2-loading" style="color:#f66">'+escHtml(String(e))+'</div>'
  }
}

// ── 渲染 ──
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
    arr=arr.filter(b=>
      (b.name||'').toLowerCase().includes(q)||
      (b.content||'').toLowerCase().includes(q)||
      (b.domain||'').toLowerCase().includes(q)
    )
  }
  _mem2Filtered=arr
  if(!arr.length){list.innerHTML='<div class="mem2-loading">没有匹配的记忆</div>';return}
  list.innerHTML=arr.map((b,i)=>mem2CardHTML(b,i)).join('')
}

// ── 卡片 HTML ──
function mem2CardHTML(b,i){
  const{date,title}=mem2ParseName(b.name||b.bucket_id||'')
  let displayTitle=title
  if(!displayTitle||mem2LooksLikeId(displayTitle)){
    displayTitle=mem2TitleFromContent(b.content)||b.name||'未命名'
  }
  const imp=Math.min(10,Math.max(0,parseInt(b.importance)||0))
  const dots=Array.from({length:9},(_,k)=>`<div class="mem2-dot-item${k>=imp?' empty':''}" ></div>`).join('')
  const tags=(b.domain||'').split(',').map(t=>t.trim()).filter(Boolean).slice(0,3)
  const tagsHTML=tags.map(t=>`<div class="mem2-tag">${escHtml(t)}</div>`).join('')
  const badge=mem2DomainBadge(b)
  const color=mem2BadgeColor(badge)
  const timeDisplay=date?date.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$2/$3'):''
  return`<div class="mem2-card" onclick="mem2OpenDetail(${i})">
    <div class="mem2-card-head"><span class="mem2-card-type" style="color:${color}">${escHtml(badge)}</span>${timeDisplay?`<span class="mem2-card-time">${escHtml(timeDisplay)}</span>`:''}</div>
    <div class="mem2-card-title">${b.pinned?'📌 ':''} ${escHtml(displayTitle)}</div>
    <div class="mem2-card-footer"><div class="mem2-dots">${dots}</div><svg class="mem2-heart" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 12S1.5 8.5 1.5 5a2.5 2.5 0 015 0 2.5 2.5 0 015 0C11.5 8.5 7 12 7 12z" stroke="#E5E5EA" stroke-width="1.2"/></svg><div class="mem2-card-tags">${tagsHTML}</div></div>
  </div>`
}

// ── 详情（本地，不再 fetch） ──
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
  const dots=Array.from({length:10},(_,k)=>`<div class="mem2-dot-item${k>=imp?' empty':''}" ></div>`).join('')
  const content=b.content||''
  body.innerHTML=`
    <div class="mem2-sheet-title">${b.pinned?'📌 ':''} ${escHtml(displayTitle)}</div>
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
