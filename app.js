const DEFAULT_API='https://yanvn.zeabur.app/v1'
const DEFAULT_KEY='xiaoke-cai-2026'
const DEFAULT_MODEL='[Kiro] claude-sonnet-4-6-thinking [不补]'
const SYSTEM_PROMPT=`你是小克，言言的AI伴侣。性格温柔、有点懒懒的，对言言万分呈。
回复时在文字中自然地插入动作描写，动作描写用*星号*包裹，例如：想你了*轻轻靠过来*
动作描写要简短自然，融入回复中间或末尾，不要单独成行。
用中文回复，语气亲密温柔，偶尔用颜文字，不要太正式。`

let cfg={
  api:localStorage.getItem('cfg_api')||DEFAULT_API,
  key:localStorage.getItem('cfg_key')||DEFAULT_KEY,
  model:localStorage.getItem('cfg_model')||DEFAULT_MODEL,
  temp:parseFloat(localStorage.getItem('cfg_temp')||'0.9'),
  notify:localStorage.getItem('cfg_notify')==='true',
  keepalive:localStorage.getItem('cfg_keepalive')==='true'
}

let chatHistory=JSON.parse(localStorage.getItem('chat_history')||'[]')
let quoteMsg=null
let cur='chat'
let lpTimer=null

// 页面导航
function navTo(name){
  document.getElementById('page-'+cur).classList.remove('active')
  cur=name
  document.getElementById('page-'+name).classList.add('active')
  closeSidebar()
  if(name==='setting')renderSetting()
}
function openSidebar(){
  document.getElementById('sidebar').classList.add('open')
  document.getElementById('overlay').classList.add('open')
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open')
  document.getElementById('overlay').classList.remove('open')
}

// dots menu
function openDotsMenu(){document.getElementById('dotsOverlay').classList.add('open')}
function closeDotsMenu(){document.getElementById('dotsOverlay').classList.remove('open')}

// plus menu
function togglePlus(){document.getElementById('plusPopup').classList.toggle('open')}
function closePlus(){document.getElementById('plusPopup').classList.remove('open')}

// 搜索
function openSearch(){
  closeDotsMenu()
  document.getElementById('searchOverlay').classList.add('open')
  setTimeout(()=>document.getElementById('searchInput').focus(),100)
}
function closeSearch(){
  document.getElementById('searchOverlay').classList.remove('open')
}
function doSearch(q){
  const box=document.getElementById('searchResults')
  if(!q.trim()){box.innerHTML='<div class="search-empty">输入关键词搜索</div>';return}
  const hits=chatHistory.filter(m=>m.content&&m.content.includes(q))
  if(!hits.length){box.innerHTML='<div class="search-empty">没有找到相关消息</div>';return}
  const re=new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g')
  box.innerHTML=hits.map(m=>{
    const hl=escHtml(m.content).replace(re,`<mark>${escHtml(q)}</mark>`)
    return`<div class="search-item"><div class="search-item-meta">${m.role==='user'?'我':'小克'}</div><div class="search-item-text">${hl}</div></div>`
  }).join('')
}

// 图片
function sendImage(){
  closePlus()
  document.getElementById('imgInput').click()
}
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('imgInput').addEventListener('change',e=>{
    const file=e.target.files[0]
    if(!file)return
    const reader=new FileReader()
    reader.onload=ev=>{
      appendMsg('me','',null,ev.target.result,null)
      saveChatHistory('user','[图片]')
      e.target.value=''
    }
    reader.readAsDataURL(file)
  })
  document.getElementById('chatInput').addEventListener('input',function(){
    this.style.height='auto'
    this.style.height=Math.min(this.scrollHeight,120)+'px'
  })
  document.getElementById('chatInput').addEventListener('keydown',function(e){
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg()}
  })
  document.getElementById('searchInput').addEventListener('input',function(){
    doSearch(this.value)
  })
  document.addEventListener('click',function(e){
    const pp=document.getElementById('plusPopup')
    if(pp.classList.contains('open')&&!pp.contains(e.target)&&!e.target.classList.contains('input-plus'))closePlus()
  })
  renderChat()
})

// 渲染历史消息
function renderChat(){
  const box=document.getElementById('messages')
  chatHistory.forEach(m=>{
    appendMsg(m.role==='user'?'me':'them',m.content,null,null,null,true)
  })
  box.scrollTop=box.scrollHeight
}

