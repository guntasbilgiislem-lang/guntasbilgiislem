import { supabase } from './supabase.js';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('auth_token') || null;
    this.currentUser = JSON.parse(localStorage.getItem('current_user')) || null;
  }

  setToken(token, user) {
    this.token = token;
    this.currentUser = user;
    localStorage.setItem('auth_token', token);
    localStorage.setItem('current_user', JSON.stringify(user));
  }

  logout() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
  }

  async login(username, password) {
    username = username ? username.trim() : '';
    password = password ? password.trim() : '';

    if (!username || !password || username.includes(';') || password.includes('=')) {
       throw new Error('Geçersiz karakterler veya boş alan.');
    }

    // Admin girişi (Branches tablosundaki 'admin' ID'li satırı kontrol et)
    if (username === 'admin') {
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .eq('id', 'admin')
          .eq('password', password)
          .maybeSingle();
        
        if (!error && data) {
          const user = { id: 'admin', name: 'Admin', role: 'admin' };
          this.setToken('mock_jwt_admin_' + Date.now(), user);
          return user;
        }
      } catch (e) {
        console.warn('Admin kaydı sorgulanamadı, fallback kullanılıyor.');
      }

      // Fallback (eğer tablo yoksa veya henüz şifre değişmemişse)
      if (password === 'admin') {
        const user = { id: 'admin', name: 'Admin', role: 'admin' };
        this.setToken('mock_jwt_admin_' + Date.now(), user);
        return user;
      }
      
      throw new Error('Hatalı admin şifresi.');
    }

    // Supabase'den şubeyi sorgula
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('id', username)
      .eq('password', password)
      .single();

    if (error || !data) {
      throw new Error('Hatalı kullanıcı adı veya şifre.');
    }

    const user = { id: data.id, name: data.name, role: 'branch' };
    this.setToken('mock_jwt_branch_' + username + '_' + Date.now(), user);
    return user;
  }

  async updateAdminPassword(newPassword) {
    // Admin bilgisini branches tablosunda sakla
    const { error } = await supabase
      .from('branches')
      .upsert({ 
        id: 'admin', 
        password: newPassword, 
        name: 'Admin',
        status: 'online',
        music: 'Sistem',
        sync: 'Aktif'
      });
    
    if (error) throw new Error('Şifre güncellenemedi: ' + error.message);
  }

  // --- BRANCHES ---
  async fetchBranches() {
    // Admin satırını gizle
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .neq('id', 'admin')
      .order('id', { ascending: true });
    if (error) throw new Error('Şubeler getirilemedi: ' + error.message);
    return data;
  }

  async addBranch(branch) {
    if (branch.id === 'admin') throw new Error('Bu kullanıcı adı sistem tarafından ayrılmıştır.');

    const { error } = await supabase.from('branches').insert([{
      id: branch.id,
      name: branch.name,
      password: branch.password,
      status: 'offline',
      music: 'Güntaş Radyo',
      sync: '-',
      volume: 50
    }]);
    if (error) throw new Error('Şube eklenemedi: ' + error.message);
  }

  async updateBranch(oldId, newId, newPassword, newName) {
    const updateData = {};
    if (newId) updateData.id = newId;
    if (newPassword) updateData.password = newPassword;
    if (newName) updateData.name = newName;

    const { error } = await supabase.from('branches').update(updateData).eq('id', oldId);
    if (error) throw new Error('Şube güncellenemedi: ' + error.message);
  }

  async updateBranchStatus(id, musicName, isOffline = false) {
    const { error } = await supabase.from('branches').update({
      status: isOffline ? 'offline' : 'online',
      sync: new Date().toISOString(),
      music: musicName || 'Güntaş Radyo'
    }).eq('id', id);
    if (error) console.warn('Durum güncellenemedi:', error);
  }

  async removeBranch(id) {
    const { error } = await supabase.from('branches').delete().eq('id', id);
    if (error) throw new Error('Şube silinemedi: ' + error.message);
  }

  // --- CAMPAIGNS ---
  async fetchCampaigns(branchId = null) {
    try {
      let query = supabase.from('campaigns').select('*');
      if (branchId) {
        query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
      } else {
        query = query.is('branch_id', null);
      }
      const { data, error } = await query;
      
      // If column doesn't exist, fallback to global
      if (error && error.message.includes('branch_id')) {
        const globalRes = await supabase.from('campaigns').select('*');
        if (globalRes.error) throw globalRes.error;
        return globalRes.data;
      }
      
      if (error) throw error;
      return data;
    } catch (err) {
      throw new Error('Kampanyalar getirilemedi: ' + err.message);
    }
  }

  async addCampaign(campaign, branchId = null) {
    const { error } = await supabase.from('campaigns').insert([{
      id: 'c' + Date.now(),
      name: campaign.name,
      frequency: campaign.frequency,
      status: 'active',
      file_path: campaign.file_path,
      branch_id: branchId
    }]);
    if (error) throw new Error('Kampanya eklenemedi: ' + error.message);
  }

  async removeCampaign(id) {
    const { error } = await supabase.from('campaigns').delete().eq('id', id);
    if (error) throw new Error('Kampanya silinemedi: ' + error.message);
  }

  // --- PLAYLIST (MUSIC) ---
  async fetchAllPlaylists() {
    try {
      const { data, error } = await supabase.from('playlist').select('*').order('order_index', { ascending: true });
      if (error && error.message.includes('order_index')) {
        const { data: d2, error: e2 } = await supabase.from('playlist').select('*');
        if (e2) throw e2;
        return d2 || [];
      }
      if (error) throw error;
      return data || [];
    } catch (err) {
      throw new Error('Tüm müzik listeleri getirilemedi: ' + err.message);
    }
  }

  async fetchPlaylist(branchId = null) {
    try {
      let query = supabase.from('playlist').select('*');
      
      if (branchId) {
        query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
      } else {
        query = query.is('branch_id', null);
      }

      let { data, error } = await query.order('order_index', { ascending: true });
      
      if (error && (error.message.includes('branch_id') || error.message.includes('order_index'))) {
        const globalRes = await supabase.from('playlist').select('*');
        if (globalRes.error) throw globalRes.error;
        return globalRes.data || [];
      }
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      throw new Error('Müzik listesi getirilemedi: ' + err.message);
    }
  }

  async addSong(song, branchId = null) {
    // Determine max order_index for this branch/global
    const playlist = await this.fetchPlaylist(branchId);
    const maxOrder = playlist.length > 0 ? Math.max(...playlist.map(p => p.order_index || 0)) : 0;

    const { error } = await supabase.from('playlist').insert([{
      id: 'm' + Date.now(),
      name: song.name,
      duration: song.duration || 'Bilinmiyor',
      file_path: song.file_path,
      order_index: maxOrder + 1,
      branch_id: branchId
    }]);
    if (error) throw new Error('Şarkı eklenemedi: ' + error.message);
  }

  async removeSong(id) {
    const { error } = await supabase.from('playlist').delete().eq('id', id);
    if (error) throw new Error('Şarkı silinemedi: ' + error.message);
  }

  async reorderPlaylist(orderedIds) {
    const promises = orderedIds.map((id, index) => 
      supabase.from('playlist').update({ order_index: index }).eq('id', id)
    );
    await Promise.all(promises);
  }

  async saveUnifiedOrder(combinedList) {
    const promises = combinedList.map((item, index) => {
      if (item.type === 'music') {
        return supabase.from('playlist').update({ order_index: index }).eq('id', item.id);
      } else if (item.type === 'campaign') {
        return supabase.from('campaigns').update({ frequency: String(index) }).eq('id', item.id);
      }
    });
    await Promise.all(promises);
  }

  // --- STORAGE ---
  async uploadMusicFile(file) {
    // Türkçe ve özel karakterleri temizle
    const cleanName = file.name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Aksanları kaldır
      .replace(/ı/g, "i").replace(/ğ/g, "g") 
      .replace(/[^a-zA-Z0-9.\-_]/g, '_'); 

    const fileName = `${Date.now()}_${cleanName}`;
    const { data, error } = await supabase.storage
      .from('music')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (error) throw new Error('Dosya yüklenemedi: ' + error.message);
    const { data: urlData } = supabase.storage.from('music').getPublicUrl(fileName);
    return urlData.publicUrl;
  }

  async uploadCampaignFile(file) {
    const cleanName = file.name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i").replace(/ğ/g, "g")
      .replace(/[^a-zA-Z0-9.\-_]/g, '_');

    const fileName = `${Date.now()}_${cleanName}`;
    const { data, error } = await supabase.storage
      .from('campaigns')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (error) throw new Error('Kampanya sesi yüklenemedi: ' + error.message);
    const { data: urlData } = supabase.storage.from('campaigns').getPublicUrl(fileName);
    return urlData.publicUrl;
  }

  async sendLog(message, type = 'info') {
    if (!this.token) return;
    console.log(`[LOG] Sent: [${type}] ${message}`);
  }
}

export const api = new ApiService();
