import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { errorMessage, get } from '@/shared/api/client';
import { API, qk } from '@/shared/api/endpoints';
import type { BoilerPoint, BoilerRooms } from '@/shared/api/types';
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
      title={point?.organizationName ?? `Lot ${point?.lotNumber ?? ''}`}
      description={
        point ? `${point.districtName} · lot ${point.lotNumber}` : undefined
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
          <div className="flex items-center justify-between rounded-tile bg-[var(--surface-sunken)] px-3 py-2">
            <div>
              <p className="text-micro text-muted">Kotyol</p>
              <StatusBadge status={point.status} />
            </div>
            <p
              className={`text-lede font-semibold tabular-nums ${BOILER_STATUS[point.status].text}`}
              data-numeric
            >
              {formatTemperature(point.temperature)}
            </p>
          </div>

          <div>
            <p className="mb-1 flex items-baseline justify-between text-ui font-medium text-strong">
              Xonalar
              {stats.count > 0 ? (
                <span className="text-micro font-normal text-muted">
                  o‘rtacha {formatTemperature(stats.avg)} · eng past{' '}
                  {formatTemperature(stats.min)}
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