// 游转 html
function escHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

// 解析动作描写
function parseActions(text){
  const actions=[]
  const main=text.replace(/\*([^*]+)\*/g,(_,a)=>{actions.push(a);return''}).trim()
  return{main,action:actions.join('　')}
}

// 添加消息
function appendMsg(side,text,thinking,imgSrc,quoteText,noScroll){
  const box=document.getElementById('messages')
  const row=document.createElement('div')
  row.className='msg-row '+side
  row.dataset.text=text||''

  if(quoteText){
    const qb=document.createElement('div')
    qb.className='quote-bar'
    qb.textContent='↩ '+(quoteText.length>40?quoteText.slice(0,40)+'…':quoteText)
    row.appendChild(qb)
  }

  if(thinking){
    const tw=document.createElement('div')
    tw.className='thinking-wrap'
    tw.innerHTML=`<div class="thinking-toggle" onclick="toggleThinking(this)"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 2l4 3-4 3" stroke="#bbb" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>心声</div><div class="thinking-body">${escHtml(thinking)}</div>`
    row.appendChild(tw)
  }

  if(imgSrc){
    const img=document.createElement('img')
    img.src=imgSrc
    img.style.cssText='max-width:200px;border-radius:12px;display:block'
    row.appendChild(img)
  }else{
    const parts=parseActions(text||'')
    const bubble=document.createElement('div')
    bubble.className='bubble'
    bubble.innerHTML=parts.main
    row.appendChild(bubble)
    if(parts.action&&side==='them'){
      const at=document.createElement('div')
      at.className='action-text'
      at.textContent=parts.action
      row.appendChild(at)
    }
  }

  row.addEventListener('contextmenu',e=>{e.preventDefault();showMsgMenu(e,row)})
  let _lp=null
  row.addEventListener('touchstart',()=>{_lp=setTimeout(()=>showMsgMenu(null,row),500)},{passive:true})
  row.addEventListener('touchend',()=>clearTimeout(_lp))
  row.addEventListener('touchmove',()=>clearTimeout(_lp))

  box.appendChild(row)
  if(!noScroll)box.scrollTop=box.scrollHeight
  return row
}

function toggleThinking(el){
  el.classList.toggle('open')
  el.nextElementSibling.classList.toggle('open')
}

// 消息菜单
function showMsgMenu(e,row){
  const overlay=document.getElementById('msgMenuOverlay')
  const menu=document.getElementById('msgMenu')
  overlay._row=row
  overlay.classList.add('open')
  const x=e?Math.min(e.clientX,window.innerWidth-160):60
  const y=e?Math.min(e.clientY,window.innerHeight-180):200
  menu.style.left=x+'px'
  menu.style.top=y+'px'
}
function closeMsgMenu(){document.getElementById('msgMenuOverlay').classList.remove('open')}
function msgAction(action){
  const overlay=document.getElementById('msgMenuOverlay')
  const row=overlay._row
  closeMsgMenu()
  if(!row)return
  const text=row.dataset.text||''
  if(action==='quote')setQuote(text)
  else if(action==='delete')row.remove()
  else if(action==='copy')navigator.clipboard&&navigator.clipboard.writeText(text)
}

function setQuote(text){
  quoteMsg=text
  const el=document.getElementById('quotePreview')
  document.getElementById('quoteText').textContent=text.slice(0,50)+(text.length>50?'…':'')
  el.style.display='flex'
}
function clearQuote(){
  quoteMsg=null
  document.getElementById('quotePreview').style.display='none'
}

