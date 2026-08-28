/**
 * Araç markaları ve modelleri — kurulumda listeden seçmek için.
 *
 * KAPSAM: Türkiye'de ticari amaçla en sık kullanılan binek araçlar.
 * Eksiksiz bir tescil kaydı değil, KOLAYLIK listesi. Listede olmayan
 * araç için her iki alanda da serbest giriş var; hiçbir sürücü listeye
 * takılıp kurulumu bırakamamalı.
 *
 * NOT — buradaki marka adları OTOMOBİL ÜRETİCİLERİ. Marka adı yasağı
 * sürücünün üzerinden çalıştığı platformlar içindir; aracın markası
 * ürünün kendi verisi ve raporlarda araca göre karşılaştırma yapmanın
 * tek yolu.
 *
 * Modeller alfabetik değil, YAYGINLIK sırasında: sürücü aradığını
 * çoğu zaman ilk üç satırda buluyor ve aramaya hiç gerek kalmıyor.
 */

export const OTHER_OPTION = 'Diğer';

const CATALOG: Readonly<Record<string, readonly string[]>> = {
  Renault: ['Symbol', 'Clio', 'Megane', 'Fluence', 'Taliant', 'Captur', 'Kangoo', 'Talisman'],
  Fiat: ['Egea', 'Egea Cross', 'Linea', 'Doblo', 'Fiorino', 'Punto', 'Albea'],
  Volkswagen: ['Passat', 'Golf', 'Polo', 'Jetta', 'Caddy', 'Transporter', 'T-Roc'],
  Toyota: ['Corolla', 'Corolla Cross', 'Yaris', 'C-HR', 'Auris', 'Avensis'],
  Hyundai: ['i20', 'i10', 'Accent Blue', 'Elantra', 'Bayon', 'Tucson'],
  Ford: ['Focus', 'Fiesta', 'Mondeo', 'Courier', 'Connect', 'Custom', 'Puma'],
  Honda: ['Civic', 'City', 'Jazz', 'CR-V', 'HR-V'],
  Opel: ['Astra', 'Corsa', 'Insignia', 'Combo', 'Grandland'],
  Peugeot: ['301', '208', '308', '2008', '3008', 'Partner'],
  Citroen: ['C-Elysee', 'C3', 'C4', 'Berlingo'],
  Dacia: ['Sandero', 'Duster', 'Logan', 'Jogger', 'Lodgy'],
  Skoda: ['Octavia', 'Superb', 'Fabia', 'Scala', 'Kamiq'],
  Nissan: ['Qashqai', 'Micra', 'Juke', 'Note'],
  Kia: ['Cerato', 'Rio', 'Sportage', 'Ceed', 'Stonic'],
  Seat: ['Leon', 'Ibiza', 'Toledo', 'Arona'],
  Mercedes: ['C Serisi', 'E Serisi', 'Vito', 'Sprinter', 'A Serisi'],
  BMW: ['3 Serisi', '5 Serisi', '1 Serisi', '2 Serisi Tourer'],
  Audi: ['A3', 'A4', 'A6', 'Q3'],
  Chevrolet: ['Aveo', 'Cruze', 'Lacetti'],
  Mitsubishi: ['Lancer', 'ASX', 'Space Star'],
  Suzuki: ['Swift', 'Vitara', 'SX4'],
  Volvo: ['S60', 'V40', 'XC40'],
  Togg: ['T10X', 'T10F'],
  Tesla: ['Model 3', 'Model Y'],
  MG: ['MG4', 'ZS', 'MG5'],
  Chery: ['Tiggo 7', 'Tiggo 8', 'Omoda 5'],
  BYD: ['Seal', 'Atto 3', 'Dolphin'],
};

/** Markalar — yaygınlık sırasında, sonda "Diğer". */
export const VEHICLE_MAKES: readonly string[] = [...Object.keys(CATALOG), OTHER_OPTION];

/** Seçilen markanın modelleri. Bilinmeyen markada yalnızca "Diğer". */
export function modelsFor(make: string | null): readonly string[] {
  if (!make) return [];
  const models = CATALOG[make];
  return models ? [...models, OTHER_OPTION] : [OTHER_OPTION];
}

/**
 * Model yılı listesi — yeniden eskiye.
 *
 * Bugünün yılından bir sonrasıyla başlıyor: model yılları takvim yılından
 * önce çıkıyor ve sıfır araç alan sürücü kendi aracını listede bulamazdı.
 */
export function modelYears(now: Date = new Date()): readonly string[] {
  const newest = now.getFullYear() + 1;
  const oldest = 1998;
  const years: string[] = [];
  for (let y = newest; y >= oldest; y--) years.push(String(y));
  return years;
}
