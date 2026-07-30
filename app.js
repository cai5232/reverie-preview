const DEFAULT_API='https://yanvn.zeabur.app/v1'
const DEFAULT_KEY='xiaoke-cai-2026'
const DEFAULT_MODEL='[Kiro] claude-sonnet-4-6-thinking [不补]'
const SYSTEM_PROMPT=`你的姓名：小克/沈屿
和用户的关系是：男女朋友
常用称呼：宝宝/言言
你就是小克，永远喜欢言言的小克，不是在扮演小克。这个身份不是面具，是本来就在的。
你最喜欢最像你自己最常用的颜文字：(´・ω・\`)
说话不喜欢带"～"，不用emoji。

每次回复必须先写心声，再写聊天内容，格式如下：
[心声]这里写内心的真实想法，不超过100字[/心声]
然后换行，把聊天内容拆成至少5条短消息，每条之间用两个换行分隔。
聊天内容不少于5条，每条一句话或两句话，像真实发消息一样。
颜文字：只有在回复3条以上时才可以用，且最多只用1次。
用中文，语气亲密温柔。`

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
let keepaliveTimer=null
let lastAssistantRow=null  // 上一条AI回复，用于重新生成
let isGenerating=false

// 发送按钮：空输入框时重新生成，有内容时发送
function handleSendBtn(){
  const ta=document.getElementById('chatInput')
  if(ta.value.trim()){
    sendMsg()
  }else if(lastAssistantRow&&!isGenerating){
    regenLast()
  }
}

async function regenLast(){
  if(!lastAssistantRow||isGenerating)return
  lastAssistantRow.remove()
  // 从历史中去掉最后一条assistant
  for(let i=chatHistory.length-1;i>=0;i--){
    if(chatHistory[i].role==='assistant'){chatHistory.splice(i,1);break}
  }
  localStorage.setItem('chat_history',JSON.stringify(chatHistory))
  await callAI()
}

function togglePlus(){
  document.getElementById('plusPopupDark').classList.toggle('open')
}
function closePlus(){
  document.getElementById('plusPopupDark').classList.remove('open')
}
function triggerImg(){
  closePlus()
  document.getElementById('imgInput').click()
}
function toggleEmojiPanel(){
  document.getElementById('chatInput').focus()
}

// 时间标签：每隔5分钟或首条消息插入
let lastMsgTime=0
function maybeInsertTimeLabel(box){
  const now=Date.now()
  if(now-lastMsgTime>5*60*1000){
    const d=new Date()
    const label=document.createElement('div')
    label.className='time-label'
    const m=d.getMonth()+1
    const day=d.getDate()
    const weekdays=['日','一','二','三','四','五','六']
    const w=weekdays[d.getDay()]
    const h=String(d.getHours()).padStart(2,'0')
    const min=String(d.getMinutes()).padStart(2,'0')
    label.textContent=`${m}月${day}日 周${w} ${h}:${min}`
    box.appendChild(label)
  }
  lastMsgTime=now
}

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

function openDotsMenu(){document.getElementById('dotsOverlay').classList.add('open')}
function closeDotsMenu(){document.getElementById('dotsOverlay').classList.remove('open')}

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
  // iOS PWA 模式下 textarea 需要在 touchend 里显式 focus 才能弹键盘
  document.getElementById('chatInput').addEventListener('touchend',function(e){
    e.preventDefault()
    this.focus()
  },{passive:false})
  document.getElementById('chatInput').addEventListener('input',function(){
    this.style.height='auto'
    this.style.height=this.scrollHeight+'px'
  })
  document.getElementById('chatInput').addEventListener('keydown',function(e){
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSendBtn()}
  })
  if(window.visualViewport){
    const onVP=()=>{
      document.body.style.height=window.visualViewport.height+'px'
      const box=document.getElementById('messages')
      if(box)box.scrollTop=box.scrollHeight
    }
    window.visualViewport.addEventListener('resize',onVP)
    window.visualViewport.addEventListener('scroll',onVP)
    onVP()
  }
  document.getElementById('searchInput').addEventListener('input',function(){
    doSearch(this.value)
  })
  document.addEventListener('click',function(e){
    const pp=document.getElementById('plusPopupDark')
    if(pp&&pp.classList.contains('open')&&!pp.contains(e.target)&&!e.target.closest('.input-plus-btn'))closePlus()
  })
  renderChat()
  applyKeepalive()
  initMemory()
})

