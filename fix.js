// fix.js v3 - runtime patches
document.addEventListener('DOMContentLoaded', function(){

  // ── 1. Thought process 文字替换 + MutationObserver ──
  function fixThinkBtns(root){
    ;(root||document).querySelectorAll('.xk-think-btn').forEach(btn=>{
      btn.innerHTML = btn.innerHTML.replace(/思考过程/g,'Thought process')
      // 修复缺少 onclick 的情况：重新绑定
      if(!btn._fixedOnclick){
        btn._fixedOnclick = true
        const originalOnclick = btn.onclick
        if(!originalOnclick){
          btn.onclick = function(){
            const block = btn.closest('.xk-ai-block, .xk-thinking')
            // 尝试从局部存储的数据里找到对应文本
            if(block && block._thinkText) xkOpenThink(block._thinkText)
          }
        }
      }
    })
    ;(root||document).querySelectorAll('.xk-think-live-head span').forEach(s=>{
      s.textContent = s.textContent.replace(/思考过程/g,'Thought process')
    })
  }

  // 观察 xkStream 新节点
  const stream = document.getElementById('xkStream')
  if(stream){
    new MutationObserver(muts=>{
      muts.forEach(m=>m.addedNodes.forEach(n=>{ if(n.nodeType===1) fixThinkBtns(n) }))
    }).observe(stream, {childList:true, subtree:true})
  }

  // 修弹窗头部
  const thinkHead = document.querySelector('.xk-think-head')
  if(thinkHead){
    thinkHead.childNodes.forEach(n=>{
      if(n.nodeType===3) n.textContent = n.textContent.replace(/Thinking|思考过程/g,'Thought process')
    })
  }

  // ── 2. 弹窗拖动关闭 ──
  // 用事件委托监听未来弹出的 sheet
  document.body.addEventListener('touchstart', _sheetTouchStart, {passive:false})
  document.body.addEventListener('touchmove', _sheetTouchMove, {passive:false})
  document.body.addEventListener('touchend', _sheetTouchEnd, {passive:false})
})

// 拖动关闭 sheet 实现
let _sheetEl=null, _sheetStartY=0, _sheetOverlay=null

function _sheetTouchStart(e){
  const sheet = e.target.closest('[data-sheet]')
  if(!sheet) return
  _sheetEl = sheet
  _sheetOverlay = sheet.parentElement
  _sheetStartY = e.touches[0].clientY
  sheet.style.transition = 'none'
}
function _sheetTouchMove(e){
  if(!_sheetEl) return
  const dy = e.touches[0].clientY - _sheetStartY
  if(dy > 0){
    _sheetEl.style.transform = `translateY(${dy}px)`
    e.preventDefault()
  }
}
function _sheetTouchEnd(e){
  if(!_sheetEl) return
  const dy = e.changedTouches[0].clientY - _sheetStartY
  if(dy > 80){
    _sheetEl.style.transition = 'transform .25s ease'
    _sheetEl.style.transform = 'translateY(100%)'
    setTimeout(()=>{ if(_sheetOverlay && _sheetOverlay.parentNode) _sheetOverlay.parentNode.removeChild(_sheetOverlay) }, 260)
  } else {
    _sheetEl.style.transition = 'transform .2s ease'
    _sheetEl.style.transform = 'translateY(0)'
  }
  _sheetEl = null
  _sheetOverlay = null
}
