import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react';
import { useState, type CSSProperties, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '@/shared/api/client';
import { Logo } from '@/layouts/components/Logo';
import { BRAND } from '@/shared/constants/brand';
import { AnimatedNumber, Button, Field, Input, StateEmblem } from '@/shared/ui';
import { useAuthStore } from '@/store/auth.store';

interface LocationState {
  from?: string;
}

/*
 * Ko'tariluvchi uchqunlar — oldindan belgilangan, `Math.random` EMAS:
 * har chizishda joyi o'zgarsa, React qayta chizganda uchqunlar
 * «sakrab» ketardi.
 */
const EMBERS = [
  { x: '6%', d: '11s', delay: '0s', drift: '24px' },
  { x: '14%', d: '9s', delay: '3.2s', drift: '-18px' },
  { x: '22%', d: '12s', delay: '6.1s', drift: '30px' },
  { x: '31%', d: '10s', delay: '1.4s', drift: '-26px' },
  { x: '39%', d: '13s', delay: '7.8s', drift: '16px' },
  { x: '47%', d: '9.5s', delay: '4.4s', drift: '-14px' },
  { x: '55%', d: '11.5s', delay: '0.8s', drift: '22px' },
  { x: '63%', d: '10.5s', delay: '5.6s', drift: '-30px' },
  { x: '71%', d: '12.5s', delay: '2.3s', drift: '18px' },
  { x: '79%', d: '9s', delay: '8.4s', drift: '-20px' },
  { x: '87%', d: '11s', delay: '3.9s', drift: '26px' },
  { x: '94%', d: '13.5s', delay: '6.9s', drift: '-16px' },
];

/** Shkala: 20 °C dan 80 °C gacha. */
const SCALE_MIN = 20;
const SCALE_MAX = 80;
const pct = (value: number): string =>
  `${((value - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100}%`;

/**
 * KIRISH SAHIFASI.
 *
 * ⚠️ Ikki ustunli: chapda tizimning «yuzi» (gerb, nom, vazifa), o'ngda
 * forma. Bu davlat tizimi va unga ko'pincha havola orqali kelinadi:
 * ekran birinchi soniyada «qaysi tizim, kimniki» degan savolga javob
 * berishi kerak.
 *
 * ⚠️ Chap panel HAR DOIM to'q (mavzudan qat'i nazar): gerb va termal
 * maydon to'q fonda o'qiladi. O'ng forma esa tanlangan mavzuda.
 *
 * ⚠️ Chap ustun KICHIK ekranda butunlay yashiriladi, siqilmaydi:
 * telefonda forma pastga surilib ketardi.
 *
 * ⚠️ Barcha fon harakatlari faqat `transform` / `opacity` /
 * `background-position` — eski noutbukda ham forma kiritish sekinlashmaydi.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);

  const [form, setForm] = useState({ login: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Har muvaffaqiyatsiz urinishda o'sadi — xato qutisi qayta «silkinadi». */
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);

    if (!form.login.trim() || !form.password) {
      setError('Login va parolni kiriting');
      setAttempt((value) => value + 1);
      return;
    }

    setLoading(true);
    try {
      await login(form.login.trim(), form.password);
      const from = (location.state as LocationState | null)?.from;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Tizimga kirib bo‘lmadi'));
      setAttempt((value) => value + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-dvh grid-cols-1 bg-[var(--canvas)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,560px)]">
      {/* ───── Chap: termal maydon ───── */}
      <aside className="grain relative hidden overflow-hidden bg-rail-950 text-white lg:block">
        {/* Issiqlik «bulutlari» — sekin suzadi. */}
        <span
          aria-hidden
          className="login-blob top-[-18%] left-[-12%] size-[620px] bg-brand-600"
        />
        <span
          aria-hidden
          className="login-blob top-[30%] right-[-20%] size-[520px] bg-[#0aa1d6] [animation-delay:-6s]"
          style={{ opacity: 0.32 }}
        />
        <span
          aria-hidden
          className="login-blob bottom-[-26%] left-[18%] size-[560px] bg-heat-600 [animation-delay:-11s]"
          style={{ opacity: 0.3 }}
        />

        {/* Perspektivali to'r «pol» — nazorat markazi chuqurligi. */}
        <span aria-hidden className="login-floor" />

        {/* Ko'tariluvchi uchqunlar. */}
        <span aria-hidden className="absolute inset-0 overflow-hidden">
          {EMBERS.map((ember) => (
            <span
              key={ember.x}
              className="ember"
              style={
                {
                  '--x': ember.x,
                  '--d': ember.d,
                  '--delay': ember.delay,
                  '--drift': ember.drift,
                } as CSSProperties
              }
            />
          ))}
        </span>

        {/* Pastki qorayish — matn fonida o'qilishi uchun. */}
        <span
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,rgb(4_11_23/0.2)_0%,rgb(4_11_23/0.05)_40%,rgb(4_11_23/0.75)_100%)]"
        />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          {/* Davlat belgisi */}
          <div
            className="reveal flex items-center gap-4"
            style={{ '--i': 0 } as CSSProperties}
          >
            <StateEmblem size={64} glow />
            <div className="min-w-0">
              <p className="font-mono text-[10.5px] font-semibold tracking-[0.22em] text-white/55 uppercase">
                O‘zbekiston Respublikasi
              </p>
              <p className="mt-1 font-display text-[19px] leading-6 font-[780] tracking-[-0.015em] [font-stretch:112%]">
                {BRAND.scope}
              </p>
              <span
                aria-hidden
                className="flag-ribbon mt-2 block h-[3px] w-24 rounded-full opacity-90"
              />
            </div>
          </div>

          <div className="max-w-2xl">
            <p
              className="reveal font-mono text-[11px] font-semibold tracking-[0.22em] text-heat-300 uppercase"
              style={{ '--i': 1 } as CSSProperties}
            >
              {BRAND.short} · 24/7
            </p>
            {/* ⚠️ h2, h1 EMAS: bu panel telefonda yashiriladi va sahifaning
                YAGONA h1 i forma sarlavhasi bo'lishi kerak («Tizimga kirish»). */}
            <h2
              className="reveal mt-4 font-display text-[clamp(40px,4.4vw,64px)] leading-[0.98] font-[820] tracking-[-0.035em] [font-stretch:118%]"
              style={{ '--i': 2 } as CSSProperties}
            >
              Hududlardagi qozonxonalar —{' '}
              <span className="thermal-text">bitta ekranda.</span>
            </h2>
            <p
              className="reveal mt-6 max-w-xl text-lede leading-relaxed text-white/65"
              style={{ '--i': 3 } as CSSProperties}
            >
              ESP32 modullari har bir qozonxonaning kirish-chiqish suvi va bino
              xonalari haroratini yuboradi. Tizim ularni me‘yor bilan
              solishtiradi va qaysi kotyol ishlayotganini, qaysi binoda sovuq
              qolganini real vaqtda ko‘rsatadi.
            </p>

            {/* Harorat shkalasi — tizim nimani o'lchashini bir qarashda. */}
            <div
              className="reveal mt-9 max-w-xl"
              style={{ '--i': 4 } as CSSProperties}
            >
              <div className="relative h-2.5 rounded-full bg-[linear-gradient(90deg,#64758b_0%,#c8362c_28%,#e09e21_45%,#118a56_62%,#34ad74_100%)] shadow-[0_0_24px_-4px_rgb(52_173_116/0.5)]">
                {[20, 40, 50, 60, 80].map((tick) => (
                  <span
                    key={tick}
                    aria-hidden
                    className="absolute top-full mt-2 -translate-x-1/2 font-mono text-[10px] text-white/45"
                    style={{ left: pct(tick) }}
                  >
                    {tick}°
                  </span>
                ))}
                <span
                  className="scale-marker absolute -top-2 -translate-x-1/2"
                  style={{ left: pct(60) }}
                >
                  <span className="block h-[26px] w-[3px] rounded-full bg-white shadow-[0_0_14px_rgb(255_255_255/0.9)]" />
                </span>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[11.5px] text-white/60">
                <Legend color="bg-ok-400" label="Faol · ≥ 50 °C" />
                <Legend color="bg-warn-400" label="O‘rta · 40–50 °C" />
                <Legend color="bg-danger-400" label="Ishlamayapti · 20–40 °C" />
                <Legend color="bg-idle-400" label="Aloqa yo‘q" />
              </div>
            </div>
          </div>

          <div
            className="reveal flex items-end justify-between gap-6"
            style={{ '--i': 5 } as CSSProperties}
          >
            <dl className="grid grid-cols-3 gap-8">
              <Stat value="16" label="tuman va shahar" />
              <Stat value="24/7" label="uzluksiz nazorat" plain />
              <Stat value="60 °C" label="me‘yoriy harorat" />
            </dl>
            <p className="max-w-[16rem] text-right font-mono text-[10px] leading-relaxed tracking-[0.08em] text-white/35 uppercase">
              © {new Date().getFullYear()} · {BRAND.full}
            </p>
          </div>
        </div>
      </aside>

      {/* ───── O'ng: forma ───── */}
      <main className="relative flex items-center justify-center overflow-hidden px-5 py-10 lg:shadow-[inset_1px_0_0_var(--border-subtle)]">
        <span
          aria-hidden
          className="grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(70%_60%_at_50%_45%,#000,transparent)]"
        />
        {/* Telefonda chap panel yo'q — tepadan brend nuri tushadi. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(65%_100%_at_50%_0%,rgb(22_115_214/0.2),transparent)] lg:hidden"
        />

        <div className="relative w-full max-w-sm">
          <div
            className="reveal mb-8 lg:hidden"
            style={{ '--i': 0 } as CSSProperties}
          >
            <Logo size="lg" />
            <span
              aria-hidden
              className="flag-ribbon mt-4 block h-[3px] w-24 rounded-full"
            />
          </div>

          <p
            className="reveal label-eyebrow flex items-center gap-2"
            style={{ '--i': 1 } as CSSProperties}
          >
            <ShieldCheck className="size-3.5 text-ok-500" />
            Himoyalangan kirish
          </p>
          <h1
            className="reveal title-display mt-3 text-title"
            style={{ '--i': 2 } as CSSProperties}
          >
            Tizimga kirish
          </h1>
          <p
            className="reveal mt-2 text-body text-muted"
            style={{ '--i': 3 } as CSSProperties}
          >
            Hisobingiz ma‘lumotlarini kiriting
          </p>

          <form
            onSubmit={handleSubmit}
            className="reveal mt-8 flex flex-col gap-4"
            style={{ '--i': 4 } as CSSProperties}
          >
            <Field label="Login" required>
              {(id) => (
                <Input
                  id={id}
                  value={form.login}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, login: event.target.value }))
                  }
                  autoComplete="username"
                  autoFocus
                  leading={<User className="size-4" />}
                  invalid={Boolean(error)}
                  className="h-11"
                />
              )}
            </Field>

            <Field label="Parol" required>
              {(id) => (
                <div className="relative">
                  <Input
                    id={id}
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        password: event.target.value,
                      }))
                    }
                    autoComplete="current-password"
                    leading={<Lock className="size-4" />}
                    invalid={Boolean(error)}
                    className="h-11 pr-10"
                  />
                  {/* ⚠️ «Ko'rsatish» tugmasi SHART: uzun parolni
                      ko'rmasdan kiritish xatolarning asosiy sababi. */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'
                    }
                    className="absolute inset-y-0 right-0 grid w-10 place-items-center text-faint transition-colors hover:text-strong"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              )}
            </Field>

            {error ? (
              <div
                key={attempt}
                role="alert"
                className="shake flex items-start gap-2 rounded-lg bg-danger-50 px-3 py-2.5 text-meta font-medium text-danger-700 ring-1 ring-danger-200 dark:bg-danger-500/10 dark:text-danger-300 dark:ring-danger-500/25"
              >
                <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-danger-500" />
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="group mt-2 h-12 w-full justify-center text-[15px]"
            >
              Kirish
              {!loading ? (
                <ArrowRight className="size-4 transition-transform duration-300 ease-out-expo group-hover:translate-x-1" />
              ) : null}
            </Button>
          </form>

          <p
            className="reveal mt-8 border-t border-[var(--border-subtle)] pt-5 text-center text-micro text-faint"
            style={{ '--i': 5 } as CSSProperties}
          >
            Parolni unutdingizmi? Tizim administratoriga murojaat qiling.
          </p>
        </div>
      </main>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function Stat({
  value,
  label,
  plain,
}: {
  value: string;
  label: string;
  /** Sanalmaydigan qiymat («24/7»). */
  plain?: boolean;
}) {
  return (
    <div>
      <dt className="font-display text-[30px] leading-none font-[800] tracking-[-0.03em] text-white [font-stretch:112%]">
        {plain ? value : <AnimatedNumber value={value} duration={1.6} />}
      </dt>
      <dd className="mt-2 font-mono text-[10px] tracking-[0.14em] text-white/50 uppercase">
        {label}
      </dd>
    </div>
  );
}
