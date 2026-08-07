// fix.js v8 — 直接替换 xkAgenticLoop 和 xkRenderAI，不再依赖 MutationObserver

function _insertThinkBtn(streamBlock, thinkText){
  if(!thinkText) return
  const existing = streamBlock.querySelector('.xk-thinking[data-inserted]')
  if(existing) return  // 已插过就不重复
  const tw = document.createElement('div')
  tw.className = 'xk-thinking'
  tw.setAttribute('data-inserted','1')
  const btn = document.createElement('div')
  btn.className = 'xk-think-btn'
  btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.7" stroke="#A6A39A" stroke-width="1.1"/><path d="M6.5 3.8v3l1.7 1.7" stroke="#A6A39A" stroke-width="1.1" stroke-linecap="round"/></svg>Thought process`
  const _t = thinkText
  btn.onclick = () => xkOpenThink(_t)
  tw.appendChild(btn)
  streamBlock.insertBefore(tw, streamBlock.firstChild)
}

// 工具行也统一成 xk-think-btn 样式
function _styleToolGroup(group){
  const rows = group.querySelectorAll('.xk-tool-row')
  rows.forEach(row=>{
    if(row._restyled) return
    row._restyled = true
    const label = row.querySelector('.xk-tool-row-label')
    const name = label ? (label.innerText||label.textContent).replace(/调用工具:\s*/,'').replace(/[●•]/g,'').trim() : ''
    const state = row._state || 'done'
    const dot = state==='loading' ? '<span class="xk-tool-loading-dot"></span>' : ''
    const origOnclick = row._openDetail || row.onclick
    row._openDetail = origOnclick
    row.style.cssText = 'display:flex;align-items:center;cursor:pointer;padding:0;background:none;border-radius:0'
    row.innerHTML = `<div class="xk-think-btn" style="pointer-events:none"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8.5 1.5a3 3 0 00-2.9 3.7L1.5 9.3a1.3 1.3 0 001.8 1.8l4.1-4.1a3 3 0 003.7-3.5l-1.7 1.7-1.3-1.3 1.7-1.7A3 3 0 008.5 1.5z" stroke="#A6A39A" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>调用工具: ${_esc(name)}${dot}</div>`
    row.onclick = origOnclick
  })
  // 去除组内内部竖线
  group.querySelectorAll('.xk-tool-connector').forEach(c=>c.remove())
  group.style.cssText = 'display:flex;flex-direction:column;margin:2px 0 4px'
}

function _esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

function _addConn(parent, before){
  const p = before.previousElementSibling
  if(p && p.classList.contains('xk-tool-connector')) return
  const c = document.createElement('div')
  c.className = 'xk-tool-connector'
  c.style.cssText = 'width:1px;height:10px;background:#E0DDD8;margin:0 0 0 6px'
  parent.insertBefore(c, before)
}

function _connectInStream(){
  const stream = document.getElementById('xkStream')
  if(!stream) return
  const kids = Array.from(stream.children).filter(n=>!n.classList.contains('xk-tool-connector'))
  kids.forEach((n,i)=>{
    const isTP = n.classList.contains('xk-thinking') || n.getAttribute('data-inserted')
    const isTG = n.classList.contains('xk-tool-group')
    if((isTP || isTG) && i>0){
      const prev = kids[i-1]
      const prevTP = prev.classList.contains('xk-thinking') || prev.getAttribute('data-inserted')
      const prevTG = prev.classList.contains('xk-tool-group')
      if(prevTP || prevTG) _addConn(stream, n)
    }
  })
}

