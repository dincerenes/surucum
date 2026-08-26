import { Flash } from '@/components/flash';
import { RpcError } from '@/components/rpc-error';
import { Badge, Card, Empty, PageHead } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { canWrite, requireAdmin } from '@/lib/guard';
import { createClient } from '@/lib/supabase/server';
import type { FeatureFlag } from '@/lib/types';

import { deleteFlag, saveFlag, toggleFlag } from './actions';

export const dynamic = 'force-dynamic';

export default async function OzellikBayraklariPage({
  searchParams,
}: {
  searchParams: Promise<{ sonuc?: string; hata?: string }>;
}) {
  const session = await requireAdmin();
  const { sonuc, hata } = await searchParams;
  const editable = canWrite(session.role);

  const supabase = await createClient();
  const { data, error } = await supabase.from('feature_flags').select('*').order('key');
  const flags = (data ?? []) as FeatureFlag[];

  return (
    <>
      <PageHead
        title="Özellik bayrakları"
        sub="Uygulamadaki özellikleri sürüm çıkmadan açıp kapatır"
      />

      <Flash ok={sonuc} error={hata} />
      <RpcError error={error} />

      <div className="notice notice-info" style={{ marginBottom: 14 }}>
        Anahtarlar <code>src/lib/entitlements.ts</code> içindeki
        <code> FEATURES</code> listesiyle aynı olmalı. Burada olmayan bir
        anahtarı uygulama sorarsa varsayılan davranışa düşer.
        Kademeli açılış oranı cihazda, kullanıcı kimliğinin sabit özetine
        göre hesaplanır — aynı kullanıcı her açılışta aynı sonucu alır.
      </div>

      <section>
        {flags.length === 0 ? (
          <div className="table-wrap"><Empty>Tanımlı bayrak yok.</Empty></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Anahtar</th>
                  <th>Açıklama</th>
                  <th>Durum</th>
                  <th className="right">Açılış</th>
                  <th>Son değişiklik</th>
                  {editable ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {flags.map((f) => (
                  <tr key={f.key}>
                    <td className="mono" style={{ fontWeight: 600 }}>{f.key}</td>
                    <td style={{ whiteSpace: 'normal', maxWidth: 320 }}>{f.description || '—'}</td>
                    <td>
                      {f.is_enabled
                        ? <Badge tone="positive">Açık</Badge>
                        : <Badge tone="neutral">Kapalı</Badge>}
                    </td>
                    <td className="right num">
                      {f.rollout_percent < 100 ? `%${f.rollout_percent}` : 'tümü'}
                    </td>
                    <td className="nowrap">{formatDateTime(f.updated_at)}</td>
                    {editable ? (
                      <td className="right">
                        <div className="row-tight" style={{ justifyContent: 'flex-end' }}>
                          <form action={toggleFlag}>
                            <input type="hidden" name="key" value={f.key} />
                            <input type="hidden" name="next" value={f.is_enabled ? '0' : '1'} />
                            <button className="btn btn-secondary btn-sm" type="submit">
                              {f.is_enabled ? 'Kapat' : 'Aç'}
                            </button>
                          </form>
                          <form action={deleteFlag}>
                            <input type="hidden" name="key" value={f.key} />
                            <button className="btn btn-danger btn-sm" type="submit">Sil</button>
                          </form>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editable ? (
        <section className="section">
          <Card title="Bayrak ekle veya güncelle">
            <form action={saveFlag} style={{ display: 'grid', gap: 10 }}>
              <div className="row">
                <div className="field" style={{ flex: '0 0 220px' }}>
                  <label className="label" htmlFor="key">Anahtar</label>
                  <input id="key" name="key" type="text" required placeholder="advancedReports"
                         pattern="[A-Za-z][A-Za-z0-9_]*" />
                </div>
                <div className="field" style={{ flex: '1 1 260px' }}>
                  <label className="label" htmlFor="description">Açıklama</label>
                  <input id="description" name="description" type="text" />
                </div>
                <div className="field" style={{ flex: '0 0 150px' }}>
                  <label className="label" htmlFor="rollout_percent">Açılış oranı (%)</label>
                  <input id="rollout_percent" name="rollout_percent" type="number"
                         min={0} max={100} defaultValue={100} />
                </div>
              </div>

              <label className="row-tight" style={{ cursor: 'pointer' }}>
                <input type="checkbox" name="is_enabled" defaultChecked style={{ width: 'auto' }} />
                <span>Açık</span>
              </label>

              <div>
                <button className="btn" type="submit">Kaydet</button>
              </div>
            </form>
            <p className="page-sub" style={{ marginTop: 8 }}>
              Var olan bir anahtar girilirse üzerine yazılır.
            </p>
          </Card>
        </section>
      ) : null}
    </>
  );
}
