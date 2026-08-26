'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const GROUPS: { title: string | null; items: { href: string; label: string }[] }[] = [
  {
    title: null,
    items: [
      { href: '/', label: 'Genel bakış' },
      { href: '/kullanicilar', label: 'Kullanıcılar' },
      { href: '/sistem-sagligi', label: 'Sistem sağlığı' },
    ],
  },
  {
    title: 'Operasyon',
    items: [
      { href: '/yakit-fiyatlari', label: 'Yakıt fiyatları' },
      { href: '/duyurular', label: 'Duyurular' },
      { href: '/ozellik-bayraklari', label: 'Özellik bayrakları' },
    ],
  },
  {
    title: 'Yönetim',
    items: [
      { href: '/yoneticiler', label: 'Yöneticiler' },
      { href: '/denetim', label: 'Denetim kaydı' },
    ],
  },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <>
      {GROUPS.map((group, i) => (
        <div key={group.title ?? i}>
          {group.title ? <div className="nav-group">{group.title}</div> : null}
          {group.items.map((item) => {
            // Ana sayfa dışındaki bağlantılar alt yollarda da etkin kalmalı:
            // /kullanicilar/<id> açıkken "Kullanıcılar" seçili görünsün.
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(item.href + '/');

            return (
              <Link
                key={item.href}
                href={item.href}
                className="nav-link"
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}