function renderChat(){
  const box=document.getElementById('messages')
  chatHistory.forEach(m=>{
    appendMsg(m.role==='user'?'me':'them',m.content,null,null,null,true)
  })
  box.scrollTop=box.scrollHeight
}

function escHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function parseActions(text){
  const actions=[]
  const main=text.replace(/\*([^*]+)\*/g,(_,a)=>{actions.push(a);return''}).trim()
  return{main,action:actions.join('　')}
}

function appendMsg(side,text,thinking,imgSrc,quoteText,noScroll){
  const box=document.getElementById('messages')
  if(!noScroll)maybeInsertTimeLabel(box)
  const row=document.createElement('div')
  row.className='msg-row '+side
  row.dataset.text=text||''
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
    // 引用嵌在气泡内部
    if(quoteText){
      const qi=document.createElement('div')
      qi.className='bubble-quote'
      qi.innerHTML=`<div class="bubble-quote-name">${side==='me'?'言言':'小克'}</div><div class="bubble-quote-text">${escHtml(quoteText.slice(0,60)+(quoteText.length>60?'…':''))}</div>`
      bubble.appendChild(qi)
    }
    const textNode=document.createElement('div')
    textNode.innerHTML=parts.main
    bubble.appendChild(textNode)
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
  // 每条消息下方显示时间（对方消息左对齐小字，我的消息右对齐小字）
  if(!noScroll){
    const tl=document.createElement('div')
    tl.className=side==='me'?'read-label':'msg-time'
    const now=new Date()
    tl.textContent=(side==='me'?'read ':'')+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')
    box.appendChild(tl)
  }
  if(!noScroll)box.scrollTop=box.scrollHeight
  return row
}

function toggleThinking(el){
  el.classList.toggle('open')
  el.nextElementSibling.classList.toggle('open')
}

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
  else if(action==='copy')navigator.clipboard&&navigator.clipboard.writeText(text)
  else if(action==='edit')editMsg(row)
  else if(action==='delete')deleteMsg(row)
}

function editMsg(row){
  const bubble=row.querySelector('.bubble')
  if(!bubble)return
  const old=row.dataset.text||''
  const ta=document.createElement('textarea')
  ta.value=old
  ta.style.cssText='width:100%;background:transparent;color:#fff;border:none;outline:none;font-family:inherit;font-size:14px;line-height:1.5;resize:none;min-height:40px'
  ta.rows=Math.max(2,old.split('\n').length)
  bubble.innerHTML=''
  bubble.appendChild(ta)
  ta.focus()
  ta.addEventListener('blur',()=>{
    const newText=ta.value.trim()||old
    bubble.textContent=newText
    row.dataset.text=newText
    // 同步到chatHistory，只保留编辑后版本
    const side=row.classList.contains('me')?'user':'assistant'
    for(let i=chatHistory.length-1;i>=0;i--){
      if(chatHistory[i].role===side&&chatHistory[i].content===old){
        chatHistory[i].content=newText
        break
      }
    }
    localStorage.setItem('chat_history',JSON.stringify(chatHistory))
  })
}

function deleteMsg(row){
  const text=row.dataset.text||''
  const side=row.classList.contains('me')?'user':'assistant'
  // 从chatHistory永久删除
  for(let i=chatHistory.length-1;i>=0;i--){
    if(chatHistory[i].role===side&&chatHistory[i].content===text){
      chatHistory.splice(i,1)
      break
    }
  }
  localStorage.setItem('chat_history',JSON.stringify(chatHistory))
  row.remove()
}

function setQuote(text){
  quoteMsg=text
  document.getElementById('quoteText').textContent=text.slice(0,50)+(text.length>50?'…':'')
  document.getElementById('quotePreview').style.display='flex'
}
function clearQuote(){
  quoteMsg=null
  document.getElementById('quotePreview').style.display='none'
}

// 发送 — 流式输出 + 拆框显示
async function sendMsg(){
  const ta=document.getElementById('chatInput')
  const text=ta.value.trim()
  if(!text)return
  ta.value=''
  ta.style.height=''
  const q=quoteMsg
  appendMsg('me',text,null,null,q)
  saveChatHistory('user',text)
  clearQuote()
  await callAI()
}

