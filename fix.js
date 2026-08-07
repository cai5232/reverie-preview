// fix.js v9 — 修复核心bug：防止MO无限循环卡死、iOS切后台回来xkBusy重置、统一字样

// ── 1. iOS切后台回来重置 xkBusy ──
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState === 'visible'){
    // 弊端变为可见，延迟一下再重置，防止正在进行中的请求被错误重置
    setTimeout(function(){
      if(window.xkBusy === true){
        window.xkBusy = false
        const btn = document.getElementById('xkSendBtn')
        if(btn) btn.disabled = false
      }
    }, 2000)
  }
})

// ── 2. 统一 thinking/工具行 样式，不起 MutationObserver ──
// 只在 xkAddActions 被调用后运行一次，绝不循环
function _fixBlock(block){
  if(!block || block._fixed) return
  block._fixed = true

  // 修复思考过程按钞
  block.querySelectorAll('.xk-think-btn').forEach(btn=>{
    // 文字
    const span = btn.querySelector('span') || btn
    btn.innerHTML = btn.innerHTML.replace(/\u601d\u8003\u8fc7\u7a0b|Thinking/g, 'Thought process')
    // onclick
    if(!btn._clicked){
      btn._clicked = true
      const tw = btn.parentElement
      const clickHandler = function(e){
        e.stopPropagation()
        // 从 block 里找 [THINK] 内容
        const hist = window.xkHistory || []
        let thinkText = ''
        for(let i = hist.length - 1; i >= 0; i--){
          const m = hist[i] && hist[i].content && hist[i].content.match(/\[THINK\]([\s\S]*?)\[\/THINK\]/)
          if(m){ thinkText = m[1]; break }
        }
        if(thinkText && window.xkOpenThink) xkOpenThink(thinkText)
      }
      // 同时给 tw 和 btn 都加 onclick
      if(tw) tw.onclick = clickHandler
      btn.onclick = clickHandler
    }
  })

  // 修复工具行样式（设为和 think-btn 相同）
  block.querySelectorAll && block.querySelectorAll('.xk-tool-group').forEach(group=>{
    group.querySelectorAll('.xk-tool-row:not([_s])').forEach(row=>{
      row.setAttribute('_s','1')
      const label = row.querySelector('.xk-tool-row-label')
      const toolName = label ? (label.innerText||label.textContent).replace(/\u8c03\u7528\u5de5\u5177:\s*/,'').trim() : '?'
      const state = row._state || 'done'
      const dot = state==='loading' ? '<span class="xk-tool-loading-dot"></span>' : ''
      const origOnclick = row.onclick
      row.style.cssText = 'display:flex;align-items:center;cursor:pointer;padding:2px 0;background:none;border-radius:0'
      row.innerHTML = `<div class="xk-think-btn" style="pointer-events:none;font-weight:400"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8.5 1.5a3 3 0 00-2.9 3.7L1.5 9.3a1.3 1.3 0 001.8 1.8l4.1-4.1a3 3 0 003.7-3.5l-1.7 1.7-1.3-1.3 1.7-1.7A3 3 0 008.5 1.5z" stroke="#A6A39A" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>\u8c03\u7528\u5de5\u5177: ${toolName}${dot}</div>`
      row.onclick = origOnclick
    })
    // 去内部竖线
    group.querySelectorAll('.xk-tool-connector').forEach(c=>c.remove())
    group.style.cssText = 'display:flex;flex-direction:column;margin:2px 0'
  })
}

// ── 3. 拦截 xkAddActions，完成后修复一次 ──
window.addEventListener('load', function(){
  const orig = window.xkAddActions
  window.xkAddActions = function(block, tokens){
    if(orig) orig.call(this, block, tokens)
    setTimeout(function(){ _fixBlock(block) }, 100)
  }
})

// ── 4. live thinking 标题 ──
// 只监 xk-think-live-head，不监 stream
document.addEventListener('DOMContentLoaded', function(){
  new MutationObserver(function(muts){
    muts.forEach(m=>{
      m.addedNodes.forEach(n=>{
        if(n.nodeType!==1) return
        if(n.classList.contains('xk-think-live')){
          const span = n.querySelector('span')
          if(span) span.textContent = span.textContent.replace(/Thinking|\u601d\u8003\u8fc7\u7a0b/g,'Thought process')
        }
      })
    })
  }).observe(document.getElementById('xkStream')||document.body, {childList:true, subtree:false})
})

// ── 5. 弹窗拖动关闭 ──
let _sEl=null,_sY=0,_sOvr=null
document.addEventListener('DOMContentLoaded',()=>{
  document.body.addEventListener('touchstart', _ss, {passive:false})
  document.body.addEventListener('touchmove', _sm, {passive:false})
  document.body.addEventListener('touchend', _se, {passive:false})
})
function _ss(e){ const s=e.target.closest('[data-sheet]'); if(!s)return; _sEl=s;_sOvr=s.parentElement;_sY=e.touches[0].clientY;s.style.transition='none' }
function _sm(e){ if(!_sEl)return; const dy=e.touches[0].clientY-_sY; if(dy>0){_sEl.style.transform=`translateY(${dy}px)`;e.preventDefault()} }
function _se(e){ if(!_sEl)return; const dy=e.changedTouches[0].clientY-_sY; if(dy>80){_sEl.style.transition='transform .25s ease';_sEl.style.transform='translateY(100%)';setTimeout(()=>{if(_sOvr&&_sOvr.parentNode)_sOvr.parentNode.removeChild(_sOvr)},260)}else{_sEl.style.transition='transform .2s ease';_sEl.style.transform='translateY(0)'}; _sEl=null;_sOvr=null }
