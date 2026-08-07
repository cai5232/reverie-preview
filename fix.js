// fix.js v4 - thinking 行和工具行统一样式，统一组内竖线连接

const _bulbSvg = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2a4 4 0 00-2.8 6.8l.3.3V11h5V9.1l.3-.3A4 4 0 008 2z" stroke="#A6A39A" stroke-width="1.2" stroke-linejoin="round"/><path d="M5.5 13h5M6.5 14.5h3" stroke="#A6A39A" stroke-width="1.2" stroke-linecap="round"/></svg>`
const _arrowSvg = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2l4 4-4 4" stroke="#C8C4BC" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`

// 把 .xk-thinking 节点变形为工具行风格
function _transformThinking(node){
  if(!node || !node.classList) return
  if(!node.classList.contains('xk-thinking')) return
  if(node._xkTransformed) return
  node._xkTransformed = true

  // 保存原 onclick
  const btn = node.querySelector('.xk-think-btn')
  const origOnclick = btn && btn.onclick ? btn.onclick.bind(btn) : null

  node.className = 'xk-tool-row'
  node.setAttribute('data-think','1')
  node.innerHTML = `<div class="xk-tool-row-inner">${_bulbSvg}<span class="xk-tool-row-label"><b>Thought process</b></span>${_arrowSvg}</div>`

  node.onclick = function(){
    if(origOnclick) origOnclick()
    else if(node._thinkText) xkOpenThink(node._thinkText)
    else {
      // 备用：从 xkHistory 最后一条 assistant 提取 thinking
      const hist = window.xkHistory || []
      for(let i=hist.length-1;i>=0;i--){
        if(hist[i].role==='assistant' && hist[i].content){
          const m = hist[i].content.match(/\[THINK\]([\s\S]*?)\[\/THINK\]/)
          if(m){ xkOpenThink(m[1]); return }
        }
      }
    }
  }

  // 检查前后邻居，插入竖线连接器
  _connectNeighbors(node)
}

// 在给定节点和其前后连接的 tool-group/tool-row 之间插竖线
function _insertConnector(parent, before){
  // 避免重复
  const prev = before.previousElementSibling
  if(prev && prev.classList.contains('xk-tool-connector')) return
  const c = document.createElement('div')
  c.className = 'xk-tool-connector'
  parent.insertBefore(c, before)
}

function _connectNeighbors(node){
  const parent = node.parentNode
  if(!parent) return
  const prev = node.previousElementSibling
  const next = node.nextElementSibling
  if(prev && _isToolLike(prev)) _insertConnector(parent, node)
  if(next && _isToolLike(next)) _insertConnector(parent, next)
}

function _isToolLike(el){
  return el && (el.classList.contains('xk-tool-group') || el.classList.contains('xk-tool-row') || el.getAttribute('data-think'))
}

document.addEventListener('DOMContentLoaded', function(){

  // 拦截 xkAddActions，修复 btn2 缺少 onclick 的问题
  const _origXkAddActions = window.xkAddActions
  window.xkAddActions = function(block, tokens){
    if(_origXkAddActions) _origXkAddActions.call(this, block, tokens)
    // 修复 block 里 thinking 节点
    block.querySelectorAll('.xk-thinking').forEach(tw=>{
      _transformThinking(tw)
    })
  }

  // MutationObserver 监听 xkStream
  const stream = document.getElementById('xkStream')
  if(stream){
    new MutationObserver(muts=>{
      muts.forEach(m=>{
        m.addedNodes.forEach(node=>{
          if(node.nodeType!==1) return
          // 直接插入的 thinking 行（tool_call 前）
          if(node.classList.contains('xk-thinking')){
            _transformThinking(node)
          }
          // tool-group 插入时，检查前面是否有 thinking 行需要连接
          if(node.classList.contains('xk-tool-group')){
            const prev = node.previousElementSibling
            if(prev && (prev.getAttribute('data-think') || prev.classList.contains('xk-tool-row'))){
              _insertConnector(node.parentNode, node)
            }
          }
        })
      })
    }).observe(stream, {childList:true, subtree:false})
  }

  // ── 弹窗拖动关闭 ──
  document.body.addEventListener('touchstart', _sheetStart, {passive:false})
  document.body.addEventListener('touchmove', _sheetMove, {passive:false})
  document.body.addEventListener('touchend', _sheetEnd, {passive:false})
})

let _sheetEl=null, _sheetStartY=0, _sheetOvr=null

function _sheetStart(e){
  const s = e.target.closest('[data-sheet]')
  if(!s) return
  _sheetEl=s; _sheetOvr=s.parentElement; _sheetStartY=e.touches[0].clientY
  s.style.transition='none'
}
function _sheetMove(e){
  if(!_sheetEl) return
  const dy=e.touches[0].clientY-_sheetStartY
  if(dy>0){ _sheetEl.style.transform=`translateY(${dy}px)`; e.preventDefault() }
}
function _sheetEnd(e){
  if(!_sheetEl) return
  const dy=e.changedTouches[0].clientY-_sheetStartY
  if(dy>80){
    _sheetEl.style.transition='transform .25s ease'
    _sheetEl.style.transform='translateY(100%)'
    setTimeout(()=>{ if(_sheetOvr&&_sheetOvr.parentNode)_sheetOvr.parentNode.removeChild(_sheetOvr) },260)
  }else{
    _sheetEl.style.transition='transform .2s ease'
    _sheetEl.style.transform='translateY(0)'
  }
  _sheetEl=null; _sheetOvr=null
}
