// Offline Audio Manager (Simulated 1-hour memory)
class OfflineAudioManager {
  constructor() {
    this.dbName = 'guntas_audio_cache';
    this.storeName = 'chunks';
    this.maxChunks = 60; // Simulate 1 chunk per minute = 1 hour
    this.isRecording = false;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject('IndexedDB başlatılamadı');
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  startRecording() {
    if (this.isRecording) return;
    this.isRecording = true;
    console.log('[OfflineAudio] Kayıt başladı. Son 1 saat hafızada tutulacak.');
    
    // Simulate receiving audio chunks every minute
    this.recordingInterval = setInterval(() => {
      this.saveChunk(new Blob(['simulated-audio-data'], { type: 'audio/mp3' }));
    }, 60000); 
  }

  stopRecording() {
    this.isRecording = false;
    clearInterval(this.recordingInterval);
    console.log('[OfflineAudio] Kayıt durduruldu.');
  }

  async saveChunk(blob) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      
      // Add new chunk
      store.add({ data: blob, timestamp: Date.now() });

      // Enforce 1-hour limit (keep last maxChunks)
      const countReq = store.count();
      countReq.onsuccess = () => {
        if (countReq.result > this.maxChunks) {
          // Delete oldest
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              store.delete(cursor.primaryKey);
            }
          };
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject('Kayıt hatası');
    });
  }

  async playOfflineCache() {
    console.log('[OfflineAudio] İnternet kesildi. Hafızadaki son 1 saatlik yayın çalınacak.');
    // Logic to retrieve and play blobs from DB using URL.createObjectURL()
  }
}

export const offlineAudio = new OfflineAudioManager();
