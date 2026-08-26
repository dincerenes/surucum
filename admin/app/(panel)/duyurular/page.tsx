import { Flash } from '@/components/flash';
import { RpcError } from '@/components/rpc-error';
import { Badge, Card, Empty, PageHead } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { isoToIstanbulLocal } from '@/lib/parse';
import { canWrite, requireAdmin } from '@/lib/guard';
import { createClient } from '@/lib/supabase/server';
import type { Announcement } from '@/lib/types';

import {
  createAnnouncement, deleteAnnouncement, toggleAnnouncement, updateAnnouncement,
} from './actions';

export const dynamic = 'force-dynamic';

const SEVERITIES = [
  { value: 'info', label: 'Bilgi' },
  { value: 'warning', label: 'Uyarı' },
  { value: 'critical', label: 'Kritik' },
];

const PLATFORMS = [
  { value: 'all', label: 'Tümü' },
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
];

type Status = 'live' | 'scheduled' | 'expired' | 'draft';

function statusOf(a: Announcement, now: Date): Status {
  if (!a.is_active) return 'draft';
  if (new Date(a.starts_at) > now) return 'scheduled';
  if (a.ends_at && new Date(a.ends_at) <= now) return 'expired';
  return 'live';
}

const STATUS_LABEL: Record<Status, string> = {
  live: 'Yayında',
  scheduled: 'Planlandı',
  expired: 'Süresi doldu',
  draft: 'Kapalı',
};

const STATUS_TONE: Record<Status, 'positive' | 'accent' | 'neutral' | 'warning'> = {
  live: 'positive',
  scheduled: 'accent',
  expired: 'neutral',
  draft: 'warning',
};

