-- Supabase SQL Editor için Tablo Kurulum Scripti
-- Bu kodu Supabase panelindeki "SQL Editor" bölümüne yapıştırıp "Run" diyerek çalıştırın.

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  status TEXT DEFAULT 'offline',
  music TEXT DEFAULT 'Güntaş Radyo',
  sync TEXT DEFAULT '-',
  volume INT DEFAULT 50
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'audio',
  frequency TEXT,
  status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS playlist (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  duration TEXT DEFAULT '3:00',
  file_path TEXT
);

-- İlk kurulum için deneme verileri ekleyelim
INSERT INTO branches (id, name, password, status, music, sync, volume) VALUES 
('gun001', 'Trabzon Meydan', 'meydan001', 'online', 'Güntaş Radyo', 'Az önce', 75),
('gun002', 'Akçaabat', 'akcaabat002', 'online', 'Özel Liste', '5 dk önce', 60);

INSERT INTO campaigns (id, name, type, frequency, status) VALUES 
('c1', 'Hafta Sonu İndirimi', 'audio', '30 Dakikada bir', 'active');

INSERT INTO playlist (id, name, duration) VALUES 
('m1', 'Sezen Aksu - Gülümse', '4:30'),
('m2', 'Tarkan - Yolla', '3:45');
