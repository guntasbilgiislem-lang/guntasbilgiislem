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

    if (username === 'admin' && password === 'admin') {
      const user = { id: 'admin', name: 'Merkez Yönetim', role: 'admin' };
      this.setToken('mock_jwt_admin_' + Date.now(), user);
      return user;
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

  // --- BRANCHES ---
  async fetchBranches() {
    const { data, error } = await supabase.from('branches').select('*').order('id', { ascending: true });
    if (error) throw new Error('Şubeler getirilemedi: ' + error.message);
    return data;
  }

  async addBranch(branch) {
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

  async removeBranch(id) {
    const { error } = await supabase.from('branches').delete().eq('id', id);
    if (error) throw new Error('Şube silinemedi: ' + error.message);
  }

  // --- CAMPAIGNS ---
  async fetchCampaigns() {
    const { data, error } = await supabase.from('campaigns').select('*');
    if (error) throw new Error('Kampanyalar getirilemedi: ' + error.message);
    return data;
  }

  async addCampaign(campaign) {
    const { error } = await supabase.from('campaigns').insert([{
      id: 'c' + Date.now(),
      name: campaign.name,
      frequency: campaign.frequency,
      status: 'active',
      file_path: campaign.file_path
    }]);
    if (error) throw new Error('Kampanya eklenemedi: ' + error.message);
  }

  async removeCampaign(id) {
    const { error } = await supabase.from('campaigns').delete().eq('id', id);
    if (error) throw new Error('Kampanya silinemedi: ' + error.message);
  }

  // --- PLAYLIST (MUSIC) ---
  async fetchPlaylist() {
    let { data, error } = await supabase.from('playlist').select('*').order('order_index', { ascending: true });
    
    // Eğer herhangi bir sebepten (sütun olmaması vs.) hata verirse, sırasız çekmeyi dene.
    if (error) {
      const res = await supabase.from('playlist').select('*');
      data = res.data;
      error = res.error;
    }
    
    if (error) throw new Error('Müzik listesi getirilemedi: ' + error.message);
    return data || [];
  }

  async addSong(song) {
    // Determine max order_index
    const playlist = await this.fetchPlaylist();
    const maxOrder = playlist.length > 0 ? Math.max(...playlist.map(p => p.order_index || 0)) : 0;

    const { error } = await supabase.from('playlist').insert([{
      id: 'm' + Date.now(),
      name: song.name,
      duration: song.duration || 'Bilinmiyor',
      file_path: song.file_path,
      order_index: maxOrder + 1
    }]);
    if (error) throw new Error('Şarkı eklenemedi: ' + error.message);
  }

  async removeSong(id) {
    const { error } = await supabase.from('playlist').delete().eq('id', id);
    if (error) throw new Error('Şarkı silinemedi: ' + error.message);
  }

  async reorderPlaylist(orderedIds) {
    // Update each item with its new order_index
    const promises = orderedIds.map((id, index) => 
      supabase.from('playlist').update({ order_index: index }).eq('id', id)
    );
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
