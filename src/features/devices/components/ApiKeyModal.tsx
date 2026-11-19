import { Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Modal } from '@/shared/ui';

/** Bir marta ko'rsatiladigan kalit — yaratish, almashtirish yoki ro'yxatga olishdan. */
export interface IssuedKey {
  deviceId: string;
  apiKey: string;
}

/**
 * API KALIT OYNASI.
 *
 * ⚠️ Kalit BIR MARTA ko'rsatiladi va oyna yopilgandan keyin uni
 * tizimdan qayta olib bo'lmaydi (bazada faqat hash bor). Shuning
 * uchun oyna aniq ogohlantiradi va nusxalash tugmasi beradi — aks
 * holda foydalanuvchi uni oddiy xabar deb yopib yuborardi.
 */
export function ApiKeyModal({
  value,
  onClose,
}: {
  value: IssuedKey | null;
  onClose: () => void;
}) {
  const copy = async (): Promise<void> => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value.apiKey);
      toast.success('Kalit nusxalandi');
    } catch {
      toast.error('Nusxalab bo‘lmadi — kalitni qo‘lda belgilang');
    }
  };

  return (
    <Modal
      open={Boolean(value)}
      onClose={onClose}
      title="API kalit yaratildi"
      description="Bu kalit BOSHQA ko‘rsatilmaydi — proshivkaga darhol ko‘chiring"
      size="md"
      footer={
        <Button variant="primary" onClick={onClose}>
          Nusxaladim, yopish
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-warn-50 px-3 py-2.5 text-meta text-warn-700 ring-1 ring-warn-200 dark:bg-warn-400/10 dark:text-warn-300 dark:ring-warn-400/25">
          Tizim kalitning faqat hash‘ini saqlaydi. Oyna yopilgandan so‘ng uni
          qayta ko‘rish imkoni bo‘lmaydi — faqat yangisini generatsiya qilish
          mumkin.
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-[var(--surface-sunken)] p-2.5">
          <code className="flex-1 overflow-x-auto font-mono text-ui text-strong">
            {value?.apiKey}
          </code>
          <Button
            size="sm"
            variant="secondary"
            icon={<Copy className="size-3.5" />}
            onClick={() => void copy()}
          >
            Nusxalash
          </Button>
        </div>

        <div>
          <p className="label-eyebrow mb-1.5">Proshivkaga qo‘yiladigan kod</p>
          <pre className="overflow-x-auto rounded-lg bg-neutral-900 p-3 font-mono text-micro leading-relaxed text-neutral-100">
            {`const char* DEVICE_ID = "${value?.deviceId}";
const char* API_URL   = "http://<server>:3000/api/data";
const char* API_KEY   = "${value?.apiKey}";`}
          </pre>
        </div>
      </div>
    </Modal>
  );
}
