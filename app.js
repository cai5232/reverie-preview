document.getElementById('messages').scrollTop = 9999

let cur = 'chat'
const titles = {
  chat:'小克', state:'State', moments:'Moments', forum:'Forum',
  memo:'Memo', music:'Music', dream:'Dream', novel:'Novel',
  game:'Game', shop:'Shop', diary:'Diary', letter:'Letter',
  couple:'Couple Space', setting:'Setting', prettify:'Prettify', mcp:'MCP'
}

function navTo(name){
  document.getElementById('page-'+cur).classList.remove('active')
  cur = name
  document.getElementById('page-'+name).classList.add('active')
  closeSidebar()
}

function openSidebar(){
  document.getElementById('sidebar').classList.add('open')
  document.getElementById('overlay').classList.add('open')
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open')
  document.getElementById('overlay').classList.remove('open')
}

function openDotsMenu(){
  document.getElementById('dotsOverlay').classList.add('open')
}
function closeDotsMenu(){
  document.getElementById('dotsOverlay').classList.remove('open')
}

function togglePlus(){
  document.getElementById('plusPopup').classList.toggle('open')
}
function closePlus(){
  document.getElementById('plusPopup').classList.remove('open')
}

document.addEventListener('click', function(e){
  const pp = document.getElementById('plusPopup')
  if(pp.classList.contains('open') && !pp.contains(e.target) && !e.target.classList.contains('input-plus')){
    closePlus()
  }
})

function changeAvatar(e){
  const file = e.target.files[0]
  if(!file) return
  const reader = new FileReader()
  reader.onload = ev => {
    const old = document.getElementById('sbAvatar')
    const img = document.createElement('img')
    img.className = 'sb-avatar'
    img.id = 'sbAvatar'
    img.src = ev.target.result
    img.ondblclick = () => document.getElementById('avatarInput').click()
    old.parentNode.replaceChild(img, old)
  }
  reader.readAsDataURL(file)
}