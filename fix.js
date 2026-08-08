// fix.js v12 — 最终版

// ── 全局点击代理：.xk-think-btn点击→弹出xkThinkOverlay ──
document.addEventListener('click', function(e){
  var btn = e.target.closest('.xk-think-btn, .xk-thinking')
  if(!btn) return
  // 找近的 .xk-thinking
  var tw = btn.classList.contains('xk-thinking') ? btn : btn.closest('.xk-thinking')
  if(!tw) return

  // 1. 先用存在节点上的 _thinkText
  var text = tw._thinkText || ''

  // 2. 再找属于这个 block 的 xkHistory
  if(!text){
    var block = tw.closest('.xk-ai-block')
    var hist = window.xkHistory || []
    for(var i=hist.length-1; i>=0; i--){
      if(hist[i] && hist[i].content){
        var m = hist[i].content.match(/\[THINK\]([\s\S]*?)\[\/THINK\]/)
        if(m){ text = m[1]; break }
      }
    }
  }

  if(!text) text = '(暂无思考过程)'

  // 直接操作 DOM 开启弹窗
  var body = document.getElementById('xkThinkBody')
  var overlay = document.getElementById('xkThinkOverlay')
  if(body) body.textContent = text
  if(overlay) overlay.classList.add('open')
}, true)

// ── 全局扫描：对所有 .xk-thinking 进行：
// a) 修改文字为 Thought process
// b) 去重（stream 直接子级的）
// c) 记录 _thinkText 到 DOM 节点 ──
function _patch(){
  var stream = document.getElementById('xkStream')
  if(!stream) return

  // a+b: 将 stream 直接子级的连续 thinking 去重
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

  // c: 所有 xk-ai-block 里的 thinking
  stream.querySelectorAll('.xk-ai-block .xk-thinking').forEach(_fixThinkText)

  // d: live head 文字
  stream.querySelectorAll('.xk-think-live-head span').forEach(function(el){
    el.textContent = el.textContent.replace(/思考过程|Thinking/g, 'Thought process')
  })
}

function _fixThinkText(tw){
  var btn = tw.querySelector('.xk-think-btn')
  if(btn) btn.innerHTML = btn.innerHTML.replace(/思考过程|Thinking/g, 'Thought process')
  // 把 thinkText 存到节点
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

// ── style patch：live body 字体与 think-btn 统一 ──
var _style = document.createElement('style')
_style.textContent = [
  '.xk-think-live-body{font-size:12px!important;color:#A6A39A!important;font-family:-apple-system,"PingFang SC",sans-serif!important;line-height:1.5!important;}',
  '.xk-think-live-head{font-size:12px!important;color:#A6A39A!important;}',
].join('')
document.head.appendChild(_style)

// ── xkToolRowHTML patch：工具行改成与 think-btn 相同小字样式 ──
window.addEventListener('load', function(){
  if(!window.xkToolRowHTML) return
  window.xkToolRowHTML = function(toolName, state){
    var wrench = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8.5 1.5a3 3 0 00-2.9 3.7L1.5 9.3a1.3 1.3 0 001.8 1.8l4.1-4.1a3 3 0 003.7-3.5l-1.7 1.7-1.3-1.3 1.7-1.7A3 3 0 008.5 1.5z" stroke="#A6A39A" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    var dot = state==='loading' ? '<span class="xk-tool-loading-dot"></span>' : ''
    var name = String(toolName).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    var label = state==='loading' ? '调用工具: '+name+dot : state==='done' ? '调用工具: '+name : '调用工具: '+name+' 失败'
    return '<div class="xk-think-btn" style="pointer-events:none">'+wrench+label+'</div>'
  }

  // 重新渲染已存在的工具行
  document.querySelectorAll('.xk-tool-row:not([_restyle])').forEach(function(row){
    row.setAttribute('_restyle','1')
    var name = (row._toolName||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    var state = row._state||'done'
    var wrench = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8.5 1.5a3 3 0 00-2.9 3.7L1.5 9.3a1.3 1.3 0 001.8 1.8l4.1-4.1a3 3 0 003.7-3.5l-1.7 1.7-1.3-1.3 1.7-1.7A3 3 0 008.5 1.5z" stroke="#A6A39A" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    var dot = state==='loading' ? '<span class="xk-tool-loading-dot"></span>' : ''
    var label = state==='loading' ? '调用工具: '+name+dot : '调用工具: '+name
    var orig = row.onclick
    row.innerHTML = '<div class="xk-think-btn" style="pointer-events:none">'+wrench+label+'</div>'
    row.onclick = orig
    row.style.cssText = 'display:flex;align-items:center;cursor:pointer;padding:2px 0;background:none'
  })
})

document.addEventListener('DOMContentLoaded', function(){
  var stream = document.getElementById('xkStream')
  if(stream){
    new MutationObserver(function(){
      clearTimeout(stream._ft)
      stream._ft = setTimeout(_patch, 80)
    }).observe(stream, {childList:true, subtree:true})
  }

  // 切后台 xkBusy
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

  // 弹窗拖拽
  document.body.addEventListener('touchstart',_ss,{passive:false})
  document.body.addEventListener('touchmove',_sm,{passive:false})
  document.body.addEventListener('touchend',_se,{passive:false})
})

var _sEl=null,_sY=0,_sOvr=null,_sOnHandle=false
function _ss(e){
  // 只有点到 handle 元素才触发
  var handle=e.target.closest('[data-handle]')
  if(!handle)return
  var s=handle.closest('[data-sheet]')
  if(!s)return
  _sOnHandle=true
  _sEl=s;_sOvr=s.parentElement;_sY=e.touches[0].clientY
  s.style.transition='none'
  e.preventDefault()
}
function _sm(e){
  if(!_sEl||!_sOnHandle)return
  var dy=e.touches[0].clientY-_sY
  if(dy>0){_sEl.style.transform='translateY('+dy+'px)';e.preventDefault()}
}
function _se(e){
  if(!_sEl||!_sOnHandle)return
  var dy=e.changedTouches[0].clientY-_sY
  if(dy>60){
    _sEl.style.transition='transform .25s ease'
    _sEl.style.transform='translateY(100%)'
    var o=_sOvr
    setTimeout(function(){if(o&&o.parentNode)o.parentNode.removeChild(o)},260)
  }else{
    _sEl.style.transition='transform .2s ease'
    _sEl.style.transform='translateY(0)'
  }
  _sEl=null;_sOvr=null;_sOnHandle=false
}