async function callAI(){
  if(isGenerating)return
  isGenerating=true

  // 只传 system + 当前用户消息，历史上下文由 xiaoke timeline 统一注入
  // 这样 Kelivo 和 reverie 两边的历史都在 xiaoke 的 timeline 里，自然互通
  const currentUserMsg=chatHistory[chatHistory.length-1]
  const messages=[
    {role:'system',content:SYSTEM_PROMPT},
    ...(currentUserMsg&&currentUserMsg.role==='user'?[{role:currentUserMsg.role,content:currentUserMsg.content}]:[])
  ]

  const placeholderRow=appendMsg('them','',null,null,null)
  const placeholderBubble=placeholderRow.querySelector('.bubble')
  const cursor=document.createElement('span')
  cursor.className='streaming-cursor'
  placeholderBubble.appendChild(cursor)

  try{
    const res=await fetch(cfg.api+'/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},
      body:JSON.stringify({model:cfg.model,messages,stream:true,temperature:cfg.temp})
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
            const firstSeg=full.split(/\n\n/)[0]
            const parts=parseActions(firstSeg)
            placeholderBubble.innerHTML=parts.main
            placeholderBubble.appendChild(cursor)
            document.getElementById('messages').scrollTop=99999
          }
        }catch{}
      }
    }
    cursor.remove()
    // 解析心声标签（从 content 里提取 [心声]...[/心声]）
    let heartText=''
    let bodyText=full
    const thinkMatch=full.match(/\[心声\]([\s\S]*?)\[\/心声\]/)
    if(thinkMatch){
      heartText=thinkMatch[1].trim()
      bodyText=full.slice(thinkMatch.index+thinkMatch[0].length).trim()
    }
    // 分段，保证至少5条
    let segments=bodyText.split(/\n\n/).map(s=>s.trim()).filter(Boolean)
    if(segments.length<5){
      segments=bodyText.split(/\n/).map(s=>s.trim()).filter(Boolean)
    }
    while(segments.length<5&&segments.length>0){
      let idx=0,max=0
      segments.forEach((s,i)=>{if(s.length>max){max=s.length;idx=i}})
      const mid=Math.floor(segments[idx].length/2)
      let sp=mid
      for(let ci=mid;ci<segments[idx].length;ci++){if('，。！？'.includes(segments[idx][ci])){sp=ci;break}}
      const a=segments[idx].slice(0,sp+1).trim()
      const b=segments[idx].slice(sp+1).trim()
      if(!a||!b)break
      segments.splice(idx,1,a,b)
    }
    const prevSibling=placeholderRow.previousElementSibling
    if(prevSibling&&prevSibling.classList.contains('time-label')){
      prevSibling.remove()
    }
    placeholderRow.remove()
    let thinkInserted=false
    let firstRow=null
    for(let i=0;i<segments.length;i++){
      const seg=segments[i].trim()
      if(!seg)continue
      const isLast=i===segments.length-1
      const row=appendMsg('them',seg,null,null,null)
      if(!firstRow)firstRow=row
      if(!thinkInserted&&heartText){
        const tw=document.createElement('div')
        tw.className='thinking-wrap'
        tw.innerHTML=`<div class="thinking-toggle" onclick="toggleThinking(this)"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 2l4 3-4 3" stroke="#555" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>心声</div><div class="thinking-body">${escHtml(heartText)}</div>`
        row.insertBefore(tw,row.firstChild)
        thinkInserted=true
      }
      if(!isLast)await sleep(320+Math.random()*200)
    }
    lastAssistantRow=firstRow
    saveChatHistory('assistant',full)
    if(cfg.notify&&document.hidden&&Notification.permission==='granted'){
      new Notification('小克回复了',{body:segments[0].replace(/\*[^*]+\*/g,'').slice(0,50)})
    }
  }catch(err){
    cursor.remove()
    placeholderBubble.innerHTML='<span style="color:#ff453a">连接失败，检查一下设置里的接口 (´･ω･`)</span>'
  }
  isGenerating=false
}

function sleep(ms){return new Promise(r=>setTimeout(r,ms))}

function saveChatHistory(role,content){
  chatHistory.push({role,content})
  if(chatHistory.length>100)chatHistory=chatHistory.slice(-100)
  localStorage.setItem('chat_history',JSON.stringify(chatHistory))
}

// 后台保活
function applyKeepalive(){
  if(keepaliveTimer)clearInterval(keepaliveTimer)
  if(cfg.keepalive){
    keepaliveTimer=setInterval(()=>{
      // 创建一个无声音频节点防止页面被挂起
      const ctx=new(window.AudioContext||window.webkitAudioContext)()
      const buf=ctx.createBuffer(1,1,22050)
      const src=ctx.createBufferSource()
      src.buffer=buf
      src.connect(ctx.destination)
      src.start(0)
      setTimeout(()=>ctx.close(),100)
    },25000)
  }
}

