import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Notice } from '@/components/ui/notice';
import { TextLink } from '@/components/ui/text-link';
import { useAuth } from '@/lib/auth/auth-context';
import { openPrivacyPolicy } from '@/lib/legal';
import { MIN_PASSWORD_LENGTH, validateEmail, validatePassword } from '@/lib/auth/auth-errors';
import { MAX_DISPLAY_NAME } from '@/lib/profile';
import { space, type as typeScale, useTheme } from '@/theme/use-theme';

export default function KayitScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const e = validateEmail(email);
    const p = validatePassword(password);
    const c = password !== confirm ? 'Şifreler birbiriyle uyuşmuyor.' : null;

    setEmailError(e);
    setPasswordError(p);
    setConfirmError(c);
    setFormError(null);
    if (e || p || c) return;

    setBusy(true);
    const result = await signUp(email, password, name);
    setBusy(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    if (result.needsEmailConfirmation) {
      setAwaitingConfirmation(true);
      return;
    }
    router.replace('/');
  }

  if (awaitingConfirmation) {
    return (
      <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xxxl }]}>
        <Text style={[typeScale.title, { color: colors.text }]}>E-postanı doğrula</Text>
        <Notice tone="success">
          {`${email.trim()} adresine bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladıktan sonra giriş yapabilirsin.`}
        </Notice>
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>
          E-posta gelmediyse istenmeyen klasörünü kontrol et.
        </Text>
        <Button label="Giriş ekranına dön" variant="secondary" onPress={() => router.replace('/giris')} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[typeScale.display, { color: colors.text }]}>Hesap oluştur</Text>
          <Text style={[typeScale.body, { color: colors.textSoft }]}>
            Kayıtların cihazında tutulur; hesap yalnızca yedekleme ve cihaz
            değiştirme için gerekli.
          </Text>
        </View>

        {formError ? <Notice tone="error">{formError}</Notice> : null}

        <View style={styles.form}>
          {/* İsteğe bağlı: Anasayfa'daki selamlama için. Boş geçen adsız selamlanır. */}
          <Field
            label="Adın"
            value={name}
            onChangeText={setName}
            placeholder="Örn. Enes"
            hint="Anasayfada seni adınla selamlarız. İstersen boş bırak."
            autoComplete="name"
            textContentType="givenName"
            autoCapitalize="words"
            maxLength={MAX_DISPLAY_NAME}
            editable={!busy}
          />

          <Field
            label="E-posta"
            value={email}
            onChangeText={(v) => { setEmail(v); setEmailError(null); }}
            placeholder="ornek@eposta.com"
            error={emailError}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            editable={!busy}
          />

          <Field
            label="Şifre"
            value={password}
            onChangeText={(v) => { setPassword(v); setPasswordError(null); }}
            placeholder="Şifre oluştur"
            error={passwordError}
            hint={`En az ${MIN_PASSWORD_LENGTH} karakter`}
            secure
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!busy}
          />

          <Field
            label="Şifre tekrar"
            value={confirm}
            onChangeText={(v) => { setConfirm(v); setConfirmError(null); }}
            placeholder="Şifreni tekrar gir"
            error={confirmError}
            secure
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={submit}
            editable={!busy}
          />

          <Button label="Hesap oluştur" onPress={submit} loading={busy} />
          <Text style={[typeScale.caption, styles.legal, { color: colors.textFaint }]}>
            {'Verilerinin nasıl işlendiğini '}
            <Text
              onPress={openPrivacyPolicy}
              accessibilityRole="link"
              style={{ color: colors.accent, fontWeight: '600' }}
            >
              Gizlilik Politikası
            </Text>
            {'\'nda okuyabilirsin.'}
          </Text>
        </View>

        <View style={styles.signupRow}>
          <Text style={{ color: colors.textSoft }}>Zaten hesabın var mı?</Text>
          <TextLink label="Giriş yap" href="/giris" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.xl },
  header: { gap: space.sm },
  form: { gap: space.lg },
  legal: { textAlign: 'center' },
  signupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
