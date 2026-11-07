const open=p=>{chrome.tabs.create({url:chrome.runtime.getURL(p)});window.close()};
document.getElementById('lib').onclick=()=>open('library.html');
document.getElementById('cur').onclick=()=>open('curriculum.html');