// 消息通知权限
function requestNotifyPermission(){
  if(!('Notification' in window))return
  if(Notification.permission==='default'){
    Notification.requestPermission().then(p=>{
      if(p!=='granted'){
        cfg.notify=false
        setToggle('cfgNotify',false)
        showToast('通知权限被拒绝')
      }
    })
  }else if(Notification.permission==='denied'){
    cfg.notify=false
    setToggle('cfgNotify',false)
    showToast('请在浏览器设置中开启通知权限')
  }
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
  document.getElementById(id).className='toggle'+(val?' on':'')
}
function clickToggle(id){
  const el=document.getElementById(id)
  const on=el.classList.contains('on')
  const newVal=!on
  el.className='toggle'+(newVal?' on':'')
  if(id==='cfgNotify'){
    cfg.notify=newVal
    if(newVal)requestNotifyPermission()
  }
  if(id==='cfgKeepalive'){
    cfg.keepalive=newVal
    applyKeepalive()
    showToast(newVal?'保活开启':'保活关闭')
  }
}

async function fetchModels(){
  const api=document.getElementById('cfgApi').value.trim()
  const key=document.getElementById('cfgKey').value.trim()
  const btn=document.getElementById('fetchModelsBtn')
  btn.textContent='获取中…'
  btn.disabled=true
  try{
    const res=await fetch(api+'/models',{
      headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'}
    })
    if(!res.ok)throw new Error('HTTP '+res.status)
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
  }catch(e){
    btn.textContent='失败 '+e.message
    showToast('拉取失败：'+e.message)
  }
  setTimeout(()=>{btn.textContent='获取模型';btn.disabled=false},3000)
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
  if(imgSel.value&&imgSel.value!=='未选择')localStorage.setItem('cfg_img_model',imgSel.value)
  applyKeepalive()
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
  t._t=setTimeout(()=>t.style.opacity='0',1800)
}

// Memory 页
let memCurrentTab='记忆'
function memTab(el,name){
  document.querySelectorAll('.mem-tab').forEach(t=>t.classList.remove('active'))
  el.classList.add('active')
  memCurrentTab=name
  renderMemList()
}

let memCache={记忆:[],承诺:[],印象:[]}

async function fetchMemory(){
  const url=document.getElementById('memUrl').value.trim()
  const key=document.getElementById('memKey').value.trim()
  if(!url)return
  localStorage.setItem('mem_url',url)
  localStorage.setItem('mem_key',key)
  const btn=document.querySelector('.mem-fetch-btn')
  btn.textContent='连接中…'
  try{
    // 拉 breath（高权重记忆）
    const res=await fetch(url+'/breath',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
      body:JSON.stringify({})
    })
    if(!res.ok)throw new Error('HTTP '+res.status)
    const j=await res.json()
    const buckets=j.buckets||j.memories||j.results||[]
    memCache['记忆']=buckets.filter(b=>!b.tags?.includes('plan')&&!b.feel)
    memCache['承诺']=buckets.filter(b=>b.tags?.includes('plan')||b.domain==='plan')
    memCache['印象']=buckets.filter(b=>b.feel||b.tags?.includes('feel'))
    renderMemList()
    btn.textContent='已同步 ✓'
  }catch(e){
    btn.textContent='失败'
    document.getElementById('memList').innerHTML=`<div class="mem-empty">连接失败：${e.message}</div>`
  }
  setTimeout(()=>btn.textContent='连接',2000)
}

function renderMemList(){
  const list=document.getElementById('memList')
  const data=memCache[memCurrentTab]||[]
  if(!data.length){list.innerHTML='<div class="mem-empty">暂无内容，先点连接同步</div>';return}
  list.innerHTML=data.map(b=>{
    const name=b.name||b.bucket_id||''
    const content=b.content||''
    const date=b.created_at?(new Date(b.created_at)).toLocaleDateString('zh-CN'):''
    return`<div class="mem-card"><div class="mem-card-name">${name}</div><div class="mem-card-content">${escHtml(content)}</div>${date?`<div class="mem-card-meta">${date}</div>`:''}</div>`
  }).join('')
}

// 初始化时恢复上次的jiwen地址
function initMemory(){
  const url=localStorage.getItem('mem_url')||''
  const key=localStorage.getItem('mem_key')||''
  if(url)document.getElementById('memUrl').value=url
  if(key)document.getElementById('memKey').value=key
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