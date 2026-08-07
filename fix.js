// fix.js v7

function _makeThinkRow(node){
  node.className = 'xk-thinking'
  node.setAttribute('data-think','1')
  const origBtn = node.querySelector('.xk-think-btn')
  const origOnclick = origBtn ? origBtn.onclick : null
  node.innerHTML = `<div class="xk-think-btn" style="pointer-events:none"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.7" stroke="#A6A39A" stroke-width="1.1"/><path d="M6.5 3.8v3l1.7 1.7" stroke="#A6A39A" stroke-width="1.1" stroke-linecap="round"/></svg>Thought process</div>`
  node.style.cursor = 'pointer'
  node.onclick = function(){
    if(origOnclick) try{ origOnclick() }catch(e){}
    else {
      const hist = window.xkHistory || []
      for(let i=hist.length-1;i>=0;i--){
        const m = hist[i]&&hist[i].content&&hist[i].content.match(/\[THINK\]([\s\S]*?)\[\/THINK\]/)
        if(m){ window.xkOpenThink&&xkOpenThink(m[1]); return }
      }
    }
  }
}

// 将工具行改成和 think-btn 完全相同样式
function _fixToolRow(row){
  if(row._fixedStyle) return
  row._fixedStyle = true
  // 拿到工具名
  const label = row.querySelector('.xk-tool-row-label')
  const toolName = label ? label.textContent.replace('调用工具: ','').trim() : ''
  const state = row._state || 'done'
  const loadingDot = state==='loading' ? '<span class="xk-tool-loading-dot"></span>' : ''
  const origOnclick = row.onclick
  row.className = 'xk-thinking'
  row.setAttribute('data-toolrow','1')
  row.style.cursor = 'pointer'
  row.innerHTML = `<div class="xk-think-btn" style="pointer-events:none"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8.5 1.5a3 3 0 00-2.9 3.7L1.5 9.3a1.3 1.3 0 001.8 1.8l4.1-4.1a3 3 0 003.7-3.5l-1.7 1.7-1.3-1.3 1.7-1.7A3 3 0 008.5 1.5z" stroke="#A6A39A" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>调用工具: ${toolName}${loadingDot}</div>`
  row.onclick = origOnclick
}

function _isToolLike(el){
  return el && el.nodeType===1 && (
    el.getAttribute('data-think') || el.getAttribute('data-toolrow') ||
    el.classList.contains('xk-thinking')
  )
}

function _addConn(parent, before){
  const p = before.previousElementSibling
  if(p && p.classList.contains('xk-tool-connector')) return
  const c = document.createElement('div')
  c.className = 'xk-tool-connector'
  c.style.cssText = 'width:1px;background:#E0DDD8;height:10px;margin:0 0 0 6px'
  parent.insertBefore(c, before)
}

function _scan(){
  const stream = document.getElementById('xkStream')
  if(!stream) return

  // 1. 将 .xk-tool-row 和 .xk-tool-group 里的行改小样式
  stream.querySelectorAll('.xk-tool-group').forEach(group=>{
    group.querySelectorAll('.xk-tool-row').forEach(row=>{
      _fixToolRow(row)
    })
    // 移除内部竖线
    group.querySelectorAll('.xk-tool-connector').forEach(c=>c.remove())
  })

  // 2. 将 xkStream 直接子的 .xk-thinking 处理
  let nodes = Array.from(stream.children)
  let firstThinkIdx = -1
  for(let i=0;i<nodes.length;i++){
    const n = nodes[i]
    if(n.classList.contains('xk-thinking') && !n.getAttribute('data-think') && !n.getAttribute('data-toolrow')){
      _makeThinkRow(n)
    }
  }

  // 3. 去重：连续多个 data-think 只保第一个
  nodes = Array.from(stream.children)
  let lastThink = false
  nodes.forEach(n=>{
    if(n.getAttribute('data-think')){
      if(lastThink) n.remove()
      else lastThink = true
    } else if(!n.classList.contains('xk-tool-connector')){
      if(n.classList.contains('xk-tool-group') || n.getAttribute('data-toolrow')){
        // 工具组不重置
      } else {
        lastThink = false
      }
    }
  })

  // 4. 插入竖线
  nodes = Array.from(stream.children).filter(n=>!n.classList.contains('xk-tool-connector'))
  nodes.forEach((n,idx)=>{
    if(_isToolLike(n) && idx>0 && _isToolLike(nodes[idx-1])){
      _addConn(stream, n)
    }
    // tool-group 内部也连
    if(n.classList.contains('xk-tool-group')){
      const rows = Array.from(n.children).filter(c=>!c.classList.contains('xk-tool-connector'))
      rows.forEach((r,ri)=>{
        if(ri>0) _addConn(n, r)
      })
    }
  })
}

document.addEventListener('DOMContentLoaded', function(){
  // 拦截 xkUpdateToolStatus 䯿更新后也能重置样式
  const _origUpdate = window.xkUpdateToolStatus
  window.xkUpdateToolStatus = function(el, toolName, state, result){
    if(el){
      el._state = state
      if(result!==undefined) el._result = result
      el._fixedStyle = false  // 让 _scan 重新应用
    }
    if(_origUpdate) _origUpdate.apply(this, arguments)
    setTimeout(_scan, 30)
  }

  const stream = document.getElementById('xkStream')
  if(stream){
    new MutationObserver(()=>{
      clearTimeout(stream._ft)
      stream._ft = setTimeout(_scan, 80)
    }).observe(stream, {childList:true, subtree:true})
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
