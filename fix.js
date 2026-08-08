// fix.js v15

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

// patch：改正文字
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

// ── handle-wrap 下滑关闭弹窗 ──
// .xk-think-handle-wrap 是一条 28px 高的条形水平居中元素，里面是小横条
// data-handle 放在 wrap 上，触摸任意一点都能激活
var _drag = { active:false, el:null, ovr:null, y0:0 }

document.addEventListener('touchstart', function(e){
  if(!e.target.closest('[data-handle]')) return
  var sheet = e.target.closest('[data-sheet]')
  if(!sheet) return
  _drag.active = true
  _drag.el = sheet
  _drag.ovr = sheet.parentElement
  _drag.y0 = e.touches[0].clientY
  sheet.style.transition = 'none'
  e.preventDefault()
}, {passive:false})

document.addEventListener('touchmove', function(e){
  if(!_drag.active) return
  var dy = e.touches[0].clientY - _drag.y0
  if(dy > 0){
    _drag.el.style.transform = 'translateY(' + dy + 'px)'
    e.preventDefault()
  }
}, {passive:false})

document.addEventListener('touchend', function(e){
  if(!_drag.active) return
  var dy = e.changedTouches[0].clientY - _drag.y0
  var sheet = _drag.el
  var ovr = _drag.ovr
  _drag.active = false
  _drag.el = null
  _drag.ovr = null
  if(dy > 60){
    sheet.style.transition = 'transform .25s ease'
    sheet.style.transform = 'translateY(100%)'
    if(sheet.classList.contains('xk-think-sheet')){
      setTimeout(function(){
        var ov = document.getElementById('xkThinkOverlay')
        if(ov) ov.classList.remove('open')
        sheet.style.transform = ''
      }, 260)
    } else {
      setTimeout(function(){
        if(ovr && ovr.parentNode) ovr.parentNode.removeChild(ovr)
      }, 260)
    }
  } else {
    sheet.style.transition = 'transform .2s ease'
    sheet.style.transform = 'translateY(0)'
  }
})

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
          window.xkBusy = false
          var b = document.getElementById('xkSendBtn')
          if(b) b.disabled = false
        }
      }, 2000)
    }
  })
})