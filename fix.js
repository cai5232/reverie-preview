// fix.js v18 — localStorage persist + prefetch
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
  let s=(name||'').replace(/^[\uD83D\uDCCC\s]+/,'').replace(/^📌\s*/,'').trim()
  const m=s.match(/^(\d{4}-\d{2}-\d{2})\s+\d{2}-\d{2}-\d{2}\s+(.+)$/)
  if(m)return{date:m[1],title:m[2].trim()}
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
let _mem2Prefetching=false

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

// ===== 新增 / 编辑记忆 =====
let _mem2EditBucket = null  // null = 新增，有值 = 编辑

function mem2ShowAdd(){
  _mem2EditBucket = null
  document.getElementById('mem2EditSheetTitle').textContent = '新增记忆'
  document.getElementById('mem2EditContent').value = ''
  document.getElementById('mem2EditTags').value = ''
  document.getElementById('mem2EditOverlay').classList.add('open')
  setTimeout(()=>document.getElementById('mem2EditContent').focus(), 150)
}

function mem2ShowEdit(i){
  const arr = _mem2Filtered.length ? _mem2Filtered : _mem2All
  const b = arr[i]
  if(!b) return
  _mem2EditBucket = b
  document.getElementById('mem2EditSheetTitle').textContent = '编辑记忆'
  document.getElementById('mem2EditContent').value = b._content || ''
  document.getElementById('mem2EditTags').value = (b.domain||'').split(',').map(t=>t.trim()).filter(t=>t&&t!=='未分类').join(', ')
  document.getElementById('mem2EditOverlay').classList.add('open')
  setTimeout(()=>document.getElementById('mem2EditContent').focus(), 150)
}

function mem2CloseEdit(){
  document.getElementById('mem2EditOverlay').classList.remove('open')
  _mem2EditBucket = null
}

async function mem2SaveEdit(){
  const content = document.getElementById('mem2EditContent').value.trim()
  if(!content){ showToast('内容不能为空'); return }
  const tags = document.getElementById('mem2EditTags').value.trim()
  const btn = document.getElementById('mem2EditSaveBtn')
  btn.textContent = '保存中…'
  btn.style.opacity = '0.6'
  try{
    if(_mem2EditBucket){
      // 编辑已有桶：用 trace old_str/new_str
      await mem2McpCall('trace', {
        bucket_id: _mem2EditBucket.bucket_id || _mem2EditBucket.name,
        content: content,
        ...(tags ? {tags} : {})
      })
      _mem2EditBucket._content = content
      if(tags) _mem2EditBucket.domain = tags
      const first = content.split('\n')[0]
      _mem2EditBucket.display_title = first.slice(0,28) + (first.length>28?'…':'')
      mem2SaveCache()
      mem2Render()
      showToast('已更新')
    } else {
      // 新增：用 hold
      await mem2McpCall('hold', {
        content,
        ...(tags ? {tags} : {}),
        importance: 5
      })
      // 清缓存让下次刷新时重拉
      mem2ClearCache()
      _mem2All = []
      showToast('已添加，正在刷新…')
      mem2Load(true)
    }
  }catch(e){
    showToast('保存失败：' + (e.message||''))
  }finally{
    btn.textContent = '保存'
    btn.style.opacity = '1'
    mem2CloseEdit()
  }
}


function mem2SaveCache(){
  try{localStorage.setItem('mem2_data',JSON.stringify(_mem2All))}catch(e){}
}
function mem2ReadCache(){
  try{const s=localStorage.getItem('mem2_data');if(s)return JSON.parse(s)}catch(e){}
  return null
}
function mem2ClearCache(){
  localStorage.removeItem('mem2_data')
  localStorage.removeItem('mem2_last_count')
}

// 解析 catalog blocks → rows
function mem2ParseCatalog(blocks){
  const rows=[]
  blocks.forEach(b=>{
    (b.text||'').split('\n').forEach(line=>{
      const parts=line.split('|').map(s=>s.trim())
      if(!parts[0])return
      const rawName=parts[0]
      if(/^工具|^名称|^===|^---/.test(rawName))return
      const isPinned=rawName.startsWith('📌')
      const cleanName=rawName.replace(/^📌\s*/,'').trim()
      if(!cleanName)return
      const{date,title}=mem2ParseName(cleanName)
      const isTimestamp=/^\d{2}-\d{2}-\d{2}$/.test(title)
      rows.push({bucket_id:cleanName,name:cleanName,display_title:isTimestamp?'':title,date:date,domain:parts[1]||'',importance:parseInt(parts[2])||0,pinned:isPinned,_content:null})
    })
  })
  return rows
}

// 清洗 breath_search 原始文本
function mem2CleanContent(raw){
  return raw
    .replace(/\[[^\]\n]*:[^\]\n]*\]/g,'')
    .replace(/🦶\s*Footprint[^\n]*/g,'')
    .split('\n').map(l=>l.trim()).filter(l=>{
      if(!l||l==='---')return false
      if(/^[\[\]📌🦶\s]*$/.test(l))return false
      return true
    }).join('\n').trim()
}

// 后台逐条预拉内容
async function mem2Prefetch(){
  if(_mem2Prefetching)return
  _mem2Prefetching=true
  const targets=(_mem2All||[]).filter(b=>b._content==null)
  for(let i=0;i<targets.length;i++){
    const b=targets[i]
    try{
      const blocks=await mem2McpCall('breath_search',{query:b.name||b.bucket_id,max_results:1})
      const raw=blocks.map(c=>c.text||'').join('\n')
      const cleaned=mem2CleanContent(raw)
      b._content=cleaned
      if(!b.display_title&&cleaned){
        const first=cleaned.split('\n')[0]
        b.display_title=first.slice(0,28)+(first.length>28?'…':'')
        // 更新卡片 DOM
        const filt=_mem2Filtered.length?_mem2Filtered:_mem2All
        const fi=filt.indexOf(b)
        if(fi>=0){
          const cards=document.querySelectorAll('.mem2-card')
          if(cards[fi]){
            const t=cards[fi].querySelector('.mem2-card-title')
            if(t)t.textContent=(b.pinned?'📌 ':'')+b.display_title
          }
        }
      }
    }catch(e){}
    await new Promise(r=>setTimeout(r,100))
    if((i+1)%10===0)mem2SaveCache()
  }
  mem2SaveCache()
  _mem2Prefetching=false
}

async function mem2Load(force){
  // 先读 localStorage
  if(!force){
    const cached=mem2ReadCache()
    if(cached&&cached.length>0){
      _mem2All=cached
      const statusDot=document.getElementById('mem2StatusDot')
      const statusText=document.getElementById('mem2StatusText')
      if(statusDot)statusDot.style.background='#34C759'
      if(statusText)statusText.textContent='Memory · '+cached.length+' records'
      mem2Render()
      // 后台检查条数是否变化
      mem2CheckAndLoad()
      // 继续后台预拉未缓存的内容
      mem2Prefetch()
      return
    }
  }
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
    const rows=mem2ParseCatalog(blocks)
    _mem2All=rows
    localStorage.setItem('mem2_last_count',String(rows.length))
    if(statusDot)statusDot.style.background='#34C759'
    if(statusText)statusText.textContent='Memory · '+rows.length+' records'
    mem2Render()
    mem2SaveCache()
    mem2Prefetch()
  }catch(e){
    if(statusDot)statusDot.style.background='#FF3B30'
    if(statusText)statusText.textContent='加载失败'
    if(list)list.innerHTML='<div class="mem2-loading" style="color:#f66">'+escHtml(String(e))+'</div>'
  }finally{
    _mem2Loading=false
  }
}

async function mem2CheckAndLoad(){
  try{
    const blocks=await mem2McpCall('breath_advanced',{catalog:true,max_results:100})
    let count=0
    blocks.forEach(b=>{
      (b.text||'').split('\n').forEach(line=>{
        const p=line.split('|').map(s=>s.trim())
        if(p[0]&&!/^工具|^名称|^===|^---/.test(p[0]))count++
      })
    })
    const lastCount=parseInt(localStorage.getItem('mem2_last_count')||'0')
    if(count!==lastCount){
      // 新记忆，清缓存重拉
      mem2ClearCache()
      _mem2All=[]
      mem2Load(true)
    }
  }catch(e){}
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
      return(b.display_title||'').toLowerCase().includes(q)||
        (b.name||'').toLowerCase().includes(q)||
        (b.domain||'').toLowerCase().includes(q)||
        (b._content||'').toLowerCase().includes(q)
    })
  }
  _mem2Filtered=arr
  if(!arr.length){
    list.innerHTML='<div class="mem2-loading">'+(_mem2All.length?'没有匹配的记忆':'暂无记忆，点刷新加载')+'</div>'
    return
  }
  list.innerHTML=arr.map((b,i)=>mem2CardHTML(b,i)).join('')
}

