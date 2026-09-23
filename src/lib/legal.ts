/**
 * Yasal sayfaların adresleri.
 *
 * Sayfalar ayrı, herkese açık `dincerenes/surucum-yasal` deposundan GitHub
 * Pages'te yayında; kaynak metin `docs/gizlilik-politikasi.md`. Mağazalar
 * politikaya uygulama içinden de bağlantı istiyor (App Store 5.1.1(i)).
 */

import { Linking } from 'react-native';

export const PRIVACY_POLICY_URL = 'https://dincerenes.github.io/surucum-yasal/';
export const ACCOUNT_DELETION_URL = 'https://dincerenes.github.io/surucum-yasal/hesap-silme.html';

export function openPrivacyPolicy(): void {
  void Linking.openURL(PRIVACY_POLICY_URL);
}
