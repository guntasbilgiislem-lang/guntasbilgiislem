import './style.css';
import { api } from './api.js';
import { offlineAudio } from './offline-audio.js';
import { registerSW } from 'virtual:pwa-register';

// Register PWA Service Worker
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('Yeni güncelleme var, sayfayı yenileyin.');
  },
  onOfflineReady() {
    console.log('Uygulama çevrimdışı çalışmaya hazır.');
  },
});

const app = document.querySelector('#app');

// State
let currentUser = null;
let currentView = 'dashboard';
let isOffline = !navigator.onLine;

// Initialize Network Listeners
window.addEventListener('online', () => {
  isOffline = false;
  api.sendLog('İnternet bağlantısı geri geldi. Canlı yayına geçiliyor.', 'success');
  renderApp(); // Re-render to update status
});

window.addEventListener('offline', () => {
  isOffline = true;
  api.sendLog('İnternet koptu. Çevrimdışı moda geçiliyor.', 'warning');
  offlineAudio.playOfflineCache();
  renderApp();
});

async function init() {
  await offlineAudio.init();
  renderLogin();
}

// RADIO PLAYER LOGIC
class RadioPlayer {
  constructor() {
    this.audio = new Audio();
    this.playlist = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    
    this.audio.addEventListener('ended', () => {
      this.playNext();
    });
    
    this.audio.addEventListener('error', (e) => {
      alert("HATA: Ses dosyası yüklenemedi. (Format veya Bağlantı sorunu olabilir)");
      console.error("Audio playback error:", this.audio.error);
    });
    
    this.audio.addEventListener('playing', () => {
      console.log("Müzik başarıyla çalmaya başladı.");
    });
  }

  start() {
    try {
      if (!this.playlist || this.playlist.length === 0) {
        alert('Çalınacak müzik bulunamadı (Liste boş).');
        return;
      }
      
      this.isPlaying = true;
      this.audio.play().catch(e => {
        alert('Oynatma reddedildi: ' + e.message);
      });
      
      const btn = document.getElementById('radioStartBtn');
      if(btn) {
        btn.innerHTML = '<i class="ph ph-speaker-high" style="font-size: 2rem; vertical-align: middle;"></i> YAYIN AKTİF';
        btn.classList.add('pulse-anim');
        btn.style.background = '#4CAF50';
      }
      
      const titleEl = document.getElementById('nowPlayingTitle');
      if (titleEl) titleEl.innerText = this.playlist[this.currentIndex].name;
      
    } catch (e) {
      console.error('Start error:', e);
      alert('Yayın başlatılamadı: ' + e.message);
    }
  }

  playCurrent() {
    if (this.playlist.length === 0) return;
    const song = this.playlist[this.currentIndex];
    
    // Update the entire branch player UI to reflect the new active song
    const content = document.getElementById('mainContent');
    if (content && window.currentUser && window.currentUser.role === 'branch') {
      content.innerHTML = getBranchPlayerHTML(this.playlist);
      // Restore play state button visually
      const btn = document.getElementById('playPauseBtn');
      if(btn && this.isPlaying) {
        btn.innerHTML = '<i class="ph ph-pause-circle"></i>';
      }
    }

    if (song.file_path) {
      if (this.audio.src !== song.file_path) {
        this.audio.src = song.file_path;
      }
      
      if (this.isPlaying) {
        this.audio.play().catch(e => {
          console.error('Play error', e);
        });
      }
      
      const titleEl = document.getElementById('nowPlayingTitle');
      if (titleEl) titleEl.innerText = song.name;
    } else {
      this.playNext();
    }
  }

  playNext() {
    this.currentIndex++;
    if (this.currentIndex >= this.playlist.length) {
      this.currentIndex = 0; // loop
    }
    this.playCurrent();
  }
  
  togglePlay() {
    if (!this.isPlaying && this.playlist.length > 0) {
      this.start();
      return;
    }
    const btn = document.getElementById('playPauseBtn');
    if (this.audio.paused) {
      this.audio.play();
      if(btn) btn.innerHTML = '<i class="ph ph-pause-circle"></i>';
    } else {
      this.audio.pause();
      if(btn) btn.innerHTML = '<i class="ph ph-play-circle"></i>';
    }
  }

  setVolume(val) {
    this.audio.volume = val / 100;
  }

  toggleMute() {
    this.audio.muted = !this.audio.muted;
    const btn = document.getElementById('muteBtn');
    if(btn) {
      btn.innerHTML = `<i class="ph ${this.audio.muted ? 'ph-speaker-x' : 'ph-speaker-high'}"></i>`;
      btn.style.color = this.audio.muted ? '#F44336' : 'inherit';
    }
  }

  stop() {
    this.isPlaying = false;
    this.audio.pause();
  }
}

