import { Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { resolveSetupGate } from '@/lib/setup-gate';
import { useDriver } from '@/lib/use-driver';
import { syncNow } from '@/sync/scheduler';
import { useSync } from '@/sync/use-sync';
import { space, useTheme } from '@/theme/use-theme';

/**
 * Oturum bekçisi ve modal yığını.
 *
 * Sekmeler kendi grubunda (`(sekmeler)`); sefer ekleme, gider, yakıt ve
 * vardiya bitirme sihirbazı BU yığında duruyor. Sekme dizinine konsalardı
 * expo-router her birini ayrı bir sekme yapardı.
 */
export default function AppLayout() {
  const { session, restoring, cloudAvailable } = useAuth();
  const { colors } = useTheme();

  /** Senkron zamanlayıcısı oturum açıkken çalışır, çıkışta ya da hesap değişince durur. */
  const sync = useSync(session?.user.id ?? null);

  const { needsSetup } = useDriver();
  const [skipWait, setSkipWait] = useState(false);
  const gate = resolveSetupGate({
    hasVehicle: !needsSetup,
    syncedOnce: sync.lastSuccessAt != null,
    syncFailed: sync.lastError != null,
    skipWait,
  });

  if (restoring) {
    return (
      <View style={{
        flex: 1, alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.background,
      }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  /**
   * Bulut yapılandırılmamışsa AÇIKÇA SÖYLENİYOR.
   *
   * Eskiden bu durumda sessizce devam ediliyor ve "yerel mod" olduğu
   * varsayılıyordu. Ama yerel modda kullanıcı kimliği ÜRETİLMİYOR:
   * `user` null kalıyor, her repo çağrısı hiçbir şey yapmıyor ve
   * kurulum hiç tamamlanamadığı için uygulama araç ekleme ekranında
   * sonsuza kadar kilitleniyordu. Sürücü ne olduğunu anlayamıyordu.
   *
   * Bu bir YAPILANDIRMA hatasıdır ve yalnızca ortam değişkenleri eksik
   * derlenmiş bir yapıda görülür; son kullanıcı bunu görmez. Yine de
   * sessiz kilitlenmektense ne olduğunu söylemek gerekiyor.
   *
   * (Kural 4 ihlal edilmiyor: arayüz hâlâ hiçbir ağ çağrısı beklemiyor.
   * Bulut yalnızca İLK GİRİŞ için gerekli; oturum açıldıktan sonra
   * uygulamanın tamamı çevrimdışı çalışıyor.)
   */
  if (!cloudAvailable) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          Uygulama yapılandırılmamış
        </Text>
        <Text style={[styles.body, { color: colors.textSoft }]}>
          Bulut adresi ve anahtarı bu yapıya girilmemiş, bu yüzden hesap
          açılamıyor. Bu bir kurulum hatası — uygulamayı derleyen kişinin
          düzeltmesi gerekiyor.
        </Text>
        <Text style={[styles.hint, { color: colors.textFaint }]}>
          EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        </Text>
      </View>
    );
  }

  if (!session) return <Redirect href="/giris" />;

  /**
   * Araç yoksa uygulama kullanılamaz: vardiya bir araca bağlanıyor,
   * yıpranma payı ondan geliyor. Kurulum atlanabilir bir adım değil.
   *
   * Ama "cihazda araç yok" ≠ "hesapta araç yok": önce bulut soruluyor
   * (bkz. `lib/setup-gate.ts`). Sormadan kuruluma atmak her yeni
   * kurulumda aynı aracı bir kez daha açtırıyordu.
   */
  if (gate === 'setup') return <Redirect href="/arac" />;

  if (gate === 'waiting' || gate === 'sync_failed') {
    const failed = gate === 'sync_failed';
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        {failed ? null : <ActivityIndicator color={colors.accent} />}
        <Text style={[styles.title, { color: colors.text }]}>
          {failed ? 'Kayıtların indirilemedi' : 'Hesabın hazırlanıyor'}
        </Text>
        <Text style={[styles.body, { color: colors.textSoft }]}>
          {failed
            ? 'İnternet bağlantını kontrol edip tekrar dene. Daha önce araç eklediysen buluttan gelmesini beklemek, aynı aracı yeniden eklemekten iyidir.'
            : 'Araçların ve kayıtların buluttan indiriliyor. Bu birkaç saniye sürer.'}
        </Text>
        {failed ? (
          <View style={styles.actions}>
            <Button label="Tekrar dene" onPress={syncNow} />
            <Button
              label="Yeni hesabım, kuruluma geç"
              variant="ghost"
              onPress={() => setSkipWait(true)}
            />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(sekmeler)" />
      <Stack.Screen name="sefer" options={{ presentation: 'modal' }} />
      <Stack.Screen name="gider" options={{ presentation: 'modal' }} />
      <Stack.Screen name="yakit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="kayit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="vardiya" options={{ presentation: 'modal' }} />
      <Stack.Screen name="hedef" />
      <Stack.Screen name="profil-duzenle" />
      <Stack.Screen name="sss" />
      <Stack.Screen name="geri-bildirim" />
      <Stack.Screen name="araclar" />
      <Stack.Screen name="arsiv" />
      <Stack.Screen name="arsiv-ay" />
      <Stack.Screen name="arac-duzenle" />
      <Stack.Screen
        name="vardiya-bitir"
        options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xxl,
    gap: space.md,
  },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 16, textAlign: 'center', lineHeight: 22 },
  hint: { fontSize: 12, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.lg },
});
