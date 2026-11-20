import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { InlineLoader } from '@/shared/ui';
import { useAuthStore } from '@/store/auth.store';
import { LoginPage } from '@/features/auth/LoginPage';

/*
 * ⚠️ Sahifalar KECHIKTIRIB yuklanadi (`lazy`). Xarita (Leaflet) va
 * grafiklar (Recharts) birgalikda ~400 KB: ular asosiy bo'lakda
 * qolsa, LOGIN sahifasi ham shu hajmni yuklab o'tirardi — ya'ni
 * tizimga kirmagan odam xarita kutubxonasini kutardi.
 */
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({
    default: m.DashboardPage,
  })),
);
const MapPage = lazy(() =>
  import('@/features/map/MapPage').then((m) => ({ default: m.MapPage })),
);
const InstitutionsPage = lazy(() =>
  import('@/features/institutions/InstitutionsPage').then((m) => ({
    default: m.InstitutionsPage,
  })),
);
const BoilersPage = lazy(() =>
  import('@/features/boilers/BoilersPage').then((m) => ({
    default: m.BoilersPage,
  })),
);
const BoilerDetailPage = lazy(() =>
  import('@/features/boilers/BoilerDetailPage').then((m) => ({
    default: m.BoilerDetailPage,
  })),
);
const DevicesPage = lazy(() =>
  import('@/features/devices/DevicesPage').then((m) => ({
    default: m.DevicesPage,
  })),
);
const AlertsPage = lazy(() =>
  import('@/features/alerts/AlertsPage').then((m) => ({ default: m.AlertsPage })),
);
const IncidentsPage = lazy(() =>
  import('@/features/incidents/IncidentsPage').then((m) => ({
    default: m.IncidentsPage,
  })),
);
const IncidentDetailPage = lazy(() =>
  import('@/features/incidents/IncidentDetailPage').then((m) => ({
    default: m.IncidentDetailPage,
  })),
);
const IncidentAnalyticsPage = lazy(() =>
  import('@/features/incidents/IncidentAnalyticsPage').then((m) => ({
    default: m.IncidentAnalyticsPage,
  })),
);
const ResponsiblePersonsPage = lazy(() =>
  import('@/features/responsible-persons/ResponsiblePersonsPage').then((m) => ({
    default: m.ResponsiblePersonsPage,
  })),
);
const MonitoringPage = lazy(() =>
  import('@/features/monitoring/MonitoringPage').then((m) => ({
    default: m.MonitoringPage,
  })),
);
const FirmwarePage = lazy(() =>
  import('@/features/firmware/FirmwarePage').then((m) => ({
    default: m.FirmwarePage,
  })),
);
const CatalogsPage = lazy(() =>
  import('@/features/catalogs/CatalogsPage').then((m) => ({
    default: m.CatalogsPage,
  })),
);
const UsersPage = lazy(() =>
  import('@/features/users/UsersPage').then((m) => ({ default: m.UsersPage })),
);
const ResponsiblesPage = lazy(() =>
  import('@/features/responsibles/ResponsiblesPage').then((m) => ({
    default: m.ResponsiblesPage,
  })),
);
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({
    default: m.SettingsPage,
  })),
);
const PasswordPage = lazy(() =>
  import('@/features/settings/PasswordPage').then((m) => ({
    default: m.PasswordPage,
  })),
);

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />

      <Route element={<Private><AppLayout /></Private>}>
        <Route index element={<Home />} />
        <Route path="incidents" element={<Lazy><IncidentsPage /></Lazy>} />
        <Route path="incidents/:id" element={<Lazy><IncidentDetailPage /></Lazy>} />
        <Route path="incident-analytics" element={<Lazy><IncidentAnalyticsPage /></Lazy>} />
        <Route path="responsible-persons" element={<Lazy><ResponsiblePersonsPage /></Lazy>} />
        <Route path="monitoring" element={<Lazy><MonitoringPage /></Lazy>} />
        <Route path="map" element={<Lazy><MapPage /></Lazy>} />
        <Route path="institutions" element={<Lazy><InstitutionsPage /></Lazy>} />
        <Route path="boilers" element={<Lazy><BoilersPage /></Lazy>} />
        <Route path="boilers/:id" element={<Lazy><BoilerDetailPage /></Lazy>} />
        <Route path="devices" element={<Lazy><DevicesPage /></Lazy>} />
        <Route path="firmware" element={<Lazy><FirmwarePage /></Lazy>} />
        <Route path="alerts" element={<Lazy><AlertsPage /></Lazy>} />
        <Route path="catalogs" element={<Lazy><CatalogsPage /></Lazy>} />
        <Route path="responsibles" element={<Lazy><ResponsiblesPage /></Lazy>} />
        <Route path="users" element={<Lazy><UsersPage /></Lazy>} />
        <Route path="settings" element={<Lazy><SettingsPage /></Lazy>} />
        <Route path="settings/password" element={<Lazy><PasswordPage /></Lazy>} />
      </Route>

      {/* ⚠️ Noma'lum yo'l bosh sahifaga, 404 sahifasiga EMAS: ichki
          tizimda noto'g'ri havola deyarli har doim eskirgan xatcho'p
          bo'ladi va foydalanuvchiga «topilmadi» emas, ishlaydigan
          ekran kerak. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/**
 * BOSH SAHIFA — rolga qarab.
 *
 * ⚠️ Tashkilot mas'uli va obyekt javobgarida `reports.view` yo'q: ular
 * uchun dashboard faqat 403 xatolar bilan to'lardi. Ularning ish joyi —
 * XAVF ro'yxati.
 */
function Home() {
  const can = useAuthStore((state) => state.can);
  if (!can('reports.view') && can('incidents.view')) {
    return <Navigate to="/incidents" replace />;
  }
  return (
    <Lazy>
      <DashboardPage />
    </Lazy>
  );
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<InlineLoader />}>{children}</Suspense>;
}

/**
 * ⚠️ Kirmagan foydalanuvchi QAYERGA bormoqchi bo'lgani saqlanadi
 * (`state.from`): kirgandan keyin u o'sha sahifaga qaytadi.
 * Usiz havola orqali kelgan odam har doim bosh sahifaga tushardi va
 * yuborilgan havolaning ma'nosi yo'qolardi.
 */
function Private({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}