window.radio = new RadioPlayer();
window.startRadio = () => window.radio.start();
window.togglePlay = () => window.radio.togglePlay();
window.changeVolume = (val) => window.radio.setVolume(val);
window.toggleMute = () => window.radio.toggleMute();
window.toggleFullScreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => alert("Tam ekran hatası: " + err.message));
  } else {
    document.exitFullscreen();
  }
};

async function handleLogin(e) {
  e.preventDefault();
  const user = document.getElementById('username').value;
  const pass = document.getElementById('password').value;
  const btn = e.target.querySelector('button[type="submit"]');
  const errorEl = document.getElementById('loginError');
  
  errorEl.style.display = 'none';
  btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Giriş Yapılıyor...';
  btn.disabled = true;
  
  try {
    currentUser = await api.login(user, pass);
    offlineAudio.startRecording(); // Start caching audio
    renderApp();
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.style.display = 'block';
    document.querySelector('.login-card').classList.add('shake');
    setTimeout(() => document.querySelector('.login-card').classList.remove('shake'), 500);
    btn.innerHTML = '<i class="ph ph-sign-in"></i> Giriş Yap';
    btn.disabled = false;
  }
}

function handleLogout() {
  api.logout();
  offlineAudio.stopRecording();
  window.radio.stop();
  currentUser = null;
  currentView = 'dashboard';
  renderLogin();
}

function navigateTo(view) {
  const contentEl = document.getElementById('mainContent');
  if(!contentEl) return;
  contentEl.style.opacity = '0';
  
  setTimeout(() => {
    currentView = view;
    renderApp();
  }, 200);
}

function renderLogin() {
  app.innerHTML = `
    <div class="login-container fade-in">
      <div class="glass-panel login-card">
        <div class="logo-container" style="margin-bottom: 1.5rem; display:flex; justify-content:center;">
          <img src="/logo1.jpg" alt="Güntaş Logo" style="max-height: 80px; border-radius:8px;">
        </div>
        <p class="text-muted" style="margin-bottom: 2rem;">Şube Yönetim Portalı</p>
        
        <form id="loginForm">
          <div class="input-group">
            <label for="username">Kullanıcı Adı</label>
            <input type="text" id="username" class="input-field" placeholder="Örn: gun001" required>
          </div>
          <div class="input-group">
            <label for="password">Şifre</label>
            <input type="password" id="password" class="input-field" placeholder="••••••••" required>
          </div>
          <button type="submit" class="btn btn-teal btn-block" style="margin-top: 1rem;">
            <i class="ph ph-sign-in"></i> Giriş Yap
          </button>
        </form>
        
        <div id="loginError" class="text-teal" style="margin-top: 1rem; font-size: 0.85rem; display: none;"></div>
      </div>
    </div>
  `;
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
}

// Global Handlers for CRUD
window.deleteBranch = async (id) => {
  if(confirm('Şubeyi silmek istediğinize emin misiniz?')) {
    try {
      await api.removeBranch(id);
      renderApp();
    } catch (e) {
      alert('Hata: ' + e.message);
    }
  }
};
window.editingBranchId = null;

window.addBranchForm = async (e) => {
  e.preventDefault();
  const name = document.getElementById('newBranchName').value;
  const id = document.getElementById('newBranchId').value;
  const password = document.getElementById('newBranchPass').value;
  
  try {
    if (window.editingBranchId) {
      await api.updateBranch(window.editingBranchId, id, password, name);
    } else {
      await api.addBranch({ name, id, password });
    }
    window.editingBranchId = null;
    renderApp();
  } catch (err) {
    alert('Hata: ' + err.message);
  }
};

window.editBranch = (id, currentName, currentPass) => {
  document.getElementById('newBranchName').value = currentName;
  document.getElementById('newBranchId').value = id;
  document.getElementById('newBranchPass').value = currentPass;
  document.getElementById('branchFormTitle').innerText = 'Şubeyi Düzenle';
  document.getElementById('branchSubmitBtn').innerHTML = '<i class="ph ph-check"></i> Değişiklikleri Kaydet';
  window.editingBranchId = id;
  
  document.getElementById('branchFormCard').scrollIntoView({ behavior: 'smooth' });
};

window.deleteCampaign = async (id) => {
  if(confirm('Kampanyayı silmek istediğinize emin misiniz?')) {
    try {
      await api.removeCampaign(id);
      renderApp();
    } catch (e) {
      alert('Hata: ' + e.message);
    }
  }
};
window.addCampaignForm = async (e) => {
  e.preventDefault();
  const name = document.getElementById('newCampName').value;
  const freq = document.getElementById('newCampFreq').value;
  const fileInput = document.getElementById('newCampFile');
  const file = fileInput.files[0];

  if (!file) {
    alert('Lütfen bir kampanya ses dosyası seçin!');
    return;
  }

  try {
    const btn = document.getElementById('addCampBtn');
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Yükleniyor...';
    btn.disabled = true;

    const fileUrl = await api.uploadCampaignFile(file);
    await api.addCampaign({ name, frequency: freq, file_path: fileUrl });
    
    renderApp();
  } catch (e) {
    alert('Hata: ' + e.message);
    document.getElementById('addCampBtn').innerHTML = '<i class="ph ph-plus"></i> Kampanyayı Ekle';
    document.getElementById('addCampBtn').disabled = false;
  }
};

