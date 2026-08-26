const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Drizzle'ın ürettiği .sql migration dosyaları çözümlenebilsin diye.
// Bu satır olmadan uygulama açılışta migration import'unda çöker.
config.resolver.sourceExts.push('sql');

/*
 * admin/ klasörü Metro'nun görüş alanının DIŞINDA kalmalı.
 *
 * Orada ayrı bir Next.js uygulaması ve kendi node_modules'ü var — içinde
 * ikinci bir react ve react-dom kopyası da bulunuyor. Metro proje kökünü
 * tarayıp o kopyaları da bulursa, uygulama iki farklı React örneğiyle
 * çalışır ve "Invalid hook call" hatasıyla çöker. Ayrıca panelin sunucu
 * kodu mobil paketin içine sızmamalı.
 */
const adminDir = path.join(__dirname, 'admin');
const escaped = adminDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = [new RegExp(`^${escaped}[/\\\\].*`)];

module.exports = config;
