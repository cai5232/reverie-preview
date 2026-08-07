// fix.js v5
// 修复：1.去重利用第一个 thinking 删多余 2.统一样式工具行 3.相邻竖线连接 4.拖动关闭 sheet

const _bulbSvg = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2a4 4 0 00-2.8 6.8l.3.3V11h5V9.1l.3-.3A4 4 0 008 2z" stroke="#A6A39A" stroke-width="1.2" stroke-linejoin="round"/><path d="M5.5 13h5M6.5 14.5h3" stroke="#A6A39A" stroke-width="1.2" stroke-linecap="round"/></svg>'
const _arrowSvg = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2l4 4-4 4" stroke="#C8C4BC" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const _wrenchSvg = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10.5 2.5a3.5 3.5 0 00-3.4 4.3L2.2 11.7a1.5 1.5 0 002.1 2.1l4.9-4.9a3.5 3.5 0 004.3-4.1l-2 2-1.5-1.5 2-2A3.5 3.5 0 0010.5 2.5z" stroke="#A6A39A" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'

function escH(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

// 将 .xk-thinking 节点变形为工具行风格并绑定点击
function _makeThinkRow(node, thinkText){
  node.className = 'xk-tool-row'
  node.setAttribute('data-think','1')
  node.innerHTML = `<div class="xk-tool-row-inner">${_bulbSvg}<span class="xk-tool-row-label"><b>Thought process</b></span>${_arrowSvg}</div>`
  node.onclick = function(){
    // 优先用传入的文本
    const txt = thinkText || node._thinkText
    if(txt){ xkOpenThink(txt); return }
    // 备用：从历史找
    const hist = window.xkHistory || []
    for(let i=hist.length-1;i>=0;i--){
      if(hist[i].role==='assistant' && hist[i].content){
        const m = hist[i].content.match(/\[THINK\]([\s\S]*?)\[\/THINK\]/)
        if(m){ xkOpenThink(m[1]); return }
      }
    }
  }
}

// 小工具：判断节点是否工具行类
function _isToolLike(el){
  return el && el.nodeType===1 && (
    el.classList.contains('xk-tool-group') ||
    el.classList.contains('xk-tool-row') ||
    el.getAttribute && el.getAttribute('data-think')
  )
}

// 在 parent 的 before 前面插入竖线（去重）
function _addConnector(parent, before){
  const prev = before.previousElementSibling
  if(prev && prev.classList.contains('xk-tool-connector')) return
  const c = document.createElement('div')
  c.className = 'xk-tool-connector'
  parent.insertBefore(c, before)
}

// 重新扫描 xkStream 直接子节点，处理思考节点 + 竖线
function _processStream(){
  const stream = document.getElementById('xkStream')
  if(!stream) return
  const children = Array.from(stream.children)

  // 第一步：处理 .xk-thinking 节点
  // 找出所有连续的 thinking 块，只保留第一个，删除多余的
  let i = 0
  while(i < children.length){
    const node = children[i]
    if(node.classList.contains('xk-thinking')){
      // 拿到这个 thinking 的原始文本
      let thinkText = null
      const btn = node.querySelector('.xk-think-btn')
      if(btn && btn.onclick){
        // 尝试从 btn.onclick 的闭包里拖出文本——不可行直接引用
      }

      // 删除受就 xkStream 直接子的后续连续 thinking节点
      let j = i + 1
      while(j < children.length && children[j].classList && children[j].classList.contains('xk-thinking')){
        children[j].remove()
        j++
      }
      // 将当前这个变形
      _makeThinkRow(node, thinkText)
      // 重新读取 children，因为 DOM 已变
      i = 0
      break
    }
    i++
  }

  // 第二步：添加竖线连接器
  const updated = Array.from(stream.children)
  updated.forEach((node, idx)=>{
    if(_isToolLike(node) && idx > 0 && _isToolLike(updated[idx-1])){
      _addConnector(stream, node)
    }
  })
}

document.addEventListener('DOMContentLoaded', function(){

  // 拦截 xkAgenticLoop 返回后 xkAddActions 的调用
  // 因 app.js 中 btn2 没有 onclick，这里拦截 xkOpenThink彎上局前绑定
  const _origAddActions = window.xkAddActions
  window.xkAddActions = function(block, tokens){
    if(_origAddActions) _origAddActions.call(this, block, tokens)
    // 对 block 内的 thinking 节点变形
    block && block.querySelectorAll('.xk-thinking').forEach(tw=>{
      _makeThinkRow(tw, null)
    })
    // 重新扫描整个 stream
    setTimeout(_processStream, 50)
  }

  // 监听 xkStream 新增节点
  const stream = document.getElementById('xkStream')
  if(stream){
    new MutationObserver(()=>{
      // 每次 DOM 变化后延迟扫描，合并忹射查询
      clearTimeout(stream._fixTimer)
      stream._fixTimer = setTimeout(_processStream, 80)
    }).observe(stream, {childList:true, subtree:false})
  }

  // 展开尼客：弹窗拖动关闭
  document.body.addEventListener('touchstart', _sheetStart, {passive:false})
  document.body.addEventListener('touchmove', _sheetMove, {passive:false})
  document.body.addEventListener('touchend', _sheetEnd, {passive:false})
})

// 弹窗拖动关闭
let _sheetEl=null, _sheetY=0, _sheetOvr=null
function _sheetStart(e){
  const s = e.target.closest('[data-sheet]')
  if(!s) return
  _sheetEl=s; _sheetOvr=s.parentElement; _sheetY=e.touches[0].clientY
  s.style.transition='none'
}
function _sheetMove(e){
  if(!_sheetEl) return
  const dy = e.touches[0].clientY - _sheetY
  if(dy > 0){ _sheetEl.style.transform=`translateY(${dy}px)`; e.preventDefault() }
}
function _sheetEnd(e){
  if(!_sheetEl) return
  const dy = e.changedTouches[0].clientY - _sheetY
  if(dy > 80){
    _sheetEl.style.transition='transform .25s ease'
    _sheetEl.style.transform='translateY(100%)'
    setTimeout(()=>{ if(_sheetOvr&&_sheetOvr.parentNode) _sheetOvr.parentNode.removeChild(_sheetOvr) }, 260)
  } else {
    _sheetEl.style.transition='transform .2s ease'
    _sheetEl.style.transform='translateY(0)'
  }
  _sheetEl=null; _sheetOvr=null
}
