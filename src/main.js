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

const app = document.getElementById('app');
let currentUser = JSON.parse(localStorage.getItem('current_user')) || null;
let currentView = 'dashboard';
let isOffline = false;

// TOAST NOTIFICATION SYSTEM
window.showToast = (message, type = 'info') => {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ph-info';
  if (type === 'success') icon = 'ph-check-circle';
  if (type === 'error') icon = 'ph-warning-circle';

  toast.innerHTML = `
    <i class="ph ${icon}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

// LOGO BACKGROUND REMOVER (ROBUST FLOOD FILL)
window.makeTransparent = (img) => {
  if (img.dataset.processed || !img.complete || img.naturalWidth === 0) return;
  
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    
    // Sample all 4 corners to find the background color
    const cornerIndices = [0, (width - 1) * 4, ((height - 1) * width) * 4, ((height * width) - 1) * 4];
    const targetR = data[cornerIndices[0]], targetG = data[cornerIndices[0]+1], targetB = data[cornerIndices[0]+2];
    
    const isMainLogo = img.src.includes('logo2.png');
    
    if (isMainLogo) {
      // For logo2.png: remove all pixels matching ANY corner color (handles all 4 edges of the blue background)
      // Also hardcode the known blue range as a fallback (logo2 blue is approximately R:0-30, G:40-90, B:150-220)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        // Check against sampled corner color with high tolerance
        const dr = Math.abs(r - targetR);
        const dg = Math.abs(g - targetG);
        const db = Math.abs(b - targetB);
        const matchesCorner = dr < 80 && dg < 80 && db < 80;
        // Also check each of the 4 corners independently
        let matchesAnyCorner = matchesCorner;
        for (const ci of cornerIndices) {
          const cr = data[ci], cg = data[ci+1], cb = data[ci+2];
          if (Math.abs(r-cr) < 80 && Math.abs(g-cg) < 80 && Math.abs(b-cb) < 80) {
            matchesAnyCorner = true;
            break;
          }
        }
        if (matchesAnyCorner) {
          data[i+3] = 0;
        }
      }
    } else {
      // Flood fill (connected areas only) for circular PWA icon
      const visited = new Uint8Array(width * height);
      const stack = [0, width - 1, (height - 1) * width, height * width - 1];
      while (stack.length > 0) {
        const idx = stack.pop();
        if (visited[idx]) continue;
        visited[idx] = 1;
        const pIdx = idx * 4;
        const dr = Math.abs(data[pIdx] - targetR), dg = Math.abs(data[pIdx+1] - targetG), db = Math.abs(data[pIdx+2] - targetB);
        if (dr < 50 && dg < 50 && db < 50) {
          data[pIdx+3] = 0;
          const x = idx % width, y = Math.floor(idx / width);
          if (x > 0) stack.push(idx - 1);
          if (x < width - 1) stack.push(idx + 1);
          if (y > 0) stack.push(idx - width);
          if (y < height - 1) stack.push(idx + width);
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
    img.src = canvas.toDataURL();
  } catch (err) {
    console.warn('Transparency failed:', err);
  } finally {
    img.dataset.processed = "true";
    img.style.visibility = 'visible';
  }
};

window.fixFavicon = (src) => {
  try {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width, height = canvas.height;
        const targetR = data[0], targetG = data[1], targetB = data[2];
        const visited = new Uint8Array(width * height);
        const stack = [0, width - 1, (height - 1) * width, height * width - 1];
        while (stack.length > 0) {
          const idx = stack.pop();
          if (visited[idx]) continue;
          visited[idx] = 1;
          const pIdx = idx * 4;
          const dr = Math.abs(data[pIdx] - targetR), dg = Math.abs(data[pIdx+1] - targetG), db = Math.abs(data[pIdx+2] - targetB);
          if (dr < 50 && dg < 50 && db < 50) {
            data[pIdx+3] = 0;
            const x = idx % width, y = Math.floor(idx / width);
            if (x > 0) stack.push(idx - 1);
            if (x < width - 1) stack.push(idx + 1);
            if (y > 0) stack.push(idx - width);
            if (y < height - 1) stack.push(idx + width);
          }
        }
        ctx.putImageData(imageData, 0, 0);
        const link = document.querySelector("link[rel*='icon']");
        if (link) link.href = canvas.toDataURL();
      } catch (innerErr) { console.warn('Favicon canvas error:', innerErr); }
    };
    img.src = src;
  } catch (outerErr) { console.warn('Favicon load error:', outerErr); }
};

isOffline = !navigator.onLine;

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
  try {
    window.fixFavicon('/app-icon.png?v=' + Date.now());
  } catch (e) {
    console.error('Favicon fix failed:', e);
  }
  
  const token = localStorage.getItem('auth_token');
  if (token) {
    try {
      currentUser = JSON.parse(localStorage.getItem('current_user'));
      renderApp();
    } catch (e) {
      renderLogin();
    }
  } else {
    renderLogin();
  }
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
      showToast("HATA: Ses dosyası yüklenemedi. (Format veya Bağlantı sorunu olabilir)", 'error');
      console.error("Audio playback error:", this.audio.error);
    });
    
    this.audio.addEventListener('playing', () => {
      console.log("Müzik başarıyla çalmaya başladı.");
      this._updatePlaylistHighlight();
      this._updatePlayPauseBtn(true);
    });

    this.audio.addEventListener('pause', () => {
      this._updatePlayPauseBtn(false);
    });
  }

  start() {
    try {
      if (!this.playlist || this.playlist.length === 0) {
        showToast('Çalınacak müzik bulunamadı (Liste boş).', 'info');
        return;
      }
      
      this.isPlaying = true;
      this.audio.play().catch(e => {
        showToast('Oynatma reddedildi: ' + e.message, 'error');
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
      showToast('Yayın başlatılamadı: ' + e.message, 'error');
    }
  }

  _updatePlaylistHighlight() {
    const items = document.querySelectorAll('#branchPlaylistContainer > div');
    items.forEach((el, i) => {
      const isActive = i === this.currentIndex;
      el.style.background = isActive ? 'rgba(0, 229, 255, 0.1)' : 'transparent';
      el.style.borderLeft = isActive ? '4px solid var(--color-primary)' : '4px solid transparent';
      const nameEl = el.querySelector('div:last-child');
      if (nameEl) {
        nameEl.style.fontWeight = isActive ? 'bold' : 'normal';
        nameEl.style.color = isActive ? 'var(--color-primary)' : 'inherit';
      }
    });
    // Scroll active item into view
    if (items[this.currentIndex]) {
      items[this.currentIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  _updatePlayPauseBtn(isPlaying) {
    const btn = document.getElementById('playPauseBtn');
    if (btn) {
      btn.innerHTML = isPlaying
        ? '<i class="ph ph-pause-circle"></i>'
        : '<i class="ph ph-play-circle"></i>';
    }
  }

  playCurrent() {
    if (this.playlist.length === 0) return;
    const song = this.playlist[this.currentIndex];

    // Update title
    const titleEl = document.getElementById('nowPlayingTitle');
    if (titleEl) titleEl.innerText = song.name;

    // Update playlist highlight without full re-render
    this._updatePlaylistHighlight();

    if (song.file_path) {
      if (this.audio.src !== song.file_path) {
        this.audio.src = song.file_path;
      }
      if (this.isPlaying) {
        this.audio.play().catch(e => console.error('Play error', e));
      }
    } else {
      this.playNext();
    }
  }

  playNext() {
    this.currentIndex++;
    if (this.currentIndex >= this.playlist.length) {
      this.currentIndex = 0;
    }
    this.playCurrent();
  }

  playPrev() {
    this.currentIndex--;
    if (this.currentIndex < 0) {
      this.currentIndex = this.playlist.length - 1;
    }
    this.playCurrent();
  }
  
  togglePlay() {
    if (!this.isPlaying && this.playlist.length > 0) {
      this.start();
      return;
    }
    if (this.audio.paused) {
      this.audio.play();
    } else {
      this.audio.pause();
    }
    // Button state is updated via 'playing' and 'pause' audio events
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
    document.documentElement.requestFullscreen().catch(err => showToast("Tam ekran hatası: " + err.message, 'error'));
  } else {
    document.exitFullscreen();
  }
};

async function handleLogin(e) {
  e.preventDefault();
  const user = document.getElementById('username').value;
  const pass = document.getElementById('password').value;
  const rememberMe = document.getElementById('rememberMe').checked;
  const btn = e.target.querySelector('button[type="submit"]');
  const errorEl = document.getElementById('loginError');
  
  errorEl.style.display = 'none';
  btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Giriş Yapılıyor...';
  btn.disabled = true;
  
  try {
    currentUser = await api.login(user, pass);
    
    // Remember Me Logic
    if (rememberMe) {
      localStorage.setItem('remembered_username', user);
      localStorage.setItem('remembered_password', pass);
      localStorage.setItem('remember_me', 'true');
    } else {
      localStorage.removeItem('remembered_username');
      localStorage.removeItem('remembered_password');
      localStorage.setItem('remember_me', 'false');
    }

    offlineAudio.startRecording(); // Start caching audio
    showToast(`Hoşgeldiniz, ${currentUser.name}`, 'success');
    renderApp();
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.style.display = 'block';
    showToast(error.message, 'error');
    document.querySelector('.login-card').classList.add('shake');
    setTimeout(() => document.querySelector('.login-card').classList.remove('shake'), 500);
    btn.innerHTML = '<i class="ph ph-sign-in"></i> Giriş Yap';
    btn.disabled = false;
  }
}

window.handleLogout = () => {
  api.logout();
  offlineAudio.stopRecording();
  window.radio.stop();
  currentUser = null;
  currentView = 'dashboard';
  renderLogin();
};

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
  const savedUser = localStorage.getItem('remembered_username') || '';
  const savedPass = localStorage.getItem('remembered_password') || '';
  const isRemembered = localStorage.getItem('remember_me') === 'true';

  app.innerHTML = `
    <div class="login-container">
      <div class="glass-panel login-card fade-in">
        <div class="login-logo" style="margin-bottom: 1.5rem; display:flex; justify-content:center;">
          <img src="/logo2.png" alt="Güntaş" style="max-height: 120px; width: auto; visibility: hidden;" onload="window.makeTransparent(this)">
        </div>
        <p style="margin-bottom: 2rem; color: var(--color-secondary); font-weight: 700; letter-spacing: 1px; text-transform: uppercase; font-size: 0.9rem;">Güntaş Audio System</p>
        
        <form id="loginForm">
          <div class="input-group">
            <label for="username">Kullanıcı Adı</label>
            <input type="text" id="username" class="input-field" placeholder="admin" value="${savedUser}" required>
          </div>
          <div class="input-group">
            <label for="password">Şifre</label>
            <input type="password" id="password" class="input-field" placeholder="••••••••" value="${savedPass}" required>
          </div>
          
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; user-select: none;">
            <input type="checkbox" id="rememberMe" style="width: 18px; height: 18px; accent-color: var(--color-primary); cursor: pointer;" ${isRemembered ? 'checked' : ''}>
            <label for="rememberMe" style="margin-bottom: 0; cursor: pointer; font-size: 0.95rem; color: var(--color-secondary); font-weight: 500;">Beni Hatırla</label>
          </div>

          <button type="submit" class="btn btn-teal btn-block" style="margin-top: 0.5rem;">
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
      showToast('Şube başarıyla silindi.', 'success');
      renderApp();
    } catch (e) {
      showToast('Hata: ' + e.message, 'error');
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
    showToast('Şube bilgileri başarıyla kaydedildi.', 'success');
    renderApp();
  } catch (err) {
    showToast('Hata: ' + err.message, 'error');
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
      showToast('Kampanya silindi.', 'success');
      if (currentView === 'branch_ops' && window.selectedBranchId) {
        window.handleBranchSelect(window.selectedBranchId);
      } else {
        renderApp();
      }
    } catch (e) {
      showToast('Hata: ' + e.message, 'error');
    }
  }
};
window.addCampaignForm = async (e) => {
  e.preventDefault();
  const name = document.getElementById('newCampName').value;
  const fileInput = document.getElementById('newCampFile');
  const file = fileInput.files[0];

  if (!file) {
    showToast('Lütfen bir anons ses dosyası seçin!', 'info');
    return;
  }

  try {
    const btn = document.getElementById('addCampBtn');
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Yükleniyor...';
    btn.disabled = true;

    const fileUrl = await api.uploadCampaignFile(file);
    await api.addCampaign({ name, frequency: 'Akış Sırası', file_path: fileUrl });
    
    showToast('Anons başarıyla eklendi.', 'success');
    renderApp();
  } catch (e) {
    showToast('Hata: ' + e.message, 'error');
    document.getElementById('addCampBtn').innerHTML = '<i class="ph ph-plus"></i> Anons Ekle';
    document.getElementById('addCampBtn').disabled = false;
  }
};

