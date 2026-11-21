import { useCallback, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { useRealtime } from '@/shared/hooks/useRealtime';
import { cn } from '@/shared/utils/cn';
import { useUiStore } from '@/store/ui.store';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';

/**
 * ILOVA QOBIG'I — chap yon panel + yuqori panel + kontent.
 *
 * ⚠️ `useRealtime()` AYNAN shu yerda chaqiriladi, har sahifada emas:
 * soket ulanishi BITTA bo'lishi kerak. Har sahifa o'zi ulansa,
 * bo'limlar orasida yurganda ulanishlar to'planib, server bitta
 * foydalanuvchi uchun o'nlab soket ushlab turardi.
 *
 * ⚠️⚠️ Kontent KENGLIGI CHEKLANMAGAN. Bu tizimda asosiy ekran — XARITA
 * va 11 ustunli JADVAL; cheklov bo'lsa keng monitorda ikki chetda bo'sh
 * joy qolib, xarita kichrayib turardi.
 *
 * ⚠️ SAHIFA ALMASHISHI: kontent `pathname` kaliti bilan `.page-stage`
 * ichida — yangi bo'limga o'tilganda sahifa bo'limlari zinapoya bo'lib
 * tushadi (CSS, `index.css`). Kalit faqat YO'L bo'yicha: `?page=2` kabi
 * so'rov parametri o'zgarganda sahifa qayta «tushmaydi» — jadval
 * varaqlanganda butun ekran silkinsa, operator joyini yo'qotardi.
 */
export function AppLayout() {
  useRealtime();
  const collapsed = useUiStore((state) => state.railCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  /* ⚠️ Barqaror funksiya: Sidebar uni effekt bog'liqligida ishlatadi va
     har renderda yangi funksiya bo'lsa, ochiq tortmada fokus qayta-qayta
     yopish tugmasiga sakrardi. */
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { pathname } = useLocation();

  return (
    <div className="relative min-h-dvh bg-[var(--canvas)]">
      {/* Atmosfera — kontent ustidagi juda sokin yorug'lik. Faqat
          bezak: bosishni to'smaydi, aylantirilmaydi. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[480px] bg-[radial-gradient(70%_100%_at_60%_0%,rgb(22_115_214/0.09),transparent_70%)] dark:bg-[radial-gradient(70%_100%_at_60%_0%,rgb(22_115_214/0.16),transparent_70%)]"
      />

      <Sidebar mobileOpen={mobileOpen} onCloseMobile={closeMobile} />

      {/*
       * ⚠️ Kontent `margin-left` bilan suriladi, `flex` bilan EMAS.
       * Yon panel `fixed` va flex qatorida o'z joyini egallamaydi.
       * ⚠️ Telefonda tortma ochiq bo'lsa orqadagi sahifa `inert`.
       * ⚠️⚠️ Bu o'ramga `z-index` BERILMAYDI: u yangi qatlam (stacking
       * context) yaratib, ichidagi to'liq ekranli xaritani (`fixed z-50`)
       * yon panel (`z-40`) OSTIGA qamab qo'yardi — xaritaning chap 248 px
       * qismi va tugmalari ko'rinmay qolardi. Atmosfera qatlami DOMda
       * oldin turgani uchun kontent baribir uning ustida chiziladi.
       */}
      <div
        inert={mobileOpen && !isDesktop}
        className={cn(
          'relative flex min-h-dvh flex-col transition-[margin] duration-300 ease-out-quint',
          collapsed ? 'lg:ml-rail-tight' : 'lg:ml-rail',
        )}
      >
        <TopBar onOpenMobileMenu={openMobile} />
        <main className="flex-1 px-3 py-4 sm:px-5 sm:py-5">
          <div key={pathname} className="page-stage">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
