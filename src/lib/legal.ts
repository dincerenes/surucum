/**
 * Yasal sayfalar ve kullanım koşulları onayı.
 *
 * Sayfalar ayrı, herkese açık `dincerenes/surucum-yasal` deposundan GitHub
 * Pages'te yayında; kaynak metinler `docs/` altında, site
 * `tools/yasal-site.py` ile üretiliyor. Mağazalar politikaya uygulama
 * içinden de bağlantı istiyor (App Store 5.1.1(i)).
 */

import { Linking } from 'react-native';

const SITE = 'https://dincerenes.github.io/surucum-yasal/';

export const PRIVACY_POLICY_URL = SITE;
export const KVKK_URL = `${SITE}kvkk.html`;
export const TERMS_URL = `${SITE}kullanim-kosullari.html`;
export const ACCOUNT_DELETION_URL = `${SITE}hesap-silme.html`;

/**
 * Kayıtta kabul edilen kullanım koşullarının sürümü. Metin
 * (`docs/kullanim-kosullari.md`) önemli ölçüde değişince artırılır; kimin
 * hangi sürümü ne zaman kabul ettiği hesabın metadata'sında duruyor.
 */
export const TERMS_VERSION = 1;

export function openLegalPage(url: string): void {
  void Linking.openURL(url);
}

/** Kayıtta hesabın metadata'sına yazılan onay kaydı. */
export function termsAcceptance(now: Date = new Date()) {
  return { terms_version: TERMS_VERSION, terms_accepted_at: now.toISOString() };
}
