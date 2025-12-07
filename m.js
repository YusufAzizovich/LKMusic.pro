const fileInput = document.getElementById('fileInput');
const audioPlayer = document.getElementById('audioPlayer');
const playlistEl = document.getElementById('playlist');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const randomBtn = document.getElementById('randomBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const newPlaylistBtn = document.getElementById('newPlaylistBtn');
const playlistListEl = document.getElementById('playlistList');
const historyEl = document.getElementById('historyList');

let db, playlists = [], playlist = [], activePlaylistId = null, currentIndex = 0, history = [];

// IndexedDB
const request = indexedDB.open('offlineMusicDB', 11);
request.onupgradeneeded = e => {
  db = e.target.result;
  if(!db.objectStoreNames.contains('playlists')) db.createObjectStore('playlists', { keyPath: 'id', autoIncrement: true });
  if(!db.objectStoreNames.contains('history')) db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
};
request.onsuccess = e => { db = e.target.result; loadPlaylists(); loadHistory(); };

// ===== Создание плейлиста =====
newPlaylistBtn.onclick = () => {
  const name = prompt('Введите название плейлиста:');
  if(!name) return;
  const tx = db.transaction(['playlists'], 'readwrite');
  tx.objectStore('playlists').add({ name, tracks: [] }).onsuccess = loadPlaylists;
};

// ===== Загрузка и рендер плейлистов =====
function loadPlaylists() {
  db.transaction(['playlists'], 'readonly').objectStore('playlists').getAll().onsuccess = e => {
    playlists = e.target.result;
    renderPlaylistList();
    if(activePlaylistId) selectPlaylist(activePlaylistId);
  };
}

function renderPlaylistList() {
  playlistListEl.innerHTML = '';
  playlists.forEach(p => {
    const li = document.createElement('li');
    li.className = p.id === activePlaylistId ? 'active' : '';

    const span = document.createElement('span'); 
    span.textContent = p.name; 
    span.style.flex='1';
    span.onclick = () => selectPlaylist(p.id);

    const editBtn = document.createElement('button');
    editBtn.textContent='✎'; editBtn.className='edit-btn';
    editBtn.onclick = e => {
      e.stopPropagation();
      const newName = prompt('Введите новое название плейлиста:', p.name);
      if(newName) {
        p.name = newName;
        const tx = db.transaction(['playlists'],'readwrite'); tx.objectStore('playlists').put(p);
        loadPlaylists();
      }
    };

    const delBtn = document.createElement('button');
    delBtn.textContent='✕'; delBtn.className='delete-btn';
    delBtn.onclick = e => {
      e.stopPropagation();
      if(confirm('Удалить плейлист?')) {
        const tx = db.transaction(['playlists'],'readwrite'); tx.objectStore('playlists').delete(p.id);
        if(activePlaylistId===p.id) { playlist=[]; activePlaylistId=null; playlistEl.innerHTML=''; audioPlayer.src=''; }
        loadPlaylists();
      }
    };

    li.appendChild(span);
    li.appendChild(editBtn);
    li.appendChild(delBtn);
    playlistListEl.appendChild(li);
  });
}

// ===== Выбор плейлиста =====
function selectPlaylist(id) {
  activePlaylistId = id;
  const pl = playlists.find(p=>p.id===id);
  playlist = pl.tracks.map(t=>({ name: t.name, blob: t.blob, url: URL.createObjectURL(t.blob) }));
  currentIndex = 0;
  renderPlaylist();
  if(playlist.length) playTrack();
}

// ===== Добавление треков =====
fileInput.onchange = () => {
  if(activePlaylistId===null){ alert('Сначала выберите плейлист!'); return; }
  const files = Array.from(fileInput.files);
  const pl = playlists.find(p=>p.id===activePlaylistId);
  files.forEach(f => { 
    const track = { name: f.name, blob: f, url: URL.createObjectURL(f) };
    pl.tracks.push(track); 
    playlist.push(track); 
  });
  renderPlaylist();
  const tx = db.transaction(['playlists'], 'readwrite');
  tx.objectStore('playlists').put(pl);
};

// ===== Рендер треков =====
function renderPlaylist() {
  playlistEl.innerHTML='';
  playlist.forEach((track,index)=>{
    const li = document.createElement('li');
    li.className = index===currentIndex?'active':'';
    const span = document.createElement('span'); span.textContent=track.name; span.style.flex='1';
    span.onclick = () => { currentIndex=index; playTrack(); };
    const del = document.createElement('button'); del.textContent='✕'; del.className='delete-btn';
    del.onclick = e => { 
      e.stopPropagation(); 
      playlist.splice(index,1); 
      const pl = playlists.find(p=>p.id===activePlaylistId);
      pl.tracks.splice(index,1);
      const tx = db.transaction(['playlists'],'readwrite'); tx.objectStore('playlists').put(pl);
      if(currentIndex>=playlist.length) currentIndex=playlist.length-1;
      renderPlaylist(); 
      if(playlist.length) playTrack(); else audioPlayer.src='';
    };
    li.appendChild(span); li.appendChild(del);
    playlistEl.appendChild(li);
  });
}

// ===== История =====
function loadHistory() {
  db.transaction(['history'], 'readonly').objectStore('history').getAll().onsuccess = e => { history = e.target.result.slice(-5).reverse(); renderHistory(); };
}
function saveHistoryTrack(track) { db.transaction(['history'], 'readwrite').objectStore('history').add({ name: track.name, blob: track.blob }); }
function renderHistory() { historyEl.innerHTML=''; history.forEach(t=>{ const li=document.createElement('li'); li.textContent='🎵 '+t.name; li.onclick=()=>{ const idx=playlist.findIndex(x=>x.name===t.name); if(idx!==-1){ currentIndex=idx; playTrack(); } }; historyEl.appendChild(li); }); }

// ===== Воспроизведение =====
function playTrack() { if(!playlist.length) return; const tr=playlist[currentIndex]; audioPlayer.src=tr.url; audioPlayer.play(); renderPlaylist(); updateHistory(tr); }
function updateHistory(track) { history=history.filter(t=>t.name!==track.name); history.unshift(track); if(history.length>5) history.pop(); renderHistory(); saveHistoryTrack(track); }

// ===== Кнопки =====
prevBtn.onclick = ()=>{ if(!playlist.length)return; currentIndex=(currentIndex-1+playlist.length)%playlist.length; playTrack(); };
nextBtn.onclick = ()=>{ if(!playlist.length)return; currentIndex=(currentIndex+1)%playlist.length; playTrack(); };
audioPlayer.onended = ()=>{ currentIndex=(currentIndex+1)%playlist.length; playTrack(); };
randomBtn.onclick = ()=>{ if(!playlist.length)return; currentIndex=Math.floor(Math.random()*playlist.length); playTrack(); };
shuffleBtn.onclick = ()=>{ if(!playlist.length)return; for(let i=playlist.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [playlist[i],playlist[j]]=[playlist[j],playlist[i]]; } currentIndex=0; const pl = playlists.find(p=>p.id===activePlaylistId); pl.tracks = playlist.map(t=>({name:t.name,blob:t.blob})); const tx = db.transaction(['playlists'],'readwrite'); tx.objectStore('playlists').put(pl); renderPlaylist(); playTrack(); };
const togglePlaylistsBtn = document.getElementById('togglePlaylists');
const playlistsWrapper = document.getElementById('playlistsWrapper');

togglePlaylistsBtn.onclick = () => {
  playlistsWrapper.classList.toggle('open');
};