function mem2CardHTML(b,i){
  const domainFallback=(b.domain||'').split(',').map(t=>t.trim()).filter(t=>t&&t!=='未分类')[0]||''
  const contentFallback=b._content?(b._content.split('\n')[0]||'').slice(0,28):''
  const displayTitle=b.display_title||domainFallback||contentFallback||'未命名'
  const date=b.date||''
  const imp=Math.min(10,Math.max(0,parseInt(b.importance)||0))
  const dots=Array.from({length:9},(_,k)=>`<div class="mem2-dot-item${k<imp?'':' empty'}"></div>`).join('')
  const tags=(b.domain||'').split(',').map(t=>t.trim()).filter(t=>t&&t!=='未分类').slice(0,3)
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

async function mem2OpenDetail(i){
  const b=(_mem2Filtered.length?_mem2Filtered[i]:_mem2All[i])
  if(!b)return
  const overlay=document.getElementById('mem2Overlay')
  const body=document.getElementById('mem2SheetBody')
  const domainFallback=(b.domain||'').split(',').map(t=>t.trim()).filter(t=>t&&t!=='未分类')[0]||''
  const contentFallback=b._content?(b._content.split('\n')[0]||'').slice(0,28):''
  const displayTitle=b.display_title||domainFallback||contentFallback||'未命名'
  const date=b.date||''
  const badge=mem2DomainBadge(b)
  const color=mem2BadgeColor(badge)
  const imp=Math.min(10,Math.max(0,parseInt(b.importance)||0))
  const dots=Array.from({length:10},(_,k)=>`<div class="mem2-dot-item${k<imp?'':' empty'}"></div>`).join('')
  const tags=(b.domain||'').split(',').map(t=>t.trim()).filter(t=>t&&t!=='未分类')
  const tagsHTML=tags.map(t=>`<span style="font-size:11px;color:#8E8E93;background:#F2F2F7;border-radius:6px;padding:2px 8px">${escHtml(t)}</span>`).join('')
  const existingContent=b._content!=null?escHtml(b._content||'（无内容）'):'加载中…'
  body.innerHTML=`
    <div style="font-size:18px;font-weight:700;color:#1C1C1E;line-height:1.4;margin-bottom:6px">${b.pinned?'📌 ':''}${escHtml(displayTitle)}</div>
    <div style="font-size:13px;color:${color};margin-bottom:12px">${escHtml(badge)}${date?' · '+escHtml(date):''}</div>
    <div style="height:.5px;background:#E5E5EA;margin-bottom:12px"></div>
    <div id="mem2SheetContent" style="font-size:13px;line-height:1.75;color:#3A3A3C;white-space:pre-wrap;word-break:break-word;margin-bottom:12px">${existingContent}</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">${tagsHTML}</div>
    <div style="height:.5px;background:#E5E5EA;margin-bottom:12px"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <span style="font-size:12px;color:#8E8E93">importance</span>
      <div style="display:flex;gap:3px">${dots}</div>
    </div>
    <div onclick="mem2CloseDetail()" style="width:100%;padding:14px 0;text-align:center;background:#F2F2F7;border-radius:12px;font-size:15px;color:#1C1C1E;cursor:pointer;-webkit-tap-highlight-color:transparent;position:relative;z-index:10;touch-action:manipulation">关闭</div>
  `
  if(overlay)overlay.classList.add('open')
  // 已有缓存直接返回
  if(b._content!=null)return
  try{
    const blocks=await mem2McpCall('breath_search',{query:b.name||b.bucket_id,max_results:1})
    const raw=blocks.map(c=>c.text||'').join('\n')
    const cleaned=mem2CleanContent(raw)
    b._content=cleaned
    if(!b.display_title&&cleaned){
      const first=cleaned.split('\n')[0]
      b.display_title=first.slice(0,28)+(first.length>28?'…':'')
    }
    mem2SaveCache()
    const el=document.getElementById('mem2SheetContent')
    if(el)el.textContent=cleaned||'（无内容）'
    // 同步更新弹窗标题
    const sheetTitle=body.querySelector('div[style*="font-weight:700"]')
    if(sheetTitle&&b.display_title)sheetTitle.textContent=(b.pinned?'📌 ':'')+b.display_title
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
  mem2ClearCache()
  _mem2All=[]
  mem2Load(true)
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
