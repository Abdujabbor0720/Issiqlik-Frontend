import { useState } from 'react';
import { Outlet } from 'react-router-dom';
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
 * ⚠️⚠️ Kontent KENGLIGI CHEKLANMAGAN (ilgari 1440 px edi). Bu tizimda
 * asosiy ekran — XARITA va 11 ustunli JADVAL; cheklov bo'lsa, keng
 * monitorda ikki chetda keng bo'sh joy qolib, xarita esa kichrayib
 * turardi. Kenglikni endi yon panel va chetki bo'shliq hal qiladi.
 */
export function AppLayout() {
  useRealtime();
  const collapsed = useUiStore((state) => state.railCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-[var(--canvas)]">
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/*
       * ⚠️ Kontent `margin-left` bilan suriladi, `flex` bilan EMAS.
       * Yon panel `fixed` (ekran bo'ylab, aylantirilmaydi) va flex
       * qatorida u o'z joyini egallamaydi — kontent uning ostiga
       * kirib ketardi.
       */}
      <div
        className={cn(
          'flex min-h-dvh flex-col transition-[margin] duration-200',
          collapsed ? 'lg:ml-rail-tight' : 'lg:ml-rail',
        )}
      >
        <TopBar onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="flex-1 px-3 py-4 sm:px-5 sm:py-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
