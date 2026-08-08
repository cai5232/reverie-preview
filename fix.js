// fix.js v18

// click代理：.xk-think-btn → 打开 xkThinkOverlay
document.addEventListener('click', function(e){
  var btn = e.target.closest('.xk-think-btn, .xk-thinking')
  if(!btn) return
  var tw = btn.classList.contains('xk-thinking') ? btn : btn.closest('.xk-thinking')
  if(!tw) return
  var text = tw._thinkText || ''
  if(!text){
    var hist = window.xkHistory || []
    for(var i=hist.length-1; i>=0; i--){
      if(hist[i] && hist[i].content){
        var m = hist[i].content.match(/\[THINK\]([\s\S]*?)\[\/THINK\]/)
        if(m){ text = m[1]; break }
      }
    }
  }
  if(!text) text = '(暂无思考过程)'
  var body = document.getElementById('xkThinkBody')
  var overlay = document.getElementById('xkThinkOverlay')
  if(body) body.textContent = text
  if(overlay) overlay.classList.add('open')
}, true)

// patch think text
function _patch(){
  var stream = document.getElementById('xkStream')
  if(!stream) return
  stream.querySelectorAll('.xk-ai-block .xk-thinking').forEach(_fixThinkText)
}
function _fixThinkText(tw){
  var btn = tw.querySelector('.xk-think-btn')
  if(btn) btn.innerHTML = btn.innerHTML.replace(/思考过程|Thinking/g, 'Thought process')
  if(!tw._thinkText){
    var hist = window.xkHistory || []
    for(var i=hist.length-1;i>=0;i--){
      if(hist[i]&&hist[i].content){
        var m = hist[i].content.match(/\[THINK\]([\s\S]*?)\[\/THINK\]/)
        if(m){ tw._thinkText = m[1]; break }
      }
    }
  }
}

// ── 发送按钮兜底绑定（不用 passive:false，不 preventDefault） ──
window.addEventListener('load', function(){
  function tryBindSend(){
    var btn = document.getElementById('xkSendBtn')
    if(!btn) return
    if(typeof xkBusy !== 'undefined') window.xkBusy = false
    btn.removeAttribute('disabled')

    // 启动时探测 xkSendBtn 位置上最顶层的元素，showToast 告知
    setTimeout(function(){
      var rect = btn.getBoundingClientRect()
      var cx = rect.left + rect.width/2
      var cy = rect.top + rect.height/2
      var top = document.elementFromPoint(cx, cy)
      var info = top ? (top.tagName||'')+'#'+(top.id||'')+' .'+(typeof top.className==='string'?top.className.split(' ')[0]:'') : 'null'
      if(typeof showToast==='function') showToast('顶层:'+info)
    }, 800)

    btn.ontouchstart = function(e){
      e.stopPropagation()
      btn.style.background = 'rgba(255,255,255,0.75)'
    }
    btn.ontouchend = function(e){
      e.preventDefault()
      e.stopPropagation()
      btn.style.background = ''
      if(typeof xkBusy !== 'undefined') window.xkBusy = false
      btn.removeAttribute('disabled')
      if(typeof xkForceSend === 'function') xkForceSend()
      else if(typeof xkSend === 'function') xkSend()
    }
    btn.ontouchcancel = function(){
      btn.style.background = ''
    }
    btn.onclick = function(){
      if(typeof xkBusy !== 'undefined') window.xkBusy = false
      btn.removeAttribute('disabled')
      if(typeof xkForceSend === 'function') xkForceSend()
      else if(typeof xkSend === 'function') xkSend()
    }
  }
  tryBindSend()
  setTimeout(tryBindSend, 600)
})

// MutationObserver 修正 think text
;(function(){
  var stream = document.getElementById('xkStream')
  if(stream){
    new MutationObserver(function(){
      clearTimeout(stream._ft)
      stream._ft = setTimeout(_patch, 80)
    }).observe(stream, {childList:true, subtree:true})
  }
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState==='visible'){
      setTimeout(function(){
        if(window.xkBusy){
          window.xkBusy = false
          var b = document.getElementById('xkSendBtn')
          if(b) b.removeAttribute('disabled')
        }
      }, 2000)
    }
  })
})()
