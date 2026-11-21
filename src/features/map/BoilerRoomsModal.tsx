import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { errorMessage, get } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { BoilerPoint, BoilerRooms, BoilerStatus } from '@/shared/api/types';
import { BOILER_STATUS } from '@/shared/constants/status';
import {
  Button,
  ErrorState,
  Modal,
  SkeletonRows,
  StatusBadge,
} from '@/shared/ui';
import { formatTemperature } from '@/shared/utils/format';
import { RoomList, summarizeRooms } from '@/features/rooms/RoomsPanel';
import { boilerName } from '@/shared/utils/boiler';

/** `BOILER_STATUS.text` faqat yorug' qadam — to'q fonda och qadam kerak. */
const TEMP_DARK: Record<BoilerStatus, string> = {
  active: 'dark:text-ok-300',
  medium: 'dark:text-warn-300',
  inactive: 'dark:text-danger-300',
  offline: 'dark:text-idle-300',
};

/**
 * XARITADAGI NUQTA BOSILGANDA — bino va uning xonalari.
 *
 * ⚠️ Leaflet `Popup` EMAS, oddiy oyna: nuqta 12px, uning ustidagi
 * popup telefonda barmoq bilan yopilmay, xaritani surishga xalal
 * berardi. Oyna esa klaviatura (Esc) va ekran o'quvchi bilan ham
 * ishlaydi.
 *
 * ⚠️ Xonalar FAQAT oyna ochilganda so'raladi: xaritada 2000 nuqta bor
 * va hammasining xonalarini oldindan yuklash behuda bo'lardi (nuqtaning
 * o'zida faqat qisqa statistika keladi).
 */
export function BoilerRoomsModal({
  point,
  onClose,
}: {
  point: BoilerPoint | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  const roomsQuery = useQuery({
    queryKey: qk.rooms(point?.id ?? ''),
    queryFn: () => get<BoilerRooms>(API.rooms.byBoiler(point?.id ?? '')),
    enabled: Boolean(point),
    refetchInterval: 60_000,
  });

  const rooms = roomsQuery.data?.rooms ?? [];
  const stats = summarizeRooms(rooms);

  return (
    <Modal
      open={Boolean(point)}
      onClose={onClose}
      size="sm"
      title={boilerName(point?.organizationName, point?.lotNumber)}
      description={
        point
          ? `${point.districtName}${point.lotNumber ? ` · lot ${point.lotNumber}` : ''}`
          : undefined
      }
      footer={
        point ? (
          <Button
            variant="primary"
            icon={<ArrowRight className="size-4" />}
            onClick={() => navigate(`/boilers/${point.id}`)}
          >
            Kotyol sahifasi
          </Button>
        ) : null
      }
    >
      {point ? (
        <div className="flex flex-col gap-3">
          {/* ⚠️ Kotyol plitkasi — chap chetida HOLAT chizig'i va katta
              DISPLEY raqami: oyna ochilganda ko'z birinchi «qozon
              qanday» degan savolga javob topadi, keyin xonalarga tushadi. */}
          <div className="relative flex items-center justify-between overflow-hidden rounded-tile bg-[var(--surface-sunken)] py-2.5 pr-3.5 pl-4 ring-1 ring-[var(--border-subtle)] ring-inset">
            <span
              aria-hidden
              className={`absolute inset-y-0 left-0 w-[3px] ${BOILER_STATUS[point.status].dot}`}
            />
            <div className="flex flex-col items-start gap-1">
              <p className="label-eyebrow">Kotyol</p>
              <StatusBadge status={point.status} />
            </div>
            <p
              className={`figure-display text-[26px] ${BOILER_STATUS[point.status].text} ${TEMP_DARK[point.status]}`}
              data-numeric
            >
              {formatTemperature(point.temperature)}
            </p>
          </div>

          <div>
            <p className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="label-eyebrow">Xonalar</span>
              {stats.count > 0 ? (
                <span className="text-micro text-muted">
                  o‘rtacha{' '}
                  <span className="font-semibold text-strong" data-numeric>
                    {formatTemperature(stats.avg)}
                  </span>{' '}
                  · eng past{' '}
                  <span className="font-semibold text-strong" data-numeric>
                    {formatTemperature(stats.min)}
                  </span>
                </span>
              ) : null}
            </p>

            {roomsQuery.isLoading ? (
              <SkeletonRows rows={3} />
            ) : roomsQuery.isError ? (
              <ErrorState
                message={errorMessage(roomsQuery.error)}
                onRetry={() => void roomsQuery.refetch()}
              />
            ) : rooms.length === 0 ? (
              <p className="py-3 text-meta text-muted">
                Bu binoda xona harorati o‘lchanmaydi (havo datchigi ulanmagan).
              </p>
            ) : (
              <RoomList rooms={rooms} compact />
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
