import { Eye, EyeOff, Flame, Lock, LogIn, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '@/shared/api/client';
import { Logo } from '@/layouts/components/Logo';
import { Button, Field, Input } from '@/shared/ui';
import { useAuthStore } from '@/store/auth.store';

interface LocationState {
  from?: string;
}

/**
 * KIRISH SAHIFASI.
 *
 * ⚠️ Ikki ustunli: chapda forma, o'ngda domen tavsifi. Sabab — bu
 * davlat tizimi va unga kiradigan odam ko'pincha havola orqali
 * keladi: ekran «qaysi tizim» ekanini aytib turishi kerak. Faqat
 * forma bo'lsa, u istalgan panelga o'xshardi.
 *
 * ⚠️ O'ng ustun KICHIK ekranda butunlay yashiriladi, siqilmaydi:
 * telefonda ikki ustun bir-birining ustiga tushib, forma pastga
 * surilib ketardi.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);

  const [form, setForm] = useState({ login: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);

    if (!form.login.trim() || !form.password) {
      setError('Login va parolni kiriting');
      return;
    }

    setLoading(true);
    try {
      await login(form.login.trim(), form.password);
      const from = (location.state as LocationState | null)?.from;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Tizimga kirib bo‘lmadi'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,520px)]">
      {/* ───── Chap: brend paneli ───── */}
      <aside className="relative hidden overflow-hidden bg-brand-900 lg:block">
        {/* Nozik to'r naqsh — yassi to'q ko'k maydon «bo'yalgan devor»
            bo'lib ko'rinardi. */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
          aria-hidden
        />
        <div
          className="absolute -top-32 -left-24 size-[420px] rounded-full bg-brand-500/25 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute right-0 -bottom-24 size-[360px] rounded-full bg-[#ffb454]/12 blur-3xl"
          aria-hidden
        />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-tile bg-white/10 ring-1 ring-white/15">
              <Flame className="size-5 text-[#ffb454]" />
            </span>
            <div className="leading-none">
              <p className="text-lede font-semibold text-white">Issiqlik</p>
              <p className="mt-1 text-nano font-medium tracking-wide text-white/55 uppercase">
                Andijon viloyati
              </p>
            </div>
          </div>

          <div className="max-w-md">
            <h1 className="text-[34px] leading-[1.15] font-semibold tracking-tight text-white">
              Hududlardagi qozonxonalar — bitta ekranda
            </h1>
            <p className="mt-4 text-lede leading-relaxed text-white/65">
              ESP32 modullari har bir qozonxonaning chiqish haroratini
              yuboradi. Tizim uni me‘yor bilan solishtiradi va qaysi
              kotyol ishlayotganini, qaysi biri to‘xtaganini real vaqtda
              ko‘rsatadi.
            </p>

            <dl className="mt-8 grid grid-cols-3 gap-4">
              {[
                { term: '16', detail: 'tuman va shahar' },
                { term: '24/7', detail: 'uzluksiz nazorat' },
                { term: '60 °C', detail: 'me‘yoriy harorat' },
              ].map((item) => (
                <div key={item.term}>
                  <dt className="text-sub font-semibold text-white">
                    {item.term}
                  </dt>
                  <dd className="mt-0.5 text-meta text-white/55">
                    {item.detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="text-micro text-white/40">
            © {new Date().getFullYear()} · Issiqlik ta‘minoti monitoring tizimi
          </p>
        </div>
      </aside>

      {/* ───── O'ng: forma ───── */}
      <main className="flex items-center justify-center bg-[var(--canvas)] px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-7 lg:hidden">
            <Logo />
          </div>

          <h2 className="text-display font-semibold tracking-tight text-strong">
            Tizimga kirish
          </h2>
          <p className="mt-1 text-body text-muted">
            Hisobingiz ma‘lumotlarini kiriting
          </p>

          <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
            <Field label="Login" required>
              {(id) => (
                <Input
                  id={id}
                  value={form.login}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, login: event.target.value }))
                  }
                  placeholder="Issqilik2026"
                  autoComplete="username"
                  autoFocus
                  leading={<User className="size-4" />}
                  invalid={Boolean(error)}
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
                    placeholder="••••••••"
                    autoComplete="current-password"
                    leading={<Lock className="size-4" />}
                    invalid={Boolean(error)}
                    className="pr-10"
                  />
                  {/* ⚠️ «Ko'rsatish» tugmasi SHART: uzun parolni
                      ko'rmasdan kiritish xatolarning asosiy sababi va
                      operator nima uchun kira olmayotganini bilmasdi. */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
                    className="absolute inset-y-0 right-0 grid w-10 place-items-center text-faint transition-colors hover:text-ink"
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
                role="alert"
                className="rounded-lg bg-danger-50 px-3 py-2.5 text-meta font-medium text-danger-700 ring-1 ring-danger-200 dark:bg-danger-500/10 dark:text-danger-300 dark:ring-danger-500/25"
              >
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              icon={<LogIn className="size-4" />}
              className="mt-1 w-full justify-center"
            >
              Kirish
            </Button>
          </form>

          <p className="mt-7 text-center text-micro text-faint">
            Parolni unutdingizmi? Tizim administratoriga murojaat qiling.
          </p>
        </div>
      </main>
    </div>
  );
}