window.addEventListener('load', function(){
  if(!window.xkAgenticLoop) return

  const _origLoop = window.xkAgenticLoop

  window.xkAgenticLoop = async function(sendOptions, mcpServerMap, round){
    if(round > 8) return
    await _origLoop.call(this, sendOptions, mcpServerMap, round)
    // 修复：清理当前 stream 里的所有 xk-ai-block
    const stream = document.getElementById('xkStream')
    if(!stream) return

    // 修复所有 thinking 节点
    stream.querySelectorAll('.xk-thinking:not([data-inserted])').forEach(tw=>{
      const btn = tw.querySelector('.xk-think-btn')
      if(btn){
        btn.innerHTML = btn.innerHTML.replace(/Thinking|思考过程/g,'Thought process')
        if(!btn.onclick && !btn._fixedClick){
          btn._fixedClick = true
          btn.onclick = function(){
            const hist = window.xkHistory||[]
            for(let i=hist.length-1;i>=0;i--){
              const m=hist[i]&&hist[i].content&&hist[i].content.match(/\[THINK\]([\s\S]*?)\[\/THINK\]/)
              if(m){xkOpenThink(m[1]);return}
            }
          }
        }
      }
    })

    // 修复工具组样式
    stream.querySelectorAll('.xk-tool-group').forEach(_styleToolGroup)

    // 插入竖线
    _connectInStream()
  }

  // 同时修复 xkRenderAI 里的 thinking 按钞文字
  const _origRenderAI = window.xkRenderAI
  window.xkRenderAI = function(bodyText, thinkText){
    const block = _origRenderAI ? _origRenderAI.call(this, bodyText, thinkText) : null
    if(block){
      block.querySelectorAll('.xk-think-btn').forEach(btn=>{
        btn.innerHTML = btn.innerHTML.replace(/Thinking|思考过程/g,'Thought process')
      })
    }
    return block
  }

  // xkAddActions 也拦截一下
  const _origAddActions = window.xkAddActions
  window.xkAddActions = function(block, tokens){
    if(_origAddActions) _origAddActions.call(this, block, tokens)
    if(!block) return
    block.querySelectorAll('.xk-think-btn').forEach(btn=>{
      btn.innerHTML = btn.innerHTML.replace(/Thinking|思考过程/g,'Thought process')
      if(!btn.onclick && !btn._fixedClick){
        btn._fixedClick = true
        const tw = btn.closest('.xk-thinking')
        if(tw) tw.onclick = function(){
          const hist=window.xkHistory||[]
          for(let i=hist.length-1;i>=0;i--){
            const m=hist[i]&&hist[i].content&&hist[i].content.match(/\[THINK\]([\s\S]*?)\[\/THINK\]/)
            if(m){xkOpenThink(m[1]);return}
          }
        }
      }
    })
    setTimeout(_connectInStream, 50)
  }
})

// live thinking 区标题也改
const _obs2 = new MutationObserver(()=>{
  document.querySelectorAll('.xk-think-live-head span').forEach(s=>{
    s.textContent = s.textContent.replace(/Thinking|思考过程/g,'Thought process')
  })
  document.querySelectorAll('.xk-think-btn').forEach(btn=>{
    if(btn.innerHTML.includes('思考过程')||btn.innerHTML.includes('Thinking')){
      btn.innerHTML = btn.innerHTML.replace(/Thinking|思考过程/g,'Thought process')
    }
  })
  document.querySelectorAll('.xk-tool-group:not([_sty])').forEach(g=>{
    g.setAttribute('_sty','1')
    _styleToolGroup(g)
  })
})
document.addEventListener('DOMContentLoaded',()=>{
  const stream = document.getElementById('xkStream')
  if(stream) _obs2.observe(stream,{childList:true,subtree:true})
})

// 弹窗拖动关闭
let _sEl=null,_sY=0,_sOvr=null
document.addEventListener('DOMContentLoaded',()=>{
  document.body.addEventListener('touchstart', _ss, {passive:false})
  document.body.addEventListener('touchmove', _sm, {passive:false})
  document.body.addEventListener('touchend', _se, {passive:false})
})
function _ss(e){ const s=e.target.closest('[data-sheet]'); if(!s)return; _sEl=s;_sOvr=s.parentElement;_sY=e.touches[0].clientY;s.style.transition='none' }
function _sm(e){ if(!_sEl)return; const dy=e.touches[0].clientY-_sY; if(dy>0){_sEl.style.transform=`translateY(${dy}px)`;e.preventDefault()} }
function _se(e){ if(!_sEl)return; const dy=e.changedTouches[0].clientY-_sY; if(dy>80){_sEl.style.transition='transform .25s ease';_sEl.style.transform='translateY(100%)';setTimeout(()=>{if(_sOvr&&_sOvr.parentNode)_sOvr.parentNode.removeChild(_sOvr)},260)}else{_sEl.style.transition='transform .2s ease';_sEl.style.transform='translateY(0)'}; _sEl=null;_sOvr=null }
