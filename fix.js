// fix.js v11 — 事件代理 + 去重 + 切后台重置 + 弹窗拖拽

// ── 1. 全局点击代理：拦截所有 .xk-think-btn 点击 ──
// 不管 btn 有没有 onclick，都能弹出内容
document.addEventListener('click', function(e){
  const btn = e.target.closest('.xk-think-btn')
  if(!btn) return
  // 阻止冒泡防止触发两次
  // 先看 btn 父级有没有存 thinkText
  const tw = btn.parentElement
  const thinkText = tw && tw._thinkText
  if(thinkText){
    if(window.xkOpenThink) xkOpenThink(thinkText)
    return
  }
  // 否则从历史里拿最近一条 thinking
  const hist = window.xkHistory || []
  for(let i=hist.length-1; i>=0; i--){
    const m = hist[i] && hist[i].content && hist[i].content.match(/\[THINK\]([\s\S]*?)\[\/THINK\]/)
    if(m){
      if(window.xkOpenThink) xkOpenThink(m[1])
      return
    }
  }
}, true)  // capture=true 在其他onclick之前执行

// ── 2. 去重 + 文字替换：监听 xkStream 直接子节点 ──
function _fixStream(){
  const stream = document.getElementById('xkStream')
  if(!stream) return

  let foundThink = false
  Array.from(stream.children).forEach(node=>{
    if(node.classList.contains('xk-thinking')){
      if(foundThink){
        // 第二个以后的直接删掉
        node.remove()
        return
      }
      foundThink = true
      // 修文字
      const btn = node.querySelector('.xk-think-btn')
      if(btn) btn.innerHTML = btn.innerHTML.replace(/思考过程|Thinking/g,'Thought process')
      // 存 thinkText 到父节点备用（从历史最后一条取）
      const hist = window.xkHistory || []
      for(let i=hist.length-1;i>=0;i--){
        const m = hist[i]&&hist[i].content&&hist[i].content.match(/\[THINK\]([\s\S]*?)\[\/THINK\]/)
        if(m){ node._thinkText = m[1]; break }
      }
    }
    // 修改工具行文字
    if(node.classList.contains('xk-tool-group')){
      node.querySelectorAll('.xk-tool-row').forEach(row=>{
        const lbl = row.querySelector('.xk-tool-row-label')
        if(lbl && lbl.innerHTML.includes('<b>')){
          // 已经是老样式，不动
        }
      })
    }
  })

  // 修 xk-ai-block 里的 thinking（btn2 那个）
  document.querySelectorAll('.xk-ai-block').forEach(block=>{
    block.querySelectorAll('.xk-thinking').forEach(tw=>{
      const btn = tw.querySelector('.xk-think-btn')
      if(btn) btn.innerHTML = btn.innerHTML.replace(/思考过程|Thinking/g,'Thought process')
    })
  })
}

document.addEventListener('DOMContentLoaded', function(){
  const stream = document.getElementById('xkStream')
  if(stream){
    new MutationObserver(()=>{
      clearTimeout(stream._ft)
      stream._ft = setTimeout(_fixStream, 50)
    }).observe(stream, {childList:true, subtree:false})
  }

  // 修 live-head 里的文字
  const streamFull = document.getElementById('xkStream')
  if(streamFull){
    new MutationObserver(muts=>{
      muts.forEach(m=>m.addedNodes.forEach(n=>{
        if(!n.querySelectorAll) return
        n.querySelectorAll('.xk-think-live-head span, .xk-think-btn').forEach(el=>{
          el.textContent = el.textContent.replace(/思考过程|Thinking/g,'Thought process')
        })
      }))
    }).observe(streamFull, {childList:true, subtree:true})
  }

  // ── 3. 切后台重置 xkBusy ──
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'visible'){
      setTimeout(function(){
        if(window.xkBusy === true){
          window.xkBusy = false
          var btn = document.getElementById('xkSendBtn')
          if(btn) btn.disabled = false
        }
      }, 2000)
    }
  })

  // ── 4. 弹窗拖拽关闭 ──
  document.body.addEventListener('touchstart', _ss, {passive:false})
  document.body.addEventListener('touchmove', _sm, {passive:false})
  document.body.addEventListener('touchend', _se, {passive:false})
})

var _sEl=null, _sY=0, _sOvr=null
function _ss(e){ var s=e.target.closest('[data-sheet]'); if(!s)return; _sEl=s;_sOvr=s.parentElement;_sY=e.touches[0].clientY;s.style.transition='none' }
function _sm(e){ if(!_sEl)return; var dy=e.touches[0].clientY-_sY; if(dy>0){_sEl.style.transform='translateY('+dy+'px)';e.preventDefault()} }
function _se(e){ if(!_sEl)return; var dy=e.changedTouches[0].clientY-_sY; if(dy>80){_sEl.style.transition='transform .25s ease';_sEl.style.transform='translateY(100%)';var o=_sOvr;setTimeout(function(){if(o&&o.parentNode)o.parentNode.removeChild(o)},260)}else{_sEl.style.transition='transform .2s ease';_sEl.style.transform='translateY(0)'}; _sEl=null;_sOvr=null }