export default async function DuyurularPage({
  searchParams,
}: {
  searchParams: Promise<{ sonuc?: string; hata?: string }>;
}) {
  const session = await requireAdmin();
  const { sonuc, hata } = await searchParams;
  const editable = canWrite(session.role);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('starts_at', { ascending: false })
    .limit(100);

  const rows = (data ?? []) as Announcement[];
  const now = new Date();

  return (
    <>
      <PageHead
        title="Duyurular"
        sub="Sürücünün uygulamasında görünecek bildirimler"
      />

      <Flash ok={sonuc} error={hata} />
      <RpcError error={error} />

      <div className="notice notice-info" style={{ marginBottom: 14 }}>
        Sürücüye yalnızca <strong>yayında</strong> olan duyurular iner.
        Planlanmış ve kapalı duyurular hiç indirilmez — metni cihaza gitmez.
      </div>

      {editable ? (
        <Card title="Yeni duyuru">
          <AnnouncementForm action={createAnnouncement} submitLabel="Oluştur" />
        </Card>
      ) : (
        <div className="notice notice-warning">Destek rolü duyuru düzenleyemez.</div>
      )}

      <section className="section">
        <h2 className="section-title">Duyurular</h2>

        {rows.length === 0 ? (
          <div className="table-wrap"><Empty>Henüz duyuru yok.</Empty></div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {rows.map((a) => {
              const status = statusOf(a, now);
              return (
                <div className="card" key={a.id}>
                  <div className="row-tight" style={{ justifyContent: 'space-between' }}>
                    <div className="row-tight">
                      <strong style={{ fontSize: 15 }}>{a.title}</strong>
                      <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
                      <Badge tone={a.severity === 'critical' ? 'negative'
                        : a.severity === 'warning' ? 'warning' : 'neutral'}>
                        {SEVERITIES.find((s) => s.value === a.severity)?.label ?? a.severity}
                      </Badge>
                      {a.platform !== 'all'
                        ? <Badge tone="accent">{a.platform === 'ios' ? 'iOS' : 'Android'}</Badge>
                        : null}
                      {a.min_app_version
                        ? <Badge tone="neutral">≥ {a.min_app_version}</Badge>
                        : null}
                    </div>

                    {editable ? (
                      <div className="row-tight">
                        <form action={toggleAnnouncement}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="next" value={a.is_active ? '0' : '1'} />
                          <button className="btn btn-secondary btn-sm" type="submit">
                            {a.is_active ? 'Yayından kaldır' : 'Yayına al'}
                          </button>
                        </form>
                        <form action={deleteAnnouncement}>
                          <input type="hidden" name="id" value={a.id} />
                          <button className="btn btn-danger btn-sm" type="submit">Sil</button>
                        </form>
                      </div>
                    ) : null}
                  </div>

                  <p style={{ margin: '8px 0 0', color: 'var(--text-soft)', whiteSpace: 'pre-wrap' }}>
                    {a.body}
                  </p>

                  <p className="page-sub" style={{ marginTop: 8 }}>
                    {formatDateTime(a.starts_at)} –{' '}
                    {a.ends_at ? formatDateTime(a.ends_at) : 'süresiz'}
                  </p>

                  {editable ? (
                    /* Düzenleme formu <details> içinde: liste sade kalıyor
                       ama düzenleme için ayrı sayfaya gitmek gerekmiyor.
                       Açılır kapanır davranış tarayıcının kendi işi —
                       tek satır istemci kodu yok. */
                    <details style={{ marginTop: 10 }}>
                      <summary style={{ cursor: 'pointer', color: 'var(--text-soft)' }}>
                        Düzenle
                      </summary>
                      <div style={{ marginTop: 10 }}>
                        <AnnouncementForm
                          action={updateAnnouncement}
                          submitLabel="Kaydet"
                          value={a}
                        />
                      </div>
                    </details>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function AnnouncementForm({
  action, submitLabel, value,
}: {
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  value?: Announcement;
}) {
  return (
    <form action={action} style={{ display: 'grid', gap: 10 }}>
      {value ? <input type="hidden" name="id" value={value.id} /> : null}

      <div className="field">
        <label className="label" htmlFor={`title-${value?.id ?? 'new'}`}>Başlık</label>
        <input id={`title-${value?.id ?? 'new'}`} name="title" type="text" required
               defaultValue={value?.title ?? ''} maxLength={120} />
      </div>

      <div className="field">
        <label className="label" htmlFor={`body-${value?.id ?? 'new'}`}>Metin</label>
        <textarea id={`body-${value?.id ?? 'new'}`} name="body" required
                  defaultValue={value?.body ?? ''} />
      </div>

      <div className="row">
        <div className="field" style={{ flex: '0 0 140px' }}>
          <label className="label">Önem</label>
          <select name="severity" defaultValue={value?.severity ?? 'info'}>
            {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div className="field" style={{ flex: '0 0 140px' }}>
          <label className="label">Platform</label>
          <select name="platform" defaultValue={value?.platform ?? 'all'}>
            {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <div className="field" style={{ flex: '0 0 150px' }}>
          <label className="label">En düşük sürüm</label>
          <input name="min_app_version" type="text" placeholder="0.2.0"
                 defaultValue={value?.min_app_version ?? ''} />
        </div>

        <div className="field" style={{ flex: '0 0 200px' }}>
          <label className="label">Başlangıç</label>
          <input name="starts_at" type="datetime-local"
                 defaultValue={isoToIstanbulLocal(value?.starts_at) || isoToIstanbulLocal(new Date().toISOString())} />
        </div>

        <div className="field" style={{ flex: '0 0 200px' }}>
          <label className="label">Bitiş (boş = süresiz)</label>
          <input name="ends_at" type="datetime-local"
                 defaultValue={isoToIstanbulLocal(value?.ends_at)} />
        </div>
      </div>

      <label className="row-tight" style={{ cursor: 'pointer' }}>
        <input type="checkbox" name="is_active" defaultChecked={value?.is_active ?? true}
               style={{ width: 'auto' }} />
        <span>Yayında</span>
      </label>

      <div>
        <button className="btn" type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}