window.deleteSong = async (id) => {
  if(confirm('Şarkıyı listeden çıkarmak istediğinize emin misiniz?')) {
    try {
      await api.removeSong(id);
      showToast('Şarkı listeden çıkarıldı.', 'success');
      if (currentView === 'branch_ops' && window.selectedBranchId) {
        window.handleBranchSelect(window.selectedBranchId);
      } else {
        renderApp();
      }
    } catch (e) {
      showToast('Hata: ' + e.message, 'error');
    }
  }
};
window.addSongForm = async (e) => {
  e.preventDefault();
  
  const fileInput = document.getElementById('newSongFile');
  const file = fileInput.files[0];
  
  if (!file) {
    showToast('Lütfen bir MP3 veya ses dosyası seçin!', 'info');
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

    showToast('Müzik başarıyla eklendi.', 'success');
    renderApp();
  } catch (err) {
    showToast('Hata: ' + err.message, 'error');
    document.getElementById('addSongBtn').innerHTML = '<i class="ph ph-upload"></i> Yükle / Ekle';
    document.getElementById('addSongBtn').disabled = false;
  }
};

window._previewPlayer = null;
window.playSong = (url) => {
  if (!url) return showToast('Bu parçanın ses dosyası bulunamadı.', 'error');
  if (window._previewPlayer) { window._previewPlayer.pause(); window._previewPlayer = null; }
  window._previewPlayer = new Audio(url);
  window._previewPlayer.play();
  window._previewPlayer.addEventListener('ended', () => { window._previewPlayer = null; });
  showToast('Önizleme başlatıldı. Durdurmak için ■ butonuna basın.', 'info');
};
window.stopPreview = () => {
  if (window._previewPlayer) { window._previewPlayer.pause(); window._previewPlayer = null; showToast('Önizleme durduruldu.', 'info'); }
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
    showToast('Sıralama kaydedilemedi: ' + e.message, 'error');
  }
};