window.deleteSong = async (id) => {
  if(confirm('Şarkıyı listeden çıkarmak istediğinize emin misiniz?')) {
    try {
      await api.removeSong(id);
      renderApp();
    } catch (e) {
      alert('Hata: ' + e.message);
    }
  }
};
window.addSongForm = async (e) => {
  e.preventDefault();
  
  const fileInput = document.getElementById('newSongFile');
  const file = fileInput.files[0];
  
  if (!file) {
    alert('Lütfen bir MP3 veya ses dosyası seçin!');
    return;
  }

  try {
    const btn = document.getElementById('addSongBtn');
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Yükleniyor...';
    btn.disabled = true;

    // Supabase Storage'a Yükle
    const fileUrl = await api.uploadMusicFile(file);
    
    // Supabase Database'e Kaydet
    await api.addSong({ 
      name: file.name.replace(/\.[^/.]+$/, ""), 
      duration: 'URL', // can parse duration using audio context if needed
      file_path: fileUrl 
    });

    renderApp();
  } catch (err) {
    alert('Hata: ' + err.message);
    document.getElementById('addSongBtn').innerHTML = '<i class="ph ph-upload"></i> Yükle / Ekle';
    document.getElementById('addSongBtn').disabled = false;
  }
};

window.playSong = (url) => {
  if (!url) return alert('Bu parçanın ses dosyası bulunamadı.');
  const player = new Audio(url);
  player.play();
  alert('Çalınıyor: ' + url);
};

window.moveSong = async (id, direction) => {
  const currentIndex = currentPlaylistData.findIndex(s => s.id === id);
  if (currentIndex < 0) return;
  
  if (direction === 'up' && currentIndex > 0) {
    // Swap
    const temp = currentPlaylistData[currentIndex];
    currentPlaylistData[currentIndex] = currentPlaylistData[currentIndex - 1];
    currentPlaylistData[currentIndex - 1] = temp;
  } else if (direction === 'down' && currentIndex < currentPlaylistData.length - 1) {
    // Swap
    const temp = currentPlaylistData[currentIndex];
    currentPlaylistData[currentIndex] = currentPlaylistData[currentIndex + 1];
    currentPlaylistData[currentIndex + 1] = temp;
  } else {
    return;
  }

  // Update UI optimistically
  const mainContent = document.getElementById('mainContent');
  mainContent.innerHTML = getMusicHTML(currentPlaylistData);

  // Save to DB
  try {
    const orderedIds = currentPlaylistData.map(s => s.id);
    await api.reorderPlaylist(orderedIds);
  } catch(e) {
    alert('Sıralama kaydedilemedi: ' + e.message);
  }
};

let currentPlaylistData = [];