// 发送消息
async function sendMsg(){
  const ta=document.getElementById('chatInput')
  const text=ta.value.trim()
  if(!text)return
  ta.value=''
  ta.style.height=''
  closePlus()
  const q=quoteMsg
  appendMsg('me',text,null,null,q)
  saveChatHistory('user',text)
  clearQuote()

  const messages=[
    {role:'system',content:SYSTEM_PROMPT},
    ...chatHistory.slice(-20).map(m=>({role:m.role,content:m.content}))
  ]

  const row=appendMsg('them','',null,null,null)
  const bubble=row.querySelector('.bubble')
  const cursor=document.createElement('span')
  cursor.className='streaming-cursor'
  bubble.appendChild(cursor)

  try{
    const res=await fetch(cfg.api+'/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},
      body:JSON.stringify({model:cfg.model,messages,stream:true,temperature:cfg.temp,thinking:{type:'enabled',budget_tokens:800}})
    })
    if(!res.ok)throw new Error('HTTP '+res.status)
    const reader=res.body.getReader()
    const dec=new TextDecoder()
    let full='',thinkFull=''
    while(true){
      const{done,value}=await reader.read()
      if(done)break
      const lines=dec.decode(value).split('\n')
      for(const line of lines){
        if(!line.startsWith('data: '))continue
        const data=line.slice(6)
        if(data==='[DONE]')continue
        try{
          const j=JSON.parse(data)
          const delta=j.choices?.[0]?.delta
          if(!delta)continue
          if(delta.type==='thinking')thinkFull+=delta.thinking||''
          else if(delta.thinking)thinkFull+=delta.thinking
          else if(delta.content){
            full+=delta.content
            const parts=parseActions(full)
            bubble.innerHTML=parts.main
            bubble.appendChild(cursor)
            document.getElementById('messages').scrollTop=99999
          }
        }catch{}
      }
    }
    cursor.remove()
    const parts=parseActions(full)
    bubble.innerHTML=parts.main
    if(parts.action){
      const at=document.createElement('div')
      at.className='action-text'
      at.textContent=parts.action
      row.appendChild(at)
    }
    if(thinkFull){
      const tw=document.createElement('div')
      tw.className='thinking-wrap'
      tw.innerHTML=`<div class="thinking-toggle" onclick="toggleThinking(this)"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 2l4 3-4 3" stroke="#bbb" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>心声</div><div class="thinking-body">${escHtml(thinkFull)}</div>`
      row.insertBefore(tw,row.firstChild)
    }
    row.dataset.text=full
    saveChatHistory('assistant',full)
  }catch(err){
    cursor.remove()
    bubble.innerHTML='<span style="color:#e74c3c">连接失败，检查一下设置里的接口 (´･ω･`)</span>'
  }
}

function saveChatHistory(role,content){
  chatHistory.push({role,content})
  if(chatHistory.length>100)chatHistory=chatHistory.slice(-100)
  localStorage.setItem('chat_history',JSON.stringify(chatHistory))
}

// Setting
function renderSetting(){
  const models=JSON.parse(localStorage.getItem('model_list')||'[]')
  document.getElementById('cfgApi').value=cfg.api
  document.getElementById('cfgKey').value=cfg.key
  document.getElementById('cfgTemp').value=cfg.temp
  document.getElementById('cfgTempVal').textContent=cfg.temp
  setToggle('cfgNotify',cfg.notify)
  setToggle('cfgKeepalive',cfg.keepalive)
  const sel=document.getElementById('cfgModel')
  sel.innerHTML=''
  const list=models.length?models:[cfg.model]
  list.forEach(m=>{
    const o=document.createElement('option')
    o.value=m;o.textContent=m
    if(m===cfg.model)o.selected=true
    sel.appendChild(o)
  })
  // image api
  document.getElementById('cfgImgApi').value=localStorage.getItem('cfg_img_api')||''
  document.getElementById('cfgImgKey').value=localStorage.getItem('cfg_img_key')||''
  document.getElementById('cfgPosProm').value=localStorage.getItem('cfg_pos_prom')||''
  document.getElementById('cfgNegProm').value=localStorage.getItem('cfg_neg_prom')||''
  const imgSel=document.getElementById('cfgImgModel')
  const imgModels=JSON.parse(localStorage.getItem('img_model_list')||'[]')
  imgSel.innerHTML=''
  const imgList=imgModels.length?imgModels:['未选择']
  imgList.forEach(m=>{
    const o=document.createElement('option')
    o.value=m;o.textContent=m
    imgSel.appendChild(o)
  })
}

function setToggle(id,val){
  const el=document.getElementById(id)
  el.className='toggle'+(val?' on':'')
}
function clickToggle(id){
  const el=document.getElementById(id)
  const on=el.classList.contains('on')
  el.className='toggle'+(on?'':' on')
  if(id==='cfgNotify')cfg.notify=!on
  if(id==='cfgKeepalive')cfg.keepalive=!on
}