window.updatePasswordForm = async (e) => {
  e.preventDefault();
  const newPass = document.getElementById('newAdminPass').value;
  const confirmPass = document.getElementById('confirmAdminPass').value;
  
  if (newPass !== confirmPass) {
    alert('Şifreler uyuşmuyor!');
    return;
  }
  
  try {
    const btn = e.target.querySelector('button');
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Güncelleniyor...';
    btn.disabled = true;
    
    await api.updateAdminPassword(newPass);
    
    showToast('Admin şifresi başarıyla güncellendi.', 'success');
    e.target.reset();
  } catch (err) {
    showToast('Hata: ' + err.message, 'error');
  } finally {
    const btn = e.target.querySelector('button');
    btn.innerHTML = '<i class="ph ph-check"></i> Şifreyi Güncelle';
    btn.disabled = false;
  }
};

let currentPlaylistData = [];

async function renderApp() {
  if (currentUser.role === 'branch') {
    try {
      const playlist = await api.fetchPlaylist(currentUser.id);
      const campaigns = await api.fetchCampaigns(currentUser.id);

      const combined = [];
      const pList = [...playlist];
      const cList = [...campaigns];
      let ci = 0;
      for (let i = 0; i < pList.length; i++) {
        combined.push(pList[i]);
        if (cList.length > 0 && ci < cList.length && (i + 1) % Math.max(1, Math.ceil(pList.length / (cList.length + 1))) === 0) {
          combined.push(cList[ci]);
          ci++;
        }
      }
      while (ci < cList.length) { combined.push(cList[ci]); ci++; }

      currentPlaylistData = combined;
      
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
        <div class="sidebar-brand" style="display:flex; justify-content:center; padding: 2rem 0;">
          <img src="/logo2.png" alt="Logo" style="max-height: 120px; width: auto; visibility: hidden;" onload="window.makeTransparent(this)">
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
            <i class="ph ph-broadcast"></i>
            <span>Anons Sistemi</span>
          </a>
          <a href="#" class="nav-item ${currentView === 'branches' ? 'active' : ''}" data-view="branches">
            <i class="ph ph-storefront"></i>
            <span>Şube Yönetimi</span>
          </a>
          <a href="#" class="nav-item ${currentView === 'branch_ops' ? 'active' : ''}" data-view="branch_ops">
            <i class="ph ph-sliders"></i>
            <span>Şube Operasyonları</span>
          </a>
          <a href="#" class="nav-item ${currentView === 'settings' ? 'active' : ''}" data-view="settings">
            <i class="ph ph-gear"></i>
            <span>Ayarlar</span>
          </a>
          ` : ''}
          <a href="#" class="nav-item" id="logoutBtn" style="margin-top: 1rem; color: #F44336;">
            <i class="ph ph-sign-out"></i>
            <span>Çıkış Yap</span>
          </a>
        </ul>
        
        <div class="user-profile" style="flex-direction: column; align-items: flex-start; gap: 0.3rem; background: transparent; border-top: 1px solid var(--color-border); border-radius: 0; padding: 1.5rem 0.5rem;">
          <div style="font-weight: 700; color: var(--color-secondary); font-size: 0.9rem; letter-spacing: 0.5px; white-space: nowrap;">GÜNTAŞ AUDIO SYSTEM</div>
          <div style="font-size: 0.7rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 1px;">Sistem Kurumsal Sürüm</div>
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
    window.handleLogout();
  });

  const mainContent = document.getElementById('mainContent');
  
  try {
    if (currentView === 'dashboard') {
      const [playlist, branches] = await Promise.all([
        api.fetchPlaylist(),
        api.fetchBranches()
      ]);
      currentPlaylistData = playlist;
      mainContent.innerHTML = getDashboardHTML(playlist, branches);
    } else if (currentView === 'music') {
      currentPlaylistData = await api.fetchPlaylist();
      mainContent.innerHTML = getMusicHTML(currentPlaylistData);
    } else if (currentView === 'campaigns') {
      currentCampaignData = await api.fetchCampaigns();
      mainContent.innerHTML = getCampaignsHTML(currentCampaignData);
    } else if (currentView === 'branches' && currentUser.role === 'admin') {
      const branches = await api.fetchBranches();
      mainContent.innerHTML = getBranchesHTML(branches);
    } else if (currentView === 'branch_ops' && currentUser.role === 'admin') {
      const branches = await api.fetchBranches();
      mainContent.innerHTML = getBranchOpsHTML(branches);
    } else if (currentView === 'settings' && currentUser.role === 'admin') {
      mainContent.innerHTML = getSettingsHTML();
    }
  } catch (error) {
    mainContent.innerHTML = `<div class="glass-panel" style="padding: 2rem; text-align:center; color: #F44336;"><i class="ph ph-warning" style="font-size: 3rem;"></i><br>Veri yüklenirken hata oluştu: ${error.message}</div>`;
  }
  
  requestAnimationFrame(() => {
    mainContent.style.opacity = '1';
  });
}

// ================= VIEW TEMPLATES =================

// CAMPAIGN REORDER (for general anons)
let currentCampaignData = [];
window.moveCampaign = async (id, direction) => {
  const idx = currentCampaignData.findIndex(c => c.id === id);
  if (idx < 0) return;
  if (direction === 'up' && idx > 0) {
    [currentCampaignData[idx], currentCampaignData[idx - 1]] = [currentCampaignData[idx - 1], currentCampaignData[idx]];
  } else if (direction === 'down' && idx < currentCampaignData.length - 1) {
    [currentCampaignData[idx], currentCampaignData[idx + 1]] = [currentCampaignData[idx + 1], currentCampaignData[idx]];
  } else return;
  const mainContent = document.getElementById('mainContent');
  mainContent.innerHTML = getCampaignsHTML(currentCampaignData);
};

// BRANCH OPS HELPERS
window.selectedBranchId = null;
window.branchPlaylistData = [];
window.branchCampaignData = [];

window.handleBranchSelect = async (id) => {
  window.selectedBranchId = id;
  const mainContent = document.getElementById('mainContent');
  const branches = await api.fetchBranches();
  if (id) {
    try {
      window.branchPlaylistData = await api.fetchPlaylist(id);
      window.branchCampaignData = await api.fetchCampaigns(id);
    } catch(e) {
      window.branchPlaylistData = [];
      window.branchCampaignData = [];
    }
  }
  mainContent.innerHTML = getBranchOpsHTML(branches);
};

window.moveBranchSong = async (id, direction) => {
  const idx = window.branchPlaylistData.findIndex(s => s.id === id);
  if (idx < 0) return;
  if (direction === 'up' && idx > 0) {
    [window.branchPlaylistData[idx], window.branchPlaylistData[idx - 1]] = [window.branchPlaylistData[idx - 1], window.branchPlaylistData[idx]];
  } else if (direction === 'down' && idx < window.branchPlaylistData.length - 1) {
    [window.branchPlaylistData[idx], window.branchPlaylistData[idx + 1]] = [window.branchPlaylistData[idx + 1], window.branchPlaylistData[idx]];
  } else return;
  const branches = await api.fetchBranches();
  document.getElementById('mainContent').innerHTML = getBranchOpsHTML(branches);
  try { await api.reorderPlaylist(window.branchPlaylistData.map(s => s.id)); } catch(e) { showToast('Sıralama kaydedilemedi: ' + e.message, 'error'); }
};

window.moveBranchCampaign = async (id, direction) => {
  const idx = window.branchCampaignData.findIndex(c => c.id === id);
  if (idx < 0) return;
  if (direction === 'up' && idx > 0) {
    [window.branchCampaignData[idx], window.branchCampaignData[idx - 1]] = [window.branchCampaignData[idx - 1], window.branchCampaignData[idx]];
  } else if (direction === 'down' && idx < window.branchCampaignData.length - 1) {
    [window.branchCampaignData[idx], window.branchCampaignData[idx + 1]] = [window.branchCampaignData[idx + 1], window.branchCampaignData[idx]];
  } else return;
  const branches = await api.fetchBranches();
  document.getElementById('mainContent').innerHTML = getBranchOpsHTML(branches);
};


window.addBranchSongForm = async (e) => {
  e.preventDefault();
  if (!window.selectedBranchId) return showToast('Lütfen önce bir şube seçin!', 'error');
  
  const fileInput = document.getElementById('newBranchSongFile');
  const file = fileInput.files[0];
  if (!file) return showToast('Dosya seçin!', 'error');

  try {
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Yükleniyor...';
    
    const fileUrl = await api.uploadMusicFile(file);
    await api.addSong({ name: file.name.replace(/\.[^/.]+$/, ""), file_path: fileUrl }, window.selectedBranchId);
    
    showToast('Şubeye özel müzik eklendi.', 'success');
    window.handleBranchSelect(window.selectedBranchId);
  } catch (err) {
    showToast('Hata: ' + err.message, 'error');
    e.target.querySelector('button').disabled = false;
  }
};

window.addBranchCampaignForm = async (e) => {
  e.preventDefault();
  if (!window.selectedBranchId) return showToast('Lütfen önce bir şube seçin!', 'error');

  const name = document.getElementById('newBranchCampName').value;
  const fileInput = document.getElementById('newBranchCampFile');
  const file = fileInput.files[0];
  if (!file) return showToast('Dosya seçin!', 'error');

  try {
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Yükleniyor...';
    
    const fileUrl = await api.uploadCampaignFile(file);
    await api.addCampaign({ name, frequency: 'Akış Sırası', file_path: fileUrl }, window.selectedBranchId);
    
    showToast('Şubeye özel kampanya eklendi.', 'success');
    window.handleBranchSelect(window.selectedBranchId);
  } catch (err) {
    showToast('Hata: ' + err.message, 'error');
  }
};

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
        <img src="/logo2.png" alt="Güntaş" style="height: 60px; visibility: hidden;" onload="window.makeTransparent(this)">
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
          <button class="btn" style="background:transparent; border:none; color:white; font-size: 2rem;" onclick="window.radio.playPrev()"><i class="ph ph-skip-back-circle"></i></button>
          
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

function getDashboardHTML(playlist, branches = []) {
  const nextSong = (playlist && playlist.length > 0) ? playlist[0].name : 'Sırada bekleyen parça yok';

  const branchStatusRows = branches.map(b => `
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" class="table-row-hover">
      <td style="padding: 1rem;">
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(0, 229, 255, 0.1); display:flex; align-items:center; justify-content:center; color: var(--color-secondary);">
            <i class="ph ph-storefront"></i>
          </div>
          <div>
            <div style="font-weight:600;">${b.name}</div>
            <div style="font-size:0.75rem; color:var(--color-text-muted);">ID: ${b.id}</div>
          </div>
        </div>
      </td>
      <td style="padding: 1rem;">
        <div style="display:flex; align-items:center; gap:0.5rem; color: ${b.status === 'online' ? '#4CAF50' : '#F44336'}; font-size: 0.9rem; font-weight: 500;">
          <div style="width: 8px; height: 8px; border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor;"></div>
          ${b.status === 'online' ? 'Çevrimiçi' : 'Çevrimdışı'}
        </div>
      </td>
      <td style="padding: 1rem;">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <i class="ph ph-music-note text-teal" style="font-size: 1.1rem;"></i>
          <span style="font-size: 0.9rem;">${b.music || 'Güntaş Radyo'}</span>
        </div>
      </td>
      <td style="padding: 1rem;">
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <div style="flex:1; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; position:relative;">
            <div style="position:absolute; left:0; top:0; bottom:0; width:${b.volume || 50}%; background: var(--color-secondary); border-radius:2px; box-shadow: 0 0 10px var(--color-secondary);"></div>
          </div>
          <span style="font-size: 0.85rem; min-width: 30px;">%${b.volume || 50}</span>
        </div>
      </td>
      <td style="padding: 1rem; text-align:right;">
        <span style="font-size:0.8rem; color:var(--color-text-muted);">${b.sync || '-'}</span>
      </td>
    </tr>
  `).join('');

  return `
    <header class="top-header fade-in-up">
      <div>
        <h1 style="font-size: 2.2rem; margin-bottom: 0.2rem; color: var(--color-secondary); text-transform: uppercase; letter-spacing: 1px;">Hoşgeldiniz, Admin</h1>
        <p style="color: var(--color-secondary); opacity: 0.8; font-weight: 500; font-size: 1.1rem;">Güntaş Audio System Müzik ve Kampanya Yönetim Portalı</p>
      </div>
      <div class="status-badge" style="border-color: ${isOffline ? '#F44336' : 'rgba(0, 229, 255, 0.2)'}; color: ${isOffline ? '#F44336' : 'var(--color-secondary)'}; background: ${isOffline ? 'rgba(244, 67, 54, 0.1)' : 'rgba(0, 229, 255, 0.1)'}">
        <div class="status-dot" style="background: ${isOffline ? '#F44336' : 'var(--color-secondary)'}; box-shadow: 0 0 8px ${isOffline ? '#F44336' : 'var(--color-secondary)'}; animation: ${isOffline ? 'none' : 'pulse 2s infinite'}"></div>
        ${isOffline ? 'Çevrimdışı' : 'Sistem Aktif'}
      </div>
    </header>
    
    <div class="grid-cards fade-in-up" style="animation-delay: 0.1s; margin-top: 2rem; grid-template-columns: 1fr 1fr;">
      <!-- Music Card -->
      <div class="glass-panel dashboard-card hover-lift">
        <div class="card-header">
          <div class="card-title"><i class="ph ph-speaker-hifi text-teal"></i> Yayın Merkezi Durumu</div>
          <span style="font-size: 0.8rem; background: rgba(255,255,255,0.1); padding: 0.2rem 0.6rem; border-radius: 12px;">${isOffline ? 'Offline Hafıza' : 'Canlı Akış'}</span>
        </div>
        <div style="display:flex; align-items:center; gap: 2rem; padding: 1.5rem;">
          <div class="music-disc" style="width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg, var(--color-primary), var(--color-secondary)); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i class="ph ph-broadcast" style="font-size: 2.5rem; color: #fff;"></i>
          </div>
          <div>
            <h3 style="margin-bottom: 0.5rem; color: var(--color-secondary);">Güntaş Audio Radyo</h3>
            <p class="text-muted" style="font-size: 0.9rem;">Yayın Akışı: <span id="nowPlayingTitle" style="color: #fff;">${isOffline ? 'Önbellekten devam ediliyor...' : nextSong}</span></p>
            <div style="margin-top: 1rem; display:flex; gap:0.5rem;">
               <span class="badge" style="background: rgba(76, 175, 80, 0.1); color: #4CAF50; border: 1px solid rgba(76, 175, 80, 0.2);">YAYINDA</span>
               <span class="badge" style="background: rgba(0, 229, 255, 0.1); color: var(--color-secondary); border: 1px solid rgba(0, 229, 255, 0.2);">HD SES</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="glass-panel dashboard-card hover-lift">
        <div class="card-header">
          <div class="card-title"><i class="ph ph-chart-bar text-teal"></i> Şube İstatistikleri</div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: 1rem;">
          <div style="background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.05);">
            <div style="font-size: 2.5rem; font-weight: 700; color: var(--color-secondary);">${branches.length}</div>
            <div style="font-size: 0.8rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 1px;">Toplam Şube</div>
          </div>
          <div style="background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.05);">
            <div style="font-size: 2.5rem; font-weight: 700; color: #4CAF50;">${branches.filter(b => b.status === 'online').length}</div>
            <div style="font-size: 0.8rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 1px;">Çevrimiçi</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Branch Status Table -->
    <div class="glass-panel fade-in-up" style="margin-top: 2rem; padding: 1.5rem; animation-delay: 0.2s;">
      <div class="card-header" style="margin-bottom: 1.5rem;">
        <div class="card-title" style="font-size: 1.3rem;"><i class="ph ph-list-checks text-teal"></i> Şube Canlı Durum Paneli</div>
        <div style="display:flex; gap:0.5rem;">
          <button class="btn" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; background: rgba(0, 229, 255, 0.1); color: var(--color-secondary); border: 1px solid rgba(0, 229, 255, 0.2);" onclick="renderApp()">
            <i class="ph ph-arrows-clockwise"></i> Yenile
          </button>
        </div>
      </div>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="color: var(--color-text-muted); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--color-border);">
              <th style="padding: 1rem;">Şube Bilgisi</th>
              <th style="padding: 1rem;">Durum</th>
              <th style="padding: 1rem;">Yayın Akışı (Dosya)</th>
              <th style="padding: 1rem;">Ses Seviyesi</th>
              <th style="padding: 1rem; text-align:right;">Son Senkron</th>
            </tr>
          </thead>
          <tbody>
            ${branchStatusRows.length > 0 ? branchStatusRows : '<tr><td colspan="5" style="padding: 2rem; text-align:center; color:var(--color-text-muted);">Kayıtlı şube bulunamadı.</td></tr>'}
          </tbody>
        </table>
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
  const campsHtml = campaigns.map((c, index) => `
    <li style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:0.8rem; border-radius:8px; margin-bottom: 0.5rem;">
      <div style="display:flex; align-items:center; gap: 1rem; flex: 1;">
        <div style="display:flex; flex-direction:column; gap:0.2rem;">
          <button class="btn" style="padding: 0.2rem; background: transparent; border:none; color: var(--color-text-muted);" onclick="window.moveCampaign('${c.id}', 'up')" ${index === 0 ? 'disabled' : ''}><i class="ph ph-caret-up"></i></button>
          <button class="btn" style="padding: 0.2rem; background: transparent; border:none; color: var(--color-text-muted);" onclick="window.moveCampaign('${c.id}', 'down')" ${index === campaigns.length - 1 ? 'disabled' : ''}><i class="ph ph-caret-down"></i></button>
        </div>
        <div style="width: 28px; height: 28px; background: rgba(0, 229, 255, 0.15); border-radius: 6px; display:flex; align-items:center; justify-content:center; color: var(--color-secondary); font-weight: 700; font-size: 0.8rem; flex-shrink:0;">${index + 1}</div>
        <div>
          <strong>${c.name}</strong> <span class="badge" style="background: rgba(76, 175, 80, 0.15); color: #4CAF50; border: 1px solid rgba(76, 175, 80, 0.2); font-size: 0.7rem;">Aktif</span><br>
          <span class="text-muted" style="font-size:0.8rem;">
            ${c.file_path ? `<a href="${c.file_path}" target="_blank" style="color:var(--color-secondary);">Dosyayı Gör</a>` : 'Sadece Metin'}
          </span>
        </div>
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
        <h1 style="font-size: 1.8rem; margin-bottom: 0.2rem;"><i class="ph ph-broadcast text-teal" style="margin-right:0.5rem;"></i>E-Ticaret & Bilgilendirme Anons Sistemi</h1>
        <p class="text-muted">Genel radyo akışı içerisine eklenecek e-ticaret kampanyaları ve bilgilendirme anonsu yönetimi</p>
      </div>
    </header>

    <div class="glass-panel fade-in-up" style="padding: 1.5rem; margin-bottom: 2rem; animation-delay: 0.05s; border-left: 4px solid var(--color-secondary);">
      <div style="display:flex; align-items:flex-start; gap: 1rem;">
        <i class="ph ph-info" style="font-size: 1.5rem; color: var(--color-secondary); flex-shrink:0; margin-top:2px;"></i>
        <div>
          <p style="font-size: 0.9rem; color: var(--color-text); margin-bottom: 0.3rem; font-weight: 600;">Akış Sırası Düzeni</p>
          <p style="font-size: 0.85rem; color: var(--color-text-muted);">Aşağıdaki anonslar genel radyo akışı içerisinde sırayla çalınır. Yukarı/aşağı okları ile çalma sırasını düzenleyebilirsiniz. Bu anonslar tüm şubelerde yayınlanır. Şubeye özel kampanyalar için "Şube Operasyonları" sayfasını kullanın.</p>
        </div>
      </div>
    </div>

    <div class="grid-cards fade-in-up" style="animation-delay: 0.1s;">
      <div class="glass-panel dashboard-card">
        <div class="card-header"><div class="card-title"><i class="ph ph-list-numbers text-teal"></i> Anons Akış Sırası (${campaigns.length} anons)</div></div>
        <ul style="list-style:none; padding:0; margin-top:1rem; display:flex; flex-direction:column;">
          ${campsHtml || '<li style="text-align:center; padding: 2rem; color: var(--color-text-muted);"><i class="ph ph-speaker-none" style="font-size: 2rem; display:block; margin-bottom: 0.5rem;"></i>Henüz anons eklenmemiş</li>'}
        </ul>
      </div>

      <div class="glass-panel dashboard-card">
        <div class="card-header"><div class="card-title"><i class="ph ph-plus-circle text-teal"></i> Yeni Anons Ekle</div></div>
        <form onsubmit="window.addCampaignForm(event)" style="margin-top: 1rem;">
          <div class="input-group">
            <label>Anons Adı</label>
            <input type="text" id="newCampName" class="input-field" placeholder="Örn: E-Ticaret Kampanyası, Bilgilendirme Anonsu" required>
          </div>
          <div class="input-group">
            <label>Anons Ses Dosyası (MP3/WAV)</label>
            <input type="file" id="newCampFile" class="input-field" accept="audio/*" required style="padding: 0.5rem;">
          </div>
          <button type="submit" id="addCampBtn" class="btn btn-teal btn-block"><i class="ph ph-plus"></i> Anons Ekle</button>
        </form>
        <p style="margin-top: 1rem; font-size: 0.8rem; color: var(--color-text-muted);">
          <i class="ph ph-info"></i> Eklenen anonslar akış sırasının sonuna eklenir. Sıralamayı sol panelden değiştirebilirsiniz.
        </p>
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

function getSettingsHTML() {
  return `
    <header class="top-header fade-in-up">
      <div>
        <h1 style="font-size: 1.8rem; margin-bottom: 0.2rem;">Ayarlar</h1>
        <p class="text-muted">Sistem ve güvenlik ayarlarını yönetin</p>
      </div>
    </header>
    
    <div class="grid-cards fade-in-up" style="animation-delay: 0.1s; margin-top: 2rem;">
      <div class="glass-panel dashboard-card">
        <div class="card-header">
          <div class="card-title"><i class="ph ph-lock text-teal"></i> Admin Şifresini Değiştir</div>
        </div>
        <form onsubmit="window.updatePasswordForm(event)" style="margin-top: 1.5rem;">
          <div class="input-group">
            <label for="newAdminPass">Yeni Şifre</label>
            <input type="password" id="newAdminPass" class="input-field" placeholder="••••••••" required>
          </div>
          <div class="input-group" style="margin-top: 1rem;">
            <label for="confirmAdminPass">Yeni Şifre (Tekrar)</label>
            <input type="password" id="confirmAdminPass" class="input-field" placeholder="••••••••" required>
          </div>
          <button type="submit" class="btn btn-teal btn-block" style="margin-top: 1.5rem;">
            <i class="ph ph-check"></i> Şifreyi Güncelle
          </button>
        </form>
        <p style="margin-top: 1rem; font-size: 0.8rem; color: var(--color-text-muted);">
          <i class="ph ph-info"></i> Şifre değişikliği hemen aktif olacaktır. Bir sonraki girişte yeni şifrenizi kullanmanız gerekecektir.
        </p>
      </div>

      <div class="glass-panel dashboard-card">
        <div class="card-header">
          <div class="card-title"><i class="ph ph-info text-teal"></i> Sistem Bilgisi</div>
        </div>
        <div style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.8rem;">
          <div style="display: flex; justify-content: space-between;">
            <span class="text-muted">Versiyon:</span>
            <span>v2.1.0-stable</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span class="text-muted">Supabase Durumu:</span>
            <span style="color: #4CAF50;">Bağlı</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span class="text-muted">Son Yedekleme:</span>
            <span>Bugün 04:00</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getBranchOpsHTML(branches) {
  const selectedBranch = branches.find(b => b.id === window.selectedBranchId);
  const playlist = window.branchPlaylistData || [];
  const campaigns = window.branchCampaignData || [];

  const playlistHtml = playlist.map((m, i) => `
    <div style="display:flex; align-items:center; gap: 0.75rem; background:rgba(0,0,0,0.2); padding:0.6rem 0.8rem; border-radius:8px; margin-bottom:0.4rem;">
      <div style="display:flex; flex-direction:column; gap:0.15rem;">
        <button class="btn" style="padding:0.1rem; background:transparent; border:none; color:var(--color-text-muted); font-size:0.85rem;" onclick="window.moveBranchSong('${m.id}','up')" ${i===0?'disabled':''}><i class="ph ph-caret-up"></i></button>
        <button class="btn" style="padding:0.1rem; background:transparent; border:none; color:var(--color-text-muted); font-size:0.85rem;" onclick="window.moveBranchSong('${m.id}','down')" ${i===playlist.length-1?'disabled':''}><i class="ph ph-caret-down"></i></button>
      </div>
      <div style="width:24px; height:24px; background:rgba(0,229,255,0.15); border-radius:5px; display:flex; align-items:center; justify-content:center; color:var(--color-secondary); font-weight:700; font-size:0.75rem; flex-shrink:0;">${i+1}</div>
      <div style="flex:1; font-size:0.9rem;">${m.name}</div>
      <div style="display:flex; gap:0.3rem;">
        ${m.file_path ? `<button class="btn" style="padding:0.2rem 0.4rem; background:rgba(0,229,255,0.15); border:1px solid rgba(0,229,255,0.2); border-radius:6px; color:var(--color-secondary);" onclick="window.playSong('${m.file_path}')"><i class="ph ph-play"></i></button><button class="btn" style="padding:0.2rem 0.4rem; background:rgba(244,67,54,0.12); border:1px solid rgba(244,67,54,0.2); border-radius:6px; color:#F44336;" onclick="window.stopPreview()"><i class="ph ph-stop"></i></button>` : ''}
        <button class="btn" style="padding:0.2rem 0.4rem; background:rgba(244,67,54,0.15); border:1px solid rgba(244,67,54,0.2); border-radius:6px; color:#F44336;" onclick="window.deleteSong('${m.id}')"><i class="ph ph-trash"></i></button>
      </div>
    </div>
  `).join('');

  const campaignHtml = campaigns.map((c, i) => `
    <div style="display:flex; align-items:center; gap: 0.75rem; background:rgba(0,0,0,0.2); padding:0.6rem 0.8rem; border-radius:8px; margin-bottom:0.4rem;">
      <div style="display:flex; flex-direction:column; gap:0.15rem;">
        <button class="btn" style="padding:0.1rem; background:transparent; border:none; color:var(--color-text-muted); font-size:0.85rem;" onclick="window.moveBranchCampaign('${c.id}','up')" ${i===0?'disabled':''}><i class="ph ph-caret-up"></i></button>
        <button class="btn" style="padding:0.1rem; background:transparent; border:none; color:var(--color-text-muted); font-size:0.85rem;" onclick="window.moveBranchCampaign('${c.id}','down')" ${i===campaigns.length-1?'disabled':''}><i class="ph ph-caret-down"></i></button>
      </div>
      <div style="width:24px; height:24px; background:rgba(255,152,0,0.2); border-radius:5px; display:flex; align-items:center; justify-content:center; color:#FF9800; font-weight:700; font-size:0.75rem; flex-shrink:0;">${i+1}</div>
      <div style="flex:1;">
        <div style="font-size:0.9rem; font-weight:600;">${c.name}</div>
        ${c.file_path ? `<a href="${c.file_path}" target="_blank" style="font-size:0.75rem; color:var(--color-secondary);">Dosyayı Gör</a>` : ''}
      </div>
      <div style="display:flex; gap:0.3rem;">
        ${c.file_path ? `<button class="btn" style="padding:0.2rem 0.4rem; background:rgba(0,229,255,0.15); border:1px solid rgba(0,229,255,0.2); border-radius:6px; color:var(--color-secondary);" onclick="window.playSong('${c.file_path}')"><i class="ph ph-play"></i></button><button class="btn" style="padding:0.2rem 0.4rem; background:rgba(244,67,54,0.12); border:1px solid rgba(244,67,54,0.2); border-radius:6px; color:#F44336;" onclick="window.stopPreview()"><i class="ph ph-stop"></i></button>` : ''}
        <button class="btn" style="padding:0.2rem 0.4rem; background:rgba(244,67,54,0.15); border:1px solid rgba(244,67,54,0.2); border-radius:6px; color:#F44336;" onclick="window.deleteCampaign('${c.id}')"><i class="ph ph-trash"></i></button>
      </div>
    </div>
  `).join('');

  return `
    <header class="top-header fade-in-up">
      <div>
        <h1 style="font-size: 1.8rem; margin-bottom: 0.2rem;"><i class="ph ph-sliders text-teal" style="margin-right:0.5rem;"></i>Şube Operasyonları</h1>
        <p class="text-muted">Şubeye özel müzik listesi ve kampanya akışlarını yönetin</p>
      </div>
    </header>

    <div class="glass-panel fade-in-up" style="padding: 1.5rem; margin-bottom: 2rem;">
      <div style="display:flex; align-items:center; gap: 1rem; flex-wrap: wrap;">
        <div style="flex:1; min-width: 250px;">
          <label style="display:block; margin-bottom: 0.5rem; color: var(--color-secondary); font-weight: 600;"><i class="ph ph-storefront"></i> İşlem Yapılacak Şubeyi Seçin</label>
          <select class="input-field" onchange="window.handleBranchSelect(this.value)" style="max-width: 400px; background: rgba(0,0,0,0.3);">
            <option value="">--- Şube Seçin ---</option>
            ${branches.map(b => `<option value="${b.id}" ${b.id === window.selectedBranchId ? 'selected' : ''}>${b.name} (${b.id})</option>`).join('')}
          </select>
        </div>
        ${selectedBranch ? `
        <div style="display:flex; gap: 1.5rem; align-items:center;">
          <div style="text-align:center;">
            <div style="font-size:1.5rem; font-weight:700; color:var(--color-secondary);">${playlist.length}</div>
            <div style="font-size:0.7rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:1px;">Müzik</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:1.5rem; font-weight:700; color:#FF9800;">${campaigns.length}</div>
            <div style="font-size:0.7rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:1px;">Kampanya</div>
          </div>
        </div>` : ''}
      </div>
    </div>

    ${window.selectedBranchId && selectedBranch ? `
    <div class="grid-cards fade-in-up" style="grid-template-columns: 1fr 1fr; animation-delay: 0.1s;">
      
      <!-- Branch Specific Music -->
      <div class="glass-panel dashboard-card">
        <div class="card-header">
          <div class="card-title"><i class="ph ph-music-notes text-teal"></i> ${selectedBranch.name} — Müzik Listesi</div>
          <span style="font-size:0.8rem; background:rgba(0,229,255,0.1); color:var(--color-secondary); padding:0.2rem 0.6rem; border-radius:12px;">${playlist.length} parça</span>
        </div>
        
        <div style="margin-top: 1rem;">
          <form onsubmit="window.addBranchSongForm(event)" style="margin-bottom: 1.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div class="input-group">
              <label><i class="ph ph-upload-simple"></i> Yeni Müzik Ekle</label>
              <input type="file" id="newBranchSongFile" class="input-field" accept="audio/*" required>
            </div>
            <button type="submit" class="btn btn-teal btn-block"><i class="ph ph-plus"></i> Şubeye Özel Müzik Ekle</button>
          </form>
          
          <div id="branchPlaylistArea">
            ${playlist.length > 0 ? playlistHtml : '<div style="text-align:center; padding: 2rem; color: var(--color-text-muted);"><i class="ph ph-music-note" style="font-size: 2rem; display:block; margin-bottom: 0.5rem;"></i>Bu şubeye özel müzik tanımlanmamış.<br><span style="font-size:0.8rem;">Yukarıdan müzik dosyası yükleyerek başlayın.</span></div>'}
          </div>
        </div>
      </div>

      <!-- Branch Specific Campaigns -->
      <div class="glass-panel dashboard-card">
        <div class="card-header">
          <div class="card-title"><i class="ph ph-megaphone" style="color:#FF9800;"></i> ${selectedBranch.name} — Kampanyalar</div>
          <span style="font-size:0.8rem; background:rgba(255,152,0,0.1); color:#FF9800; padding:0.2rem 0.6rem; border-radius:12px;">${campaigns.length} kampanya</span>
        </div>
        
        <div style="margin-top: 1rem;">
          <form onsubmit="window.addBranchCampaignForm(event)" style="margin-bottom: 1.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div class="input-group">
              <label>Kampanya Adı</label>
              <input type="text" id="newBranchCampName" class="input-field" placeholder="Örn: Yaz İndirimi Anonsu" required>
            </div>
            <div class="input-group">
              <label><i class="ph ph-upload-simple"></i> Ses Dosyası</label>
              <input type="file" id="newBranchCampFile" class="input-field" accept="audio/*" required>
            </div>
            <button type="submit" class="btn btn-teal btn-block"><i class="ph ph-plus"></i> Şubeye Özel Kampanya Ekle</button>
          </form>

          <div id="branchCampaignArea">
            ${campaigns.length > 0 ? campaignHtml : '<div style="text-align:center; padding: 2rem; color: var(--color-text-muted);"><i class="ph ph-megaphone" style="font-size: 2rem; display:block; margin-bottom: 0.5rem;"></i>Bu şubeye özel kampanya tanımlanmamış.<br><span style="font-size:0.8rem;">Yukarıdan kampanya dosyası yükleyerek başlayın.</span></div>'}
          </div>
        </div>
      </div>

    </div>

    <!-- Unified Flow List -->
    <div class="glass-panel fade-in-up" style="padding: 1.5rem; margin-top: 2rem; animation-delay: 0.15s;">
      <div class="card-header" style="margin-bottom: 1rem;">
        <div class="card-title" style="font-size:1.2rem;"><i class="ph ph-list-checks text-teal"></i> ${selectedBranch.name} — Yayın Akış Sırası</div>
        <span style="font-size:0.8rem; background:rgba(255,255,255,0.08); padding:0.3rem 0.8rem; border-radius:12px;">${playlist.length + campaigns.length} öğe</span>
      </div>
      <p style="font-size:0.85rem; color:var(--color-text-muted); margin-bottom: 1rem;">Müzik ve kampanyaların birleşik yayın akışı. <span style="color:var(--color-secondary);">Mavi</span> = Müzik, <span style="color:#FF9800;">Turuncu</span> = Kampanya</p>
      <div style="display:flex; flex-direction:column; gap: 0.3rem;">
        ${(() => {
          const combined = [];
          const pList = [...playlist];
          const cList = [...campaigns];
          let ci = 0;
          for (let i = 0; i < pList.length; i++) {
            combined.push({ type: 'music', item: pList[i], index: i });
            if (cList.length > 0 && ci < cList.length && (i + 1) % Math.max(1, Math.ceil(pList.length / (cList.length + 1))) === 0) {
              combined.push({ type: 'campaign', item: cList[ci], index: ci });
              ci++;
            }
          }
          while (ci < cList.length) { combined.push({ type: 'campaign', item: cList[ci], index: ci }); ci++; }
          if (combined.length === 0) return '<div style="text-align:center; padding:2rem; color:var(--color-text-muted);">Henüz öğe eklenmemiş.</div>';
          return combined.map((entry, idx) => {
            const isMusic = entry.type === 'music';
            const color = isMusic ? 'var(--color-secondary)' : '#FF9800';
            const bgColor = isMusic ? 'rgba(0,229,255,0.08)' : 'rgba(255,152,0,0.08)';
            const icon = isMusic ? 'ph-music-note' : 'ph-megaphone';
            const label = isMusic ? 'Müzik' : 'Kampanya';
            const fp = entry.item.file_path || '';
            return `
              <div style="display:flex; align-items:center; gap:0.75rem; background:${bgColor}; padding:0.5rem 0.8rem; border-radius:8px; border-left: 3px solid ${color};">
                <div style="width:26px; height:26px; background:rgba(255,255,255,0.06); border-radius:50%; display:flex; align-items:center; justify-content:center; color:var(--color-text-muted); font-size:0.75rem; font-weight:700; flex-shrink:0;">${idx + 1}</div>
                <i class="ph ${icon}" style="font-size:1.1rem; color:${color}; flex-shrink:0;"></i>
                <div style="flex:1;">
                  <span style="font-size:0.85rem; font-weight:500;">${entry.item.name}</span>
                  <span style="font-size:0.7rem; margin-left:0.5rem; background:${bgColor}; color:${color}; padding:0.1rem 0.4rem; border-radius:4px; border:1px solid ${color}20;">${label}</span>
                </div>
                <div style="display:flex; gap:0.3rem;">
                  ${fp ? `<button class="btn" style="padding:0.15rem 0.35rem; background:rgba(0,229,255,0.12); border:1px solid rgba(0,229,255,0.2); border-radius:5px; color:var(--color-secondary); font-size:0.85rem;" onclick="window.playSong('${fp}')"><i class="ph ph-play"></i></button><button class="btn" style="padding:0.15rem 0.35rem; background:rgba(244,67,54,0.12); border:1px solid rgba(244,67,54,0.2); border-radius:5px; color:#F44336; font-size:0.85rem;" onclick="window.stopPreview()"><i class="ph ph-stop"></i></button>` : ''}
                </div>
              </div>`;
          }).join('');
        })()}
      </div>
    </div>

    <div class="glass-panel fade-in-up" style="padding: 1.5rem; margin-top: 1.5rem; animation-delay: 0.2s; border-left: 4px solid #FF9800;">
      <div style="display:flex; align-items:flex-start; gap: 1rem;">
        <i class="ph ph-info" style="font-size: 1.5rem; color: #FF9800; flex-shrink:0; margin-top:2px;"></i>
        <div>
          <p style="font-size: 0.9rem; color: var(--color-text); margin-bottom: 0.3rem; font-weight: 600;">Akış Düzeni Hakkında</p>
          <p style="font-size: 0.85rem; color: var(--color-text-muted);">Kampanyalar müzik parçaları arasına eşit aralıklarla yerleştirilir. Sıralamayı değiştirmek için yukarıdaki müzik ve kampanya listelerindeki okları kullanın.</p>
        </div>
      </div>
    </div>
    ` : `
    <div class="glass-panel fade-in-up" style="padding: 4rem; text-align:center; color: var(--color-text-muted);">
      <i class="ph ph-arrow-up" style="font-size: 3rem; margin-bottom: 1rem; display:block;"></i>
      <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">Lütfen işlem yapmak istediğiniz şubeyi yukarıdaki listeden seçin.</p>
      <p style="font-size: 0.85rem;">Seçilen şubenin müzik listesini ve kampanya akışını buradan yönetebilirsiniz.</p>
    </div>
    `}
  `;
}

init();