async function renderApp() {
  if (currentUser.role === 'branch') {
    try {
      currentPlaylistData = await api.fetchPlaylist();
      
      // PRELOAD THE FIRST SONG TO BYPASS AUTOPLAY RESTRICTIONS
      if (currentPlaylistData && currentPlaylistData.length > 0) {
        window.radio.playlist = currentPlaylistData;
        window.radio.currentIndex = 0;
        window.radio.audio.src = currentPlaylistData[0].file_path;
      }

      app.innerHTML = getBranchPlayerHTML(currentPlaylistData);
    } catch (e) {
      app.innerHTML = `<div style="color:red; text-align:center; padding:2rem;">Müzik listesi yüklenemedi: ${e.message}</div>`;
    }
    return;
  }

  const offlineBanner = isOffline ? 
    `<div style="background: #F44336; color: white; text-align: center; padding: 0.5rem; font-size: 0.85rem; position: fixed; top: 0; width: 100%; z-index: 9999;">
      <i class="ph ph-wifi-slash"></i> İnternet bağlantısı yok. Sistem çevrimdışı modda çalışıyor ve son 1 saatlik bellekten müzik çalıyor.
    </div>` : '';

  let html = `
    ${offlineBanner}
    <div class="dashboard-layout fade-in" style="${isOffline ? 'margin-top: 30px;' : ''}">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-brand" style="display:flex; justify-content:center;">
          <img src="/logo1.jpg" alt="Logo" style="max-height: 60px; border-radius:6px;">
        </div>
        
        <ul class="nav-menu">
          <a href="#" class="nav-item ${currentView === 'dashboard' ? 'active' : ''}" data-view="dashboard">
            <i class="ph ph-squares-four"></i>
            <span>Ana Ekran</span>
          </a>
          ${currentUser.role === 'admin' ? `
          <a href="#" class="nav-item ${currentView === 'music' ? 'active' : ''}" data-view="music">
            <i class="ph ph-music-notes"></i>
            <span>Müzik Yönetimi</span>
          </a>
          <a href="#" class="nav-item ${currentView === 'campaigns' ? 'active' : ''}" data-view="campaigns">
            <i class="ph ph-megaphone"></i>
            <span>Kampanyalar</span>
          </a>
          <a href="#" class="nav-item ${currentView === 'branches' ? 'active' : ''}" data-view="branches">
            <i class="ph ph-storefront"></i>
            <span>Şube Yönetimi</span>
          </a>
          ` : ''}
          <a href="#" class="nav-item" id="logoutBtn" style="margin-top: 1rem; color: #F44336;">
            <i class="ph ph-sign-out"></i>
            <span>Çıkış Yap</span>
          </a>
        </ul>
        
        <div class="user-profile">
          <div class="user-avatar">
            ${currentUser.name.charAt(0)}
          </div>
          <div class="user-info">
            <h4>${currentUser.name}</h4>
            <p>${currentUser.role === 'admin' ? 'Sistem Yöneticisi' : 'Şube Yöneticisi'}</p>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="main-content" id="mainContent" style="transition: opacity 0.2s ease;">
        <div style="display:flex; justify-content:center; align-items:center; height:100%;">
           <i class="ph ph-spinner ph-spin text-teal" style="font-size: 3rem;"></i>
        </div>
      </main>
    </div>
  `;
  
  app.innerHTML = html;

  // Add listeners
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(e.currentTarget.getAttribute('data-view'));
    });
  });
  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    handleLogout();
  });

  const mainContent = document.getElementById('mainContent');
  
  try {
    if (currentView === 'dashboard') {
      currentPlaylistData = await api.fetchPlaylist();
      mainContent.innerHTML = getDashboardHTML(currentPlaylistData);
    } else if (currentView === 'music') {
      currentPlaylistData = await api.fetchPlaylist();
      mainContent.innerHTML = getMusicHTML(currentPlaylistData);
    } else if (currentView === 'campaigns') {
      const campaigns = await api.fetchCampaigns();
      mainContent.innerHTML = getCampaignsHTML(campaigns);
    } else if (currentView === 'branches' && currentUser.role === 'admin') {
      const branches = await api.fetchBranches();
      mainContent.innerHTML = getBranchesHTML(branches);
    }
  } catch (error) {
    mainContent.innerHTML = `<div class="glass-panel" style="padding: 2rem; text-align:center; color: #F44336;"><i class="ph ph-warning" style="font-size: 3rem;"></i><br>Veri yüklenirken hata oluştu: ${error.message}</div>`;
  }
  
  requestAnimationFrame(() => {
    mainContent.style.opacity = '1';
  });
}

// ================= VIEW TEMPLATES =================

