import {
  Bell,
  Cpu,
  HardDriveDownload,
  Flame,
  Gauge,
  LayoutDashboard,
  Library,
  Map,
  Settings,
  UserCog,
  Users,
} from 'lucide-react';
import { BRAND } from './brand';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Ko'rinishi uchun kerakli ruxsat. `null` — hammaga ochiq. */
  permission: string | null;
  /** Yon paneldagi guruh — ajratgich bilan bo'linadi. */
  group: 'main' | 'manage';
}

/**
 * ASOSIY MENYU — chap yon panel.
 *
 * ⚠️⚠️ Ilgari bu gorizontal tablar edi va bo'limlar «Yana» ro'yxatiga
 * yig'ilardi: sakkizta bo'lim yuqori qatorga sig'masdi va yarmi
 * yashirin qolardi. Yon panelda HAMMASI bir vaqtda ko'rinadi —
 * foydalanuvchi «qayerdaman va yana nima bor» degan savolga
 * qidirmasdan javob oladi.
 *
 * ⚠️ IKKI GURUH: `main` — kundalik kuzatuv, `manage` — sozlash va
 * ma'muriyat. Aralashtirilsa, kuniga bir marta ochiladigan
 * «Sozlamalar» har kuni ishlatiladigan «Kotyollar» bilan bir qatorda
 * turib, ko'zni chalg'itardi.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Umumiy ko‘rinish',
    icon: LayoutDashboard,
    permission: 'reports.view',
    group: 'main',
  },
  {
    to: '/map',
    label: 'Xarita',
    icon: Map,
    permission: 'reports.view',
    group: 'main',
  },
  /*
   * ⚠️ «Muassasalar» — JONLI SHKALALAR (kirish/chiqish harorati) muassasa
   * TURI bo'yicha (maktab, bog'cha…). «Kotyollar» esa reyestr (jadval,
   * tahrirlash). Ikkalasi bitta ma'lumot, lekin boshqa savol: «hozir
   * qayerda sovuq» va «qaysi kotyol qayerda, kimniki».
   */
  {
    to: '/institutions',
    label: 'Muassasalar',
    icon: Gauge,
    permission: 'reports.view',
    group: 'main',
  },
  {
    to: '/boilers',
    label: 'Kotyollar',
    icon: Flame,
    permission: 'boilers.view',
    group: 'main',
  },
  {
    to: '/devices',
    label: 'ESP32 modullari',
    icon: Cpu,
    permission: 'devices.view',
    group: 'main',
  },
  {
    to: '/alerts',
    label: 'Ogohlantirishlar',
    icon: Bell,
    permission: 'alerts.view',
    group: 'main',
  },

  /*
   * ⚠️ «Tuman mas'ullari» va «Foydalanuvchilar» — IKKI ALOHIDA bo'lim.
   * Birinchisi TUMANDAN boshlanadi («qaysi tumanda mas'ul yo'q»),
   * ikkinchisi FOYDALANUVCHIDAN. Bitta ro'yxatga qo'shilsa, mas'uli
   * yo'q tuman umuman ko'rinmasdi — holbuki shu bo'limning butun
   * maqsadi aynan o'sha bo'shliqni ko'rsatish.
   */
  /*
   * ⚠️ «Proshivka» — `manage` guruhida, `main` da EMAS. Bu kundalik
   * kuzatuv emas: yangi versiya oyda bir marta tarqatiladi va
   * tugmasi butun viloyat parkiga ta'sir qiladi. `main` da turgan
   * bo'lsa, u har kuni ko'z o'ngida bo'lib, tasodifiy bosilish
   * ehtimoli oshardi.
   */
  {
    to: '/firmware',
    label: 'Proshivka (OTA)',
    icon: HardDriveDownload,
    permission: 'firmware.view',
    group: 'manage',
  },
  {
    to: '/catalogs',
    label: 'Kataloglar',
    icon: Library,
    permission: 'catalogs.view',
    group: 'manage',
  },
  {
    to: '/responsibles',
    label: 'Tuman mas‘ullari',
    icon: UserCog,
    permission: 'users.view',
    group: 'manage',
  },
  {
    to: '/users',
    label: 'Foydalanuvchilar',
    icon: Users,
    permission: 'users.view',
    group: 'manage',
  },
  {
    to: '/settings',
    label: 'Sozlamalar',
    icon: Settings,
    permission: 'settings.view',
    group: 'manage',
  },
];

/** Yon paneldagi guruh sarlavhalari. */
export const NAV_GROUP_LABELS: Record<NavItem['group'], string> = {
  main: 'Kuzatuv',
  manage: 'Boshqaruv',
};

/**
 * Yo'lga mos bo'lim sarlavhasi — yuqori paneldagi matn.
 *
 * ⚠️ Eng UZUN mos keluvchi tanlanadi: `/boilers/:id` uchun `/boilers`
 * ham, `/` ham mos keladi va saralashsiz bosh sahifaning sarlavhasi
 * chiqib qolardi.
 */
export function navTitleFor(pathname: string): string {
  if (pathname.startsWith('/settings/password')) {
    return 'Parolni o‘zgartirish';
  }

  const match = [...NAV_ITEMS]
    .filter((item) =>
      item.to === '/' ? pathname === '/' : pathname.startsWith(item.to),
    )
    .sort((a, b) => b.to.length - a.to.length)[0];

  return match?.label ?? BRAND.short;
}
