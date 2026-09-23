# E-posta şablonları

Supabase → Authentication → Emails → **Templates** sekmesine yapıştırılır.
Buradaki metin kaynaktır; panelde değişirse burası da güncellenir.

Gönderim: Gmail SMTP, `surucumappdestek@gmail.com`, gönderen adı "Sürücüm"
(Authentication → Emails → SMTP Settings).

`{{ .ConfirmationURL }}` Supabase'in doldurduğu bağlantı; silinmemeli.
Uygulama PKCE kullanıyor: bağlantı önce Supabase'e gider, oradan
`surucum://` ile uygulamaya döner.

---

## Reset password — Şifre sıfırlama

**Subject:**

```
Sürücüm şifreni sıfırla
```

**Body:**

```html
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#0F172A">
  <h2 style="color:#2563EB;margin:0 0 16px">Sürücüm</h2>
  <p>Merhaba,</p>
  <p>Hesabın için şifre sıfırlama isteği aldık. Yeni şifreni belirlemek için bu e-postayı <strong>telefonunda</strong> açıp aşağıdaki düğmeye dokun:</p>
  <p style="margin:24px 0">
    <a href="{{ .ConfirmationURL }}" style="background:#2563EB;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Şifremi sıfırla</a>
  </p>
  <p style="color:#475569;font-size:14px">Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.</p>
  <p style="color:#475569;font-size:14px">Sürücüm · <a href="mailto:surucumappdestek@gmail.com" style="color:#2563EB">surucumappdestek@gmail.com</a></p>
</div>
```

---

## Confirm signup — Kayıt doğrulama

Yalnızca "Confirm email" açıksa gönderilir (şu an kapalı, bkz. README).

**Subject:**

```
Sürücüm hesabını doğrula
```

**Body:**

```html
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#0F172A">
  <h2 style="color:#2563EB;margin:0 0 16px">Sürücüm</h2>
  <p>Hoş geldin!</p>
  <p>Hesabını açmak için e-posta adresini doğrula. Bu e-postayı <strong>telefonunda</strong> açıp aşağıdaki düğmeye dokun:</p>
  <p style="margin:24px 0">
    <a href="{{ .ConfirmationURL }}" style="background:#2563EB;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">E-postamı doğrula</a>
  </p>
  <p style="color:#475569;font-size:14px">Bu hesabı sen açmadıysan bu e-postayı yok sayabilirsin.</p>
  <p style="color:#475569;font-size:14px">Sürücüm · <a href="mailto:surucumappdestek@gmail.com" style="color:#2563EB">surucumappdestek@gmail.com</a></p>
</div>
```

---

## Change email address — E-posta değişikliği

**Subject:**

```
Sürücüm e-posta adresini değiştir
```

**Body:**

```html
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#0F172A">
  <h2 style="color:#2563EB;margin:0 0 16px">Sürücüm</h2>
  <p>Hesabının e-posta adresini <strong>{{ .NewEmail }}</strong> olarak değiştirmek istedin. Onaylamak için dokun:</p>
  <p style="margin:24px 0">
    <a href="{{ .ConfirmationURL }}" style="background:#2563EB;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Değişikliği onayla</a>
  </p>
  <p style="color:#475569;font-size:14px">Bu isteği sen yapmadıysan bu e-postayı yok say ve <a href="mailto:surucumappdestek@gmail.com" style="color:#2563EB">surucumappdestek@gmail.com</a> adresine yaz.</p>
</div>
```