function getBranchPlayerHTML(playlist) {
  const currentSong = playlist && playlist.length > 0 ? playlist[window.radio.currentIndex || 0].name : 'Hazır Bekliyor';
  
  const playlistItems = playlist.map((m, i) => `
    <div style="padding: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); display:flex; align-items:center; gap: 1rem; background: ${i === window.radio.currentIndex ? 'rgba(0, 229, 255, 0.1)' : 'transparent'}; border-left: ${i === window.radio.currentIndex ? '4px solid var(--color-primary)' : '4px solid transparent'};">
      <div style="color: var(--color-text-muted); width: 20px;">${i + 1}</div>
      <div style="flex: 1; font-weight: ${i === window.radio.currentIndex ? 'bold' : 'normal'}; color: ${i === window.radio.currentIndex ? 'var(--color-primary)' : 'inherit'};">${m.name}</div>
    </div>
  `).join('');

  return `
    <div style="display: flex; flex-direction: column; height: 100vh; background: var(--color-dark); color: white;">
      
      <!-- Top Bar -->
      <div style="padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); border-bottom: 1px solid rgba(255,255,255,0.05);">
        <img src="/logo1.jpg" alt="Güntaş" style="height: 60px; border-radius: 4px;">
        <div style="display:flex; align-items:center; gap: 1rem;">
          <div style="display:flex; align-items:center; gap: 0.5rem; color: ${isOffline ? '#F44336' : '#4CAF50'};">
            <i class="ph ${isOffline ? 'ph-wifi-slash' : 'ph-wifi-high'}"></i>
            <span>${isOffline ? 'Çevrimdışı Mod' : 'Canlı Yayın Aktif'}</span>
          </div>
          <button onclick="handleLogout()" class="btn" style="background:transparent; color:#F44336; border:1px solid #F44336;"><i class="ph ph-sign-out"></i> Çıkış</button>
        </div>
      </div>

      <!-- Main Visual Area -->
      <div style="flex: 1; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; padding: 2rem;">
        
        <div style="text-align: center; z-index: 2;">
          <div class="music-disc ${window.radio.isPlaying ? 'spin' : ''}" style="width: 200px; height: 200px; border-radius: 50%; background: linear-gradient(135deg, var(--color-primary), var(--color-secondary)); margin: 0 auto 2rem auto; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 40px rgba(0, 229, 255, 0.4);">
            <i class="ph ph-music-note" style="font-size: 5rem; color: #fff;"></i>
          </div>
          <h1 id="nowPlayingTitle" style="font-size: 2.5rem; margin-bottom: 0.5rem; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">${currentSong}</h1>
          <p class="text-muted" style="font-size: 1.2rem;">Sıradaki yayın akışı devam ediyor...</p>
        </div>

        <!-- Playlist Sidebar (Desktop) -->
        <div style="position: absolute; right: 0; top: 0; bottom: 0; width: 350px; background: rgba(0,0,0,0.5); border-left: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column;" class="hide-mobile">
          <div style="padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <h3 style="display:flex; align-items:center; gap:0.5rem;"><i class="ph ph-list-dashes"></i> Yayın Akışı</h3>
          </div>
          <div style="flex: 1; overflow-y: auto;" id="branchPlaylistContainer">
            ${playlistItems}
          </div>
        </div>

      </div>

      <!-- Bottom Player Controls -->
      <div class="player-bottom-bar" style="height: 90px; background: rgba(0,0,0,0.8); border-top: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between; padding: 0 2rem;">
        
        <div class="player-bottom-left" style="width: 200px; display:flex; align-items:center; gap: 1rem;">
          <div style="width: 40px; height: 40px; background: var(--color-primary); border-radius: 4px; display:flex; justify-content:center; align-items:center;"><i class="ph ph-music-notes" style="font-size: 1.5rem;"></i></div>
          <div style="font-size:0.8rem; color:var(--color-text-muted);">Müzik Akışı</div>
        </div>

        <div style="display: flex; align-items: center; gap: 1.5rem;">
          <button class="btn" style="background:transparent; border:none; color:white; font-size: 2rem;" onclick="window.radio.playNext()"><i class="ph ph-skip-back-circle"></i></button>
          
          <button id="playPauseBtn" class="btn" style="background:transparent; border:none; color:var(--color-primary); font-size: 4rem; line-height: 1;" onclick="window.togglePlay()">
            <i class="ph ${window.radio.isPlaying ? 'ph-pause-circle' : 'ph-play-circle'}"></i>
          </button>
          
          <button class="btn" style="background:transparent; border:none; color:white; font-size: 2rem;" onclick="window.radio.playNext()"><i class="ph ph-skip-forward-circle"></i></button>
        </div>

        <div class="player-bottom-right" style="display: flex; align-items: center; gap: 1rem; width: 200px; justify-content: flex-end;">
          <button id="muteBtn" class="btn hide-mobile" style="background:transparent; border:none; color:var(--color-text-muted); font-size: 1.5rem;" onclick="window.toggleMute()"><i class="ph ph-speaker-high"></i></button>
          <input type="range" min="0" max="100" value="100" style="width: 100px; accent-color: var(--color-primary);" class="hide-mobile" oninput="window.changeVolume(this.value)">
          <button class="btn" style="background:transparent; border:none; color:var(--color-text-muted); font-size: 1.5rem;" onclick="window.toggleFullScreen()"><i class="ph ph-corners-out"></i></button>
        </div>

      </div>
    </div>
  `;
}

