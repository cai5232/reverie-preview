// fix.js v13

// ── 全局点击代理：.xk-think-btn点击→弹出xkThinkOverlay ──
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

function _patch(){
  var stream = document.getElementById('xkStream')
  if(!stream) return
  var kids = Array.from(stream.children)
  var sawThink = false
  kids.forEach(function(n){
    if(n.classList && n.classList.contains('xk-thinking')){
      if(sawThink){ n.remove(); return }
      sawThink = true
      _fixThinkText(n)
    }
    if(n.classList && n.classList.contains('xk-tool-group')) sawThink = false
    if(n.classList && n.classList.contains('xk-ai-block')) sawThink = false
  })
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

// ── handle 下滑关闭弹窗 ──
// 只有触点在 [data-handle] 元素上才激活，不影响弹窗内容区滚动
var _sh = {el:null, ovr:null, y0:0, active:false}

function _shStart(e){
  var handle = e.target.closest('[data-handle]')
  if(!handle) return
  var sheet = handle.closest('[data-sheet]')
  if(!sheet) return
  _sh.el = sheet
  _sh.ovr = sheet.parentElement
  _sh.y0 = e.touches[0].clientY
  _sh.active = true
  sheet.style.transition = 'none'
  e.preventDefault()
}
function _shMove(e){
  if(!_sh.active) return
  var dy = e.touches[0].clientY - _sh.y0
  if(dy > 0){
    _sh.el.style.transform = 'translateY('+dy+'px)'
    e.preventDefault()
  }
}
function _shEnd(e){
  if(!_sh.active) return
  var dy = e.changedTouches[0].clientY - _sh.y0
  if(dy > 60){
    _sh.el.style.transition = 'transform .25s ease'
    _sh.el.style.transform = 'translateY(100%)'
    var el = _sh.el, ovr = _sh.ovr
    if(el.classList && el.classList.contains('xk-think-sheet')){
      var ov = document.getElementById('xkThinkOverlay')
      setTimeout(function(){ if(ov) ov.classList.remove('open') }, 260)
    } else {
      setTimeout(function(){
        if(ovr && ovr.parentNode && !ovr.id) ovr.parentNode.removeChild(ovr)
      }, 260)
    }
  } else {
    _sh.el.style.transition = 'transform .2s ease'
    _sh.el.style.transform = 'translateY(0)'
  }
  _sh.el = null; _sh.ovr = null; _sh.active = false
}

document.addEventListener('DOMContentLoaded', function(){
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
          window.xkBusy=false
          var b=document.getElementById('xkSendBtn')
          if(b)b.disabled=false
        }
      },2000)
    }
  })
  document.body.addEventListener('touchstart', _shStart, {passive:false})
  document.body.addEventListener('touchmove',  _shMove,  {passive:false})
  document.body.addEventListener('touchend',   _shEnd,   {passive:false})
})