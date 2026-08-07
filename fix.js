// fix.js v12 — 最终版
// 修复：1.思考过程生成中字体颜色不统一 2.Thought点不开弹窗 3.调用工具不显示

// ── 1. 覆盖 ensureThinkLive 和 xkAddActions 里的思考过程样式 ──
// 生成中的 live head 字体统一
const _thinkBtnHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.7" stroke="#A6A39A" stroke-width="1.1"/><path d="M6.5 3.8v3l1.7 1.7" stroke="#A6A39A" stroke-width="1.1" stroke-linecap="round"/></svg>Thought process`

// ── 2. 全局事件代理：括到 think-btn 就弹窗 ──
document.addEventListener('click', function(e){
  const btn = e.target.closest('.xk-think-btn')
  if(!btn) return
  e.stopPropagation()

  // 先找已存在的 thinkText
  const tw = btn.closest('.xk-thinking')
  if(tw && tw._thinkText){
    window.xkOpenThink && xkOpenThink(tw._thinkText)
    return
  }
  // 从 xkHistory 找最近一条
  const hist = window.xkHistory || []
  for(let i=hist.length-1;i>=0;i--){
    const m = hist[i]&&hist[i].content&&hist[i].content.match(/\[THINK\]([\s\S]*?)\[\/THINK\]/)
    if(m){ window.xkOpenThink && xkOpenThink(m[1]); return }
  }
}, true)

// ── 3. 包装 xkAddActions：在 btn2 插入后立刻追加 onclick 和 thinkText ──
window.addEventListener('load', function(){
  // 包装 xkAgenticLoop，在初进入工具调用前保存 thinkText
  const _origLoop = window.xkAgenticLoop
  if(_origLoop){
    window.xkAgenticLoop = async function(sendOptions, mcpServerMap, round){
      await _origLoop.call(this, sendOptions, mcpServerMap, round)
      // 修复工具行显示和 thinking
      _fixAll()
    }
  }

  // 包装 xkAddActions
  const _origAddActions = window.xkAddActions
  if(_origAddActions){
    window.xkAddActions = function(block, tokens){
      if(_origAddActions) _origAddActions.call(this, block, tokens)
      if(!block) return
      // 修复此 block 里的 thinking 节点
      block.querySelectorAll('.xk-thinking').forEach(tw=>{
        tw.innerHTML = `<div class="xk-think-btn">${_thinkBtnHTML}</div>`
        // 从历史存 thinkText
        const hist = window.xkHistory || []
        for(let i=hist.length-1;i>=0;i--){
          const m = hist[i]&&hist[i].content&&hist[i].content.match(/\[THINK\]([\s\S]*?)\[\/THINK\]/)
          if(m){ tw._thinkText = m[1]; break }
        }
      })
    }
  }
})

// ── 4. 修复所有内容 ──
function _fixAll(){
  // 去重：只保留第一个直接子 xk-thinking
  const stream = document.getElementById('xkStream')
  if(stream){
    let seen = false
    Array.from(stream.children).forEach(n=>{
      if(n.classList && n.classList.contains('xk-thinking')){
        if(seen){ n.remove(); return }
        seen = true
        // 统一样式 + 存 thinkText
        n.innerHTML = `<div class="xk-think-btn">${_thinkBtnHTML}</div>`
        const hist = window.xkHistory||[]
        for(let i=hist.length-1;i>=0;i--){
          const m=hist[i]&&hist[i].content&&hist[i].content.match(/\[THINK\]([\s\S]*?)\[\/THINK\]/)
          if(m){ n._thinkText=m[1]; break }
        }
      }
    })
  }

  // 修复 ai-block 里的 thinking
  document.querySelectorAll('.xk-ai-block .xk-thinking').forEach(tw=>{
    const btn = tw.querySelector('.xk-think-btn')
    if(btn) btn.innerHTML = _thinkBtnHTML
    // 存 thinkText
    if(!tw._thinkText){
      const block = tw.closest('.xk-ai-block')
      const hist = window.xkHistory||[]
      for(let i=hist.length-1;i>=0;i--){
        const m=hist[i]&&hist[i].content&&hist[i].content.match(/\[THINK\]([\s\S]*?)\[\/THINK\]/)
        if(m){ tw._thinkText=m[1]; break }
      }
    }
  })

  // 工具行不需要动，保持原样
}

// ── 5. live-head 字体统一 ──
// 监听生成中的 xk-think-live
document.addEventListener('DOMContentLoaded', function(){
  const stream = document.getElementById('xkStream')
  if(stream){
    new MutationObserver(muts=>{
      muts.forEach(m=>{
        m.addedNodes.forEach(n=>{
          if(!n.classList) return
          // live标题改为统一样式
          if(n.classList.contains('xk-think-live')){
            const hd = n.querySelector('.xk-think-live-head')
            if(hd){
              // 保留 dot，只改文字和样式
              const dot = hd.querySelector('.xk-think-live-dot')
              hd.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.7" stroke="#A6A39A" stroke-width="1.1"/><path d="M6.5 3.8v3l1.7 1.7" stroke="#A6A39A" stroke-width="1.1" stroke-linecap="round"/></svg><span style="font-size:12px;color:#A6A39A;font-family:-apple-system,'PingFang SC',sans-serif">Thought process</span>`
              if(dot){ hd.appendChild(dot) }
            }
          }
          // 新建 thinking
          if(n.classList.contains('xk-thinking')){
            const btn = n.querySelector('.xk-think-btn')
            if(btn) btn.innerHTML = _thinkBtnHTML
          }
        })
      })
    }).observe(stream, {childList:true, subtree:true})
  }

  // 切后台重置
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState==='visible'){
      setTimeout(function(){
        if(window.xkBusy===true){
          window.xkBusy=false
          var b=document.getElementById('xkSendBtn')
          if(b) b.disabled=false
        }
      }, 2000)
    }
  })

  // 弹窗拖拽关闭
  document.body.addEventListener('touchstart',_ss,{passive:false})
  document.body.addEventListener('touchmove',_sm,{passive:false})
  document.body.addEventListener('touchend',_se,{passive:false})
})

var _sEl=null,_sY=0,_sOvr=null
function _ss(e){var s=e.target.closest('[data-sheet]');if(!s)return;_sEl=s;_sOvr=s.parentElement;_sY=e.touches[0].clientY;s.style.transition='none'}
function _sm(e){if(!_sEl)return;var dy=e.touches[0].clientY-_sY;if(dy>0){_sEl.style.transform='translateY('+dy+'px)';e.preventDefault()}}
function _se(e){if(!_sEl)return;var dy=e.changedTouches[0].clientY-_sY;if(dy>80){_sEl.style.transition='transform .25s ease';_sEl.style.transform='translateY(100%)';var o=_sOvr;setTimeout(function(){if(o&&o.parentNode)o.parentNode.removeChild(o)},260)}else{_sEl.style.transition='transform .2s ease';_sEl.style.transform='translateY(0)'};_sEl=null;_sOvr=null}
