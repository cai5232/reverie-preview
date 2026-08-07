// fix.js v6 - 统一思考过程和工具行为小字浅灰样式，去重，连接竖线

// 将 .xk-thinking 节点变形为工具行风格的小字浅灰行
function _makeThinkRow(node){
  node.className = 'xk-tool-row'
  node.setAttribute('data-think','1')
  // 拿到原来的 onclick
  const origBtn = node.querySelector('.xk-think-btn')
  const origOnclick = origBtn ? origBtn.onclick : null
  node.innerHTML = `<div class="xk-tool-row-inner"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#A6A39A" stroke-width="1.1"/><path d="M6 3.2v2.8l1.4 1.4" stroke="#A6A39A" stroke-width="1.1" stroke-linecap="round"/></svg><span class="xk-tool-row-label">Thought process</span><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 2l3 3-3 3" stroke="#C8C4BC" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`
  node.onclick = function(){
    if(origOnclick) try{ origOnclick() }catch(e){}
    else {
      // 备用：从历史拖 thinking 内容
      const hist = window.xkHistory || []
      for(let i=hist.length-1;i>=0;i--){
        const m = hist[i] && hist[i].content && hist[i].content.match(/\[THINK\]([\s\S]*?)\[\/THINK\]/)
        if(m){ window.xkOpenThink && xkOpenThink(m[1]); return }
      }
    }
  }
}

// 不重复插入竖线
function _addConn(parent, before){
  const p = before.previousElementSibling
  if(p && p.classList.contains('xk-tool-connector')) return
  const c = document.createElement('div')
  c.className = 'xk-tool-connector'
  parent.insertBefore(c, before)
}

function _isToolLike(el){
  return el && el.nodeType===1 && (
    el.classList.contains('xk-tool-group') ||
    el.classList.contains('xk-tool-row')
  )
}

// 扫描 xkStream 直接子节点
function _scan(){
  const stream = document.getElementById('xkStream')
  if(!stream) return

  // 1. 将所有连续 .xk-thinking 块：只保第一个，删除其他，变形
  let nodes = Array.from(stream.children)
  let i = 0
  while(i < nodes.length){
    const n = nodes[i]
    if(n.classList && n.classList.contains('xk-thinking')){
      _makeThinkRow(n)
      // 删除后续连续的
      let j = i+1
      while(j < nodes.length && nodes[j].classList && (nodes[j].classList.contains('xk-thinking') || (nodes[j].getAttribute && nodes[j].getAttribute('data-think')))){
        nodes[j].remove()
        j++
      }
      nodes = Array.from(stream.children)
      i = 0
      continue
    }
    i++
  }

  // 2. 去除多余 data-think 节点（连续的只保第一个）
  nodes = Array.from(stream.children)
  let lastWasThink = false
  nodes.forEach(n=>{
    if(n.getAttribute && n.getAttribute('data-think')){
      if(lastWasThink) n.remove()
      else lastWasThink = true
    } else if(n.classList && n.classList.contains('xk-tool-group')){
      lastWasThink = false  // tool group 不重置
    } else if(!n.classList.contains('xk-tool-connector')){
      lastWasThink = false
    }
  })

  // 3. 插入竖线
  nodes = Array.from(stream.children).filter(n=>!n.classList.contains('xk-tool-connector'))
  nodes.forEach((n,idx)=>{
    if(_isToolLike(n) && idx > 0 && _isToolLike(nodes[idx-1])){
      _addConn(stream, n)
    }
  })
}

document.addEventListener('DOMContentLoaded', function(){
  const stream = document.getElementById('xkStream')
  if(stream){
    new MutationObserver(()=>{
      clearTimeout(stream._ft)
      stream._ft = setTimeout(_scan, 100)
    }).observe(stream, {childList:true, subtree:false})
  }

  // 弹窗拖动关闭
  document.body.addEventListener('touchstart', _ss, {passive:false})
  document.body.addEventListener('touchmove', _sm, {passive:false})
  document.body.addEventListener('touchend', _se, {passive:false})
})

let _sEl=null,_sY=0,_sOvr=null
function _ss(e){ const s=e.target.closest('[data-sheet]'); if(!s)return; _sEl=s;_sOvr=s.parentElement;_sY=e.touches[0].clientY;s.style.transition='none' }
function _sm(e){ if(!_sEl)return; const dy=e.touches[0].clientY-_sY; if(dy>0){_sEl.style.transform=`translateY(${dy}px)`;e.preventDefault()} }
function _se(e){ if(!_sEl)return; const dy=e.changedTouches[0].clientY-_sY; if(dy>80){_sEl.style.transition='transform .25s ease';_sEl.style.transform='translateY(100%)';setTimeout(()=>{if(_sOvr&&_sOvr.parentNode)_sOvr.parentNode.removeChild(_sOvr)},260)}else{_sEl.style.transition='transform .2s ease';_sEl.style.transform='translateY(0)'}; _sEl=null;_sOvr=null }
