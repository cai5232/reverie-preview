// 运行时补丁：在页面加载后修复所有问题
document.addEventListener('DOMContentLoaded', function(){
  // 1. 劫持 xkOpenThink，确保弹窗标题正确
  const orig = window.xkOpenThink
  window.xkOpenThink = function(text){
    const body = document.getElementById('xkThinkBody')
    if(body) body.textContent = text
    const overlay = document.getElementById('xkThinkOverlay')
    if(overlay) overlay.classList.add('open')
    // 修弹窗标题
    const head = document.querySelector('.xk-think-head')
    if(head){
      head.childNodes.forEach(n=>{
        if(n.nodeType===3) n.textContent = n.textContent.replace(/思考过程/g,'Thought process')
      })
    }
  }

  // 2. 观察新插入的 .xk-think-btn，改文字
  const obs = new MutationObserver(mutations=>{
    mutations.forEach(m=>{
      m.addedNodes.forEach(node=>{
        if(!node.querySelectorAll) return
        node.querySelectorAll('.xk-think-btn').forEach(btn=>{
          btn.innerHTML = btn.innerHTML.replace(/思考过程/g,'Thought process')
        })
        // 如果自身就是
        if(node.classList && node.classList.contains('xk-think-btn')){
          node.innerHTML = node.innerHTML.replace(/思考过程/g,'Thought process')
        }
        // live 区标题
        node.querySelectorAll && node.querySelectorAll('.xk-think-live-head span').forEach(span=>{
          span.textContent = span.textContent.replace(/思考过程/g,'Thought process')
        })
      })
    })
  })
  const stream = document.getElementById('xkStream')
  if(stream) obs.observe(stream, {childList:true, subtree:true})

  // 3. 修弹窗头部文字（静态 HTML 里的）
  const thinkOverlayHead = document.querySelector('.xk-think-head')
  if(thinkOverlayHead){
    thinkOverlayHead.childNodes.forEach(n=>{
      if(n.nodeType===3) n.textContent = n.textContent.replace(/思考过程|Thinking/g,'Thought process')
    })
  }
})