function getDashboardHTML(playlist) {
  const nextSong = (playlist && playlist.length > 0) ? playlist[0].name : 'Sırada bekleyen parça yok';

  return `
    <header class="top-header fade-in-up">
      <div>
        <h1 style="font-size: 1.8rem; margin-bottom: 0.2rem;">Hoşgeldiniz, ${currentUser.name}</h1>
        <p class="text-muted">Güntaş Müzik ve Kampanya Yönetim Portalı</p>
      </div>
      <div class="status-badge" style="border-color: ${isOffline ? '#F44336' : 'rgba(0, 229, 255, 0.2)'}; color: ${isOffline ? '#F44336' : 'var(--color-secondary)'}; background: ${isOffline ? 'rgba(244, 67, 54, 0.1)' : 'rgba(0, 229, 255, 0.1)'}">
        <div class="status-dot" style="background: ${isOffline ? '#F44336' : 'var(--color-secondary)'}; box-shadow: 0 0 8px ${isOffline ? '#F44336' : 'var(--color-secondary)'}; animation: ${isOffline ? 'none' : 'pulse 2s infinite'}"></div>
        ${isOffline ? 'Çevrimdışı' : 'Sistem Aktif'}
      </div>
    </header>
    
    <div class="grid-cards fade-in-up" style="animation-delay: 0.1s; margin-top: 2rem;">
      <!-- Music Card -->
      <div class="glass-panel dashboard-card hover-lift">
        <div class="card-header">
          <div class="card-title"><i class="ph ph-speaker-hifi text-teal"></i> Şu An Çalan</div>
          <span style="font-size: 0.8rem; background: rgba(255,255,255,0.1); padding: 0.2rem 0.6rem; border-radius: 12px;">${isOffline ? 'Offline Hafıza' : 'Canlı Akış'}</span>
        </div>
        <div style="text-align: center; padding: 1rem 0;">
          <div class="music-disc" style="width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg, var(--color-primary), var(--color-secondary)); margin: 0 auto 1rem auto; display: flex; align-items: center; justify-content: center;">
            <i class="ph ph-music-note" style="font-size: 2.5rem; color: #fff;"></i>
          </div>
          <h3>${isOffline ? 'Çevrimdışı Mod Müzikleri' : 'Güntaş Müzik Akışı'}</h3>
          <p class="text-muted" style="margin-top: 0.5rem;">Sıradaki: <span id="nowPlayingTitle">${isOffline ? 'Önbellekten devam ediliyor...' : nextSong}</span></p>
        </div>
      </div>

      <!-- System Status -->
      <div class="glass-panel dashboard-card hover-lift">
        <div class="card-header">
          <div class="card-title"><i class="ph ph-cpu text-teal"></i> Cihaz Durumu</div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 0.5rem;">
          <div style="display: flex; justify-content: space-between;"><span class="text-muted">Bağlantı:</span>
            ${isOffline 
              ? '<span style="color: #F44336;"><i class="ph ph-wifi-slash"></i> Yok</span>' 
              : '<span style="color: #4CAF50;"><i class="ph ph-wifi-high"></i> Çevrimiçi</span>'
            }
          </div>
          <div style="display: flex; justify-content: space-between;"><span class="text-muted">Senkronizasyon:</span><span>${isOffline ? 'Bilinmiyor' : 'Az önce'}</span></div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="text-muted">Ses Seviyesi:</span>
            <span>%75</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getMusicHTML(playlist) {
  const listHtml = playlist.map((m, index) => `
    <li style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:0.8rem; border-radius:8px; margin-bottom: 0.5rem;">
      <div style="display:flex; align-items:center; gap: 1rem; flex: 1;">
        <div style="display:flex; flex-direction:column; gap:0.2rem;">
          <button class="btn btn-primary" style="padding: 0.2rem; background: transparent; border:none; color: var(--color-text-muted);" onclick="window.moveSong('${m.id}', 'up')" ${index === 0 ? 'disabled' : ''}><i class="ph ph-caret-up"></i></button>
          <button class="btn btn-primary" style="padding: 0.2rem; background: transparent; border:none; color: var(--color-text-muted);" onclick="window.moveSong('${m.id}', 'down')" ${index === playlist.length - 1 ? 'disabled' : ''}><i class="ph ph-caret-down"></i></button>
        </div>
        <div>
          <strong>${index + 1}. ${m.name}</strong><br>
          <span class="text-muted" style="font-size:0.8rem;">
            ${m.file_path ? `<a href="${m.file_path}" target="_blank" style="color:var(--color-primary);">Dosya Bağlantısı</a>` : 'Süre: ' + m.duration}
          </span>
        </div>
      </div>
      <div style="display:flex; gap:0.5rem;">
        ${m.file_path ? `<button class="btn btn-primary" style="padding: 0.2rem 0.5rem; background: rgba(0, 229, 255, 0.2); border-color: rgba(0, 229, 255, 0.3); color: var(--color-secondary);" onclick="window.playSong('${m.file_path}')"><i class="ph ph-play"></i></button>` : ''}
        <button class="btn btn-primary" style="padding: 0.2rem 0.5rem; background: rgba(244, 67, 54, 0.2); border-color: rgba(244, 67, 54, 0.3); color: #F44336;" onclick="window.deleteSong('${m.id}')"><i class="ph ph-trash"></i></button>
      </div>
    </li>
  `).join('');

  return `
    <header class="top-header fade-in-up">
      <div>
        <h1 style="font-size: 1.8rem; margin-bottom: 0.2rem;">Müzik Yönetimi</h1>
        <p class="text-muted">Şube içi müzik yayınını kontrol edin</p>
      </div>
    </header>
    
    <div class="glass-panel fade-in-up" style="padding: 1.5rem; animation-delay: 0.1s; margin-bottom: 2rem;">
      <h3 style="margin-bottom: 1rem;">Yayın Akışı Seçimi</h3>
      <div class="music-modes">
        <div class="mode-card ${isOffline ? '' : 'active'}">
          <i class="ph ph-radio mode-icon"></i>
          <h4>Güntaş Radyo</h4>
          <p class="text-muted" style="font-size: 0.8rem;">Merkezden canlı yayın</p>
        </div>
        <div class="mode-card">
          <i class="ph ph-playlist mode-icon"></i>
          <h4>Özel Liste</h4>
          <p class="text-muted" style="font-size: 0.8rem;">Şubeye özel seçilmiş liste</p>
        </div>
        <div class="mode-card ${isOffline ? 'active' : ''}">
          <i class="ph ph-cloud-slash mode-icon"></i>
          <h4>Çevrimdışı Mod</h4>
          <p class="text-muted" style="font-size: 0.8rem;">Son 1 saatlik bellekten çalar</p>
        </div>
      </div>
    </div>

    <div class="grid-cards fade-in-up" style="animation-delay: 0.2s;">
      <div class="glass-panel dashboard-card">
        <div class="card-header"><div class="card-title">Kendi Müziklerim (Özel Liste)</div></div>
        <ul style="list-style:none; padding:0; margin-top:1rem; display:flex; flex-direction:column;">
          ${listHtml}
        </ul>
      </div>

      <div class="glass-panel dashboard-card">
        <div class="card-header"><div class="card-title">Müzik Ekle (Supabase)</div></div>
        <form onsubmit="window.addSongForm(event)" style="margin-top: 1rem;">
          <div class="input-group">
            <label>MP3 veya Ses Dosyası Seçin</label>
            <input type="file" id="newSongFile" class="input-field" accept="audio/*" required style="padding: 0.5rem;">
          </div>
          <button type="submit" id="addSongBtn" class="btn btn-teal btn-block"><i class="ph ph-upload"></i> Dosyayı Yükle</button>
        </form>
      </div>
    </div>
  `;
}

function getCampaignsHTML(campaigns) {
  const campsHtml = campaigns.map(c => `
    <li style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:0.8rem; border-radius:8px; margin-bottom: 0.5rem;">
      <div>
        <strong>${c.name}</strong> <span class="badge badge-online">Aktif</span><br>
        <span class="text-muted" style="font-size:0.8rem;">
          Sıklık: ${c.frequency} | ${c.file_path ? `<a href="${c.file_path}" target="_blank" style="color:var(--color-primary);">Dosyayı Gör</a>` : 'Sadece Metin'}
        </span>
      </div>
      <div style="display:flex; gap:0.5rem; align-items:center;">
        ${c.file_path ? `<button class="btn btn-primary" style="padding: 0.2rem 0.5rem; background: rgba(0, 229, 255, 0.2); border-color: rgba(0, 229, 255, 0.3); color: var(--color-secondary);" onclick="window.playSong('${c.file_path}')"><i class="ph ph-play"></i></button>` : ''}
        <button class="btn btn-primary" style="padding: 0.2rem 0.5rem; background: rgba(244, 67, 54, 0.2); border-color: rgba(244, 67, 54, 0.3); color: #F44336;" onclick="window.deleteCampaign('${c.id}')"><i class="ph ph-trash"></i></button>
      </div>
    </li>
  `).join('');

  return `
    <header class="top-header fade-in-up">
      <div>
        <h1 style="font-size: 1.8rem; margin-bottom: 0.2rem;">Kampanyalar</h1>
        <p class="text-muted">Mağaza içi reklam seslerini yönetin</p>
      </div>
    </header>

    <div class="grid-cards fade-in-up" style="animation-delay: 0.1s;">
      <div class="glass-panel dashboard-card">
        <div class="card-header"><div class="card-title">Aktif Kampanyalar</div></div>
        <ul style="list-style:none; padding:0; margin-top:1rem; display:flex; flex-direction:column;">
          ${campsHtml}
        </ul>
      </div>

      <div class="glass-panel dashboard-card">
        <div class="card-header"><div class="card-title">Yeni Kampanya Sesi Ekle</div></div>
        <form onsubmit="window.addCampaignForm(event)" style="margin-top: 1rem;">
          <div class="input-group">
            <label>Kampanya Adı</label>
            <input type="text" id="newCampName" class="input-field" placeholder="Örn: Hafta Sonu İndirimi" required>
          </div>
          <div class="input-group">
            <label>Yayın Sıklığı</label>
            <select id="newCampFreq" class="input-field" style="background-color: var(--color-dark);" required>
              <option value="15 Dakikada Bir">15 Dakikada Bir</option>
              <option value="30 Dakikada Bir">30 Dakikada Bir</option>
              <option value="1 Saatte Bir">1 Saatte Bir</option>
              <option value="Manuel">Manuel (Tetiklemeli)</option>
            </select>
          </div>
          <div class="input-group">
            <label>Kampanya Ses Dosyası (MP3/WAV)</label>
            <input type="file" id="newCampFile" class="input-field" accept="audio/*" required style="padding: 0.5rem;">
          </div>
          <button type="submit" id="addCampBtn" class="btn btn-teal btn-block"><i class="ph ph-plus"></i> Kampanyayı Ekle</button>
        </form>
      </div>
    </div>
  `;
}

function getBranchesHTML(branches) {
  const tbody = branches.map(b => `
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);" class="table-row-hover">
      <td style="padding: 1rem;"><strong>${b.name}</strong><br><span style="font-size:0.8rem; color:var(--color-text-muted);">ID: ${b.id}</span></td>
      <td style="padding: 1rem;">
        ${b.status === 'online' 
          ? '<span style="color: #4CAF50; display:flex; align-items:center; gap:0.3rem;"><i class="ph ph-wifi-high"></i> Çevrimiçi</span>' 
          : '<span style="color: #F44336; display:flex; align-items:center; gap:0.3rem;"><i class="ph ph-wifi-slash"></i> Çevrimdışı</span>'}
      </td>
      <td style="padding: 1rem;"><span style="background: rgba(255,255,255,0.1); padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.85rem;">${b.music}</span></td>
      <td style="padding: 1rem; color:var(--color-text-muted); font-size:0.85rem;">${b.sync}</td>
      <td style="padding: 1rem; color:var(--color-text-muted); font-size:0.85rem;">${b.password}</td>
      <td style="padding: 1rem; display:flex; gap:0.5rem;">
        <button class="btn btn-primary" style="padding: 0.3rem 0.6rem; background: rgba(0, 229, 255, 0.2); border-color: rgba(0, 229, 255, 0.3); color: var(--color-secondary);" title="Düzenle" onclick="window.editBranch('${b.id}', '${b.name}', '${b.password}')"><i class="ph ph-pencil-simple"></i></button>
        <button class="btn btn-primary" style="padding: 0.3rem 0.6rem; background: rgba(244, 67, 54, 0.2); border-color: rgba(244, 67, 54, 0.3); color: #F44336;" title="Sil" onclick="window.deleteBranch('${b.id}')"><i class="ph ph-trash"></i></button>
      </td>
    </tr>
  `).join('');

  return `
    <header class="top-header fade-in-up">
      <div>
        <h1 style="font-size: 1.8rem; margin-bottom: 0.2rem;">Şube Yönetimi</h1>
        <p class="text-muted">Şube ekleyip çıkarın, durumlarını izleyin</p>
      </div>
    </header>

    <div class="grid-cards fade-in-up" style="animation-delay: 0.1s;">
      <div class="glass-panel dashboard-card" style="grid-column: span 2;">
        <div class="card-header">
          <div class="card-title">Mevcut Şubeler (${branches.length})</div>
        </div>
        <div style="overflow-x: auto; margin-top: 1rem;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 1px solid var(--color-border);">
                <th style="padding: 1rem; color: var(--color-secondary);">Şube Adı</th>
                <th style="padding: 1rem; color: var(--color-secondary);">Bağlantı</th>
                <th style="padding: 1rem; color: var(--color-secondary);">Şu An Çalan</th>
                <th style="padding: 1rem; color: var(--color-secondary);">Son Senkron</th>
                <th style="padding: 1rem; color: var(--color-secondary);">Şifre</th>
                <th style="padding: 1rem; color: var(--color-secondary);">İşlem</th>
              </tr>
            </thead>
            <tbody>
              ${tbody}
            </tbody>
          </table>
        </div>
      </div>

      <div class="glass-panel dashboard-card" id="branchFormCard">
        <div class="card-header"><div class="card-title" id="branchFormTitle">Yeni Şube Ekle</div></div>
        <form onsubmit="window.addBranchForm(event)" style="margin-top: 1rem;">
          <div class="input-group">
            <label>Şube Adı</label>
            <input type="text" id="newBranchName" class="input-field" placeholder="Örn: Beşikdüzü" required>
          </div>
          <div class="input-group">
            <label>Şube ID (Kullanıcı Adı)</label>
            <input type="text" id="newBranchId" class="input-field" placeholder="Örn: gun003" required>
          </div>
          <div class="input-group">
            <label>Şifre</label>
            <input type="text" id="newBranchPass" class="input-field" placeholder="Örn: sifre123" required>
          </div>
          <button type="submit" id="branchSubmitBtn" class="btn btn-teal btn-block"><i class="ph ph-plus"></i> Şubeyi Kaydet</button>
        </form>
      </div>
    </div>
  `;
}

init();