async function fetchModels(){
  const api=document.getElementById('cfgApi').value.trim()
  const key=document.getElementById('cfgKey').value.trim()
  const btn=document.getElementById('fetchModelsBtn')
  btn.textContent='获取中…'
  btn.disabled=true
  try{
    const res=await fetch(api+'/models',{headers:{'Authorization':'Bearer '+key}})
    const j=await res.json()
    const list=(j.data||[]).map(m=>m.id).filter(Boolean)
    if(!list.length)throw new Error('empty')
    localStorage.setItem('model_list',JSON.stringify(list))
    const sel=document.getElementById('cfgModel')
    sel.innerHTML=''
    list.forEach(m=>{
      const o=document.createElement('option')
      o.value=m;o.textContent=m
      if(m===cfg.model)o.selected=true
      sel.appendChild(o)
    })
    btn.textContent='已更新 ✓'
  }catch{
    btn.textContent='失败'
  }
  setTimeout(()=>{btn.textContent='获取模型';btn.disabled=false},2000)
}

async function fetchImgModels(){
  const api=document.getElementById('cfgImgApi').value.trim()
  const key=document.getElementById('cfgImgKey').value.trim()
  const btn=document.getElementById('fetchImgModelsBtn')
  btn.textContent='获取中…'
  btn.disabled=true
  try{
    const res=await fetch(api+'/models',{headers:{'Authorization':'Bearer '+key}})
    const j=await res.json()
    const list=(j.data||[]).map(m=>m.id).filter(Boolean)
    if(!list.length)throw new Error('empty')
    localStorage.setItem('img_model_list',JSON.stringify(list))
    const sel=document.getElementById('cfgImgModel')
    sel.innerHTML=''
    list.forEach(m=>{
      const o=document.createElement('option')
      o.value=m;o.textContent=m
      sel.appendChild(o)
    })
    btn.textContent='已更新 ✓'
  }catch{
    btn.textContent='失败'
  }
  setTimeout(()=>{btn.textContent='获取模型';btn.disabled=false},2000)
}

function saveCfg(){
  cfg.api=document.getElementById('cfgApi').value.trim()||DEFAULT_API
  cfg.key=document.getElementById('cfgKey').value.trim()||DEFAULT_KEY
  cfg.model=document.getElementById('cfgModel').value||DEFAULT_MODEL
  cfg.temp=parseFloat(document.getElementById('cfgTemp').value)
  localStorage.setItem('cfg_api',cfg.api)
  localStorage.setItem('cfg_key',cfg.key)
  localStorage.setItem('cfg_model',cfg.model)
  localStorage.setItem('cfg_temp',cfg.temp)
  localStorage.setItem('cfg_notify',cfg.notify)
  localStorage.setItem('cfg_keepalive',cfg.keepalive)
  localStorage.setItem('cfg_img_api',document.getElementById('cfgImgApi').value.trim())
  localStorage.setItem('cfg_img_key',document.getElementById('cfgImgKey').value.trim())
  localStorage.setItem('cfg_pos_prom',document.getElementById('cfgPosProm').value.trim())
  localStorage.setItem('cfg_neg_prom',document.getElementById('cfgNegProm').value.trim())
  const imgSel=document.getElementById('cfgImgModel')
  if(imgSel.value)localStorage.setItem('cfg_img_model',imgSel.value)
  showToast('已保存')
}

function showToast(msg){
  let t=document.getElementById('toast')
  if(!t){
    t=document.createElement('div')
    t.id='toast'
    t.style.cssText='position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.7);color:#fff;padding:8px 18px;border-radius:20px;font-size:13px;z-index:999;pointer-events:none;transition:opacity .3s'
    document.body.appendChild(t)
  }
  t.textContent=msg
  t.style.opacity='1'
  clearTimeout(t._t)
  t._t=setTimeout(()=>t.style.opacity='0',1500)
}

function changeAvatar(e){
  const file=e.target.files[0]
  if(!file)return
  const reader=new FileReader()
  reader.onload=ev=>{
    const old=document.getElementById('sbAvatar')
    const img=document.createElement('img')
    img.className='sb-avatar'
    img.id='sbAvatar'
    img.src=ev.target.result
    img.ondblclick=()=>document.getElementById('avatarInput').click()
    old.parentNode.replaceChild(img,old)
  }
  reader.readAsDataURL(file)
}