"""
Sürücüm uygulama ikonlarını üretir — bağımlılıksız, saf Python.

Makinede rsvg/ImageMagick/Pillow yok; PNG'yi elle kodluyoruz (zlib + struct
standart kütüphanede). Kenar yumuşatma analitik: her piksel için şeklin
işaretli uzaklığı hesaplanıp kapsama oranına çevriliyor, süperörnekleme yok.

MOTİF — üç azalan çubuk. Ürünün tezi bu: ciro, cebe kalan, gerçek kâr.
Sürücü ciroyu görüp kazandığını sanıyor; her satırda biraz daha eriyor.
Soyut bir sembol değil, uygulamanın ne yaptığının kendisi.

Marka adı yasağı (kural 1) gereği hiçbir üçüncü taraf işaretine benzemiyor;
renkler uygulamanın kendi paletinden (`src/theme/tokens.ts`).
"""

import struct
import zlib

# src/theme/tokens.ts — açık tema vurgu rengi ve yüzeyi.
ACCENT = (0x0E, 0x5A, 0x63)
ACCENT_TEXT = (0xFF, 0xFF, 0xFF)
ACCENT_SOFT = (0xDC, 0xED, 0xEF)


def rounded_rect_sdf(px, py, cx, cy, hw, hh, r):
    """Yuvarlatılmış dikdörtgenin işaretli uzaklığı. İçeride negatif."""
    qx = abs(px - cx) - (hw - r)
    qy = abs(py - cy) - (hh - r)
    ox = qx if qx > 0 else 0.0
    oy = qy if qy > 0 else 0.0
    outside = (ox * ox + oy * oy) ** 0.5
    inside = min(max(qx, qy), 0.0)
    return outside + inside - r


def blend(dst, idx, color, alpha):
    if alpha <= 0:
        return
    if alpha >= 1:
        dst[idx] = color[0]
        dst[idx + 1] = color[1]
        dst[idx + 2] = color[2]
        return
    inv = 1.0 - alpha
    dst[idx] = int(dst[idx] * inv + color[0] * alpha + 0.5)
    dst[idx + 1] = int(dst[idx + 1] * inv + color[1] * alpha + 0.5)
    dst[idx + 2] = int(dst[idx + 2] * inv + color[2] * alpha + 0.5)


def draw_bar(buf, size, cx, cy, hw, hh, r, color):
    """Tek çubuğu çizer. Yalnızca sınırlayıcı kutu taranıyor — hız için."""
    x0 = max(0, int(cx - hw - 2))
    x1 = min(size - 1, int(cx + hw + 2))
    y0 = max(0, int(cy - hh - 2))
    y1 = min(size - 1, int(cy + hh + 2))

    for y in range(y0, y1 + 1):
        row = y * size * 3
        py = y + 0.5
        for x in range(x0, x1 + 1):
            d = rounded_rect_sdf(x + 0.5, py, cx, cy, hw, hh, r)
            # Kapsama: sınırda yarım piksel geçişle yumuşuyor.
            a = 0.5 - d
            if a <= 0:
                continue
            if a > 1:
                a = 1.0
            blend(buf, row + x * 3, color, a)


def make_canvas(size, bg):
    return bytearray(bytes(bg) * (size * size))


def draw_mark(buf, size, color, scale=1.0, widths=(1.0, 0.74, 0.48)):
    """
    Üç azalan çubuk.

    `scale` Android ön planı için küçültmeye yarıyor: adaptif ikonda
    dış %33 kırpılabiliyor, motif güvenli alanda kalmalı.
    """
    block_w = size * 0.62 * scale
    bar_h = size * 0.108 * scale
    gap = size * 0.072 * scale
    left = (size - block_w) / 2.0
    total_h = bar_h * 3 + gap * 2
    top = (size - total_h) / 2.0
    radius = bar_h / 2.0

    for i, frac in enumerate(widths):
        w = block_w * frac
        cx = left + w / 2.0
        cy = top + bar_h / 2.0 + i * (bar_h + gap)
        draw_bar(buf, size, cx, cy, w / 2.0, bar_h / 2.0, radius, color)


def write_png(path, buf, size, opaque=True, alpha_buf=None):
    """
    PNG yazar. iOS ikonu SAYDAMLIK TAŞIYAMAZ — reddediliyor; o yüzden
    varsayılan RGB. Android ön planı saydam olmak zorunda, orada RGBA.
    """
    if opaque:
        color_type = 2
        stride = 3
        raw = bytearray()
        for y in range(size):
            raw.append(0)  # filtre: None
            raw += buf[y * size * 3:(y + 1) * size * 3]
    else:
        color_type = 6
        stride = 4
        raw = bytearray()
        for y in range(size):
            raw.append(0)
            base = y * size * 3
            abase = y * size
            for x in range(size):
                raw += buf[base + x * 3:base + x * 3 + 3]
                raw.append(alpha_buf[abase + x])

    def chunk(tag, data):
        out = struct.pack('>I', len(data)) + tag + data
        return out + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    header = struct.pack('>IIBBBBB', size, size, 8, color_type, 0, 0, 0)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', header)
           + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
           + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    return len(png)


def draw_mark_alpha(size, scale=1.0):
    """Saydam ön plan için alfa maskesi — motif nerede opaksa orası dolu."""
    alpha = bytearray(size * size)
    probe = make_canvas(size, (0, 0, 0))
    draw_mark(probe, size, (255, 255, 255), scale=scale)
    for i in range(size * size):
        alpha[i] = probe[i * 3]
    return alpha


BASE = '/Users/enes/Desktop/projeler/surucum/assets/images/'

# 1) iOS + genel ikon: tam taşma, saydamlık yok, köşeleri iOS yuvarlıyor.
icon = make_canvas(1024, ACCENT)
draw_mark(icon, 1024, ACCENT_TEXT)
print('icon.png', write_png(BASE + 'icon.png', icon, 1024), 'bayt')

# 2) Açılış ekranı motifi — arka plan app.json'dan geliyor, bu saydam.
splash = make_canvas(512, ACCENT)
draw_mark(splash, 512, ACCENT_TEXT)
print('splash-icon.png',
      write_png(BASE + 'splash-icon.png', splash, 512,
                opaque=False, alpha_buf=draw_mark_alpha(512)), 'bayt')

# 3) Android adaptif ön plan — güvenli alanda kalsın diye %62 ölçek.
fg = make_canvas(1024, ACCENT)
draw_mark(fg, 1024, ACCENT_TEXT, scale=0.62)
print('android-icon-foreground.png',
      write_png(BASE + 'android-icon-foreground.png', fg, 1024,
                opaque=False, alpha_buf=draw_mark_alpha(1024, scale=0.62)), 'bayt')

# 4) Android adaptif arka plan — düz vurgu rengi.
bg = make_canvas(1024, ACCENT)
print('android-icon-background.png',
      write_png(BASE + 'android-icon-background.png', bg, 1024), 'bayt')

# 5) Tek renk (temalı ikon) — Android siluetten kendi rengini üretiyor.
mono = make_canvas(1024, (0, 0, 0))
draw_mark(mono, 1024, (255, 255, 255), scale=0.62)
print('android-icon-monochrome.png',
      write_png(BASE + 'android-icon-monochrome.png', mono, 1024,
                opaque=False, alpha_buf=draw_mark_alpha(1024, scale=0.62)), 'bayt')

# 6) Favicon — web hedef değil ama dosya app.json'da referanslı kalmasın diye.
fav = make_canvas(96, ACCENT)
draw_mark(fav, 96, ACCENT_TEXT)
print('favicon.png', write_png(BASE + 'favicon.png', fav, 96), 'bayt')
