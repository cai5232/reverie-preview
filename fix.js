// fix.js v10 - 只做两件事：1.切后台重置xkBusy 2.弹窗拖动关闭
// 不再动 DOM，不起 MutationObserver

// 切后台重置
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState === 'visible'){
    setTimeout(function(){
      if(window.xkBusy === true){
        window.xkBusy = false
        var btn = document.getElementById('xkSendBtn')
        if(btn) btn.disabled = false
      }
    }, 2000)
  }
})

// 弹窗拖动关闭
var _sEl=null,_sY=0,_sOvr=null
document.addEventListener('DOMContentLoaded',function(){
  document.body.addEventListener('touchstart',function(e){
    var s=e.target.closest('[data-sheet]'); if(!s)return
    _sEl=s;_sOvr=s.parentElement;_sY=e.touches[0].clientY;s.style.transition='none'
  },{passive:false})
  document.body.addEventListener('touchmove',function(e){
    if(!_sEl)return
    var dy=e.touches[0].clientY-_sY
    if(dy>0){_sEl.style.transform='translateY('+dy+'px)';e.preventDefault()}
  },{passive:false})
  document.body.addEventListener('touchend',function(e){
    if(!_sEl)return
    var dy=e.changedTouches[0].clientY-_sY
    if(dy>80){
      _sEl.style.transition='transform .25s ease'
      _sEl.style.transform='translateY(100%)'
      var ovr=_sOvr
      setTimeout(function(){if(ovr&&ovr.parentNode)ovr.parentNode.removeChild(ovr)},260)
    }else{
      _sEl.style.transition='transform .2s ease'
      _sEl.style.transform='translateY(0)'
    }
    _sEl=null;_sOvr=null
  },{passive:false})
})
