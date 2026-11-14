# Issiqlik — frontend

Qozonxonalarni real vaqtda monitoring qilish tizimining veb-interfeysi.

**Stek:** React 19 · Vite · TypeScript · Tailwind CSS v4 · Zustand ·
TanStack Query · Leaflet · Recharts · Socket.IO

Backend alohida papkada: `../Issiqlik`

---

## 1. Ishga tushirish

```bash
npm install
cp .env.example .env     # VITE_API_URL ni tekshiring
npm run dev              # http://localhost:5173
```

⚠️ Port **5173** qat'iy (`strictPort`): backend CORS ro'yxatida aynan
shu manzil bor. Port band bo'lsa Vite boshqasiga o'tib ketsa, har so'rov
brauzerda bloklanardi va server jurnalida hech narsa ko'rinmasdi.

---

## 2. Dizayn tizimi

Barcha ranglar, o'lchamlar va soyalar — `src/index.css` dagi tokenlar.
Komponentlarda hex qiymat **yozilmaydi**.

### Ranglar

| Oila | Vazifa |
|---|---|
| `brand` (to'q ko'k) | logotip, asosiy tugma, faol tab, fokus halqasi |
| `ok` (yashil) | **Faol ishlayotgan** — ≥ 50 °C |
| `warn` (sariq) | **O'rta ishlayotgan** — 40–50 °C |
| `danger` (qizil) | **Ishlamayotgan** — 20–40 °C |
| `idle` (kulrang) | **Aloqa yo'q** — betaraf, «avariya» emas |

⚠️ Brend ko'k, holat ranglari esa yashil/sariq/qizil — ular **hech
qachon chalkashmaydi**. Agar brend ham yashil bo'lsa, «faol menyu» bilan
«faol kotyol» bir xil rangda bo'lib qolardi.

⚠️ Holat ranglarining hex qiymatlari `src/shared/constants/status.ts` da
ham bor va CSS tokenlari bilan **mos turishi shart**: Leaflet (`divIcon`
HTML satri) va Recharts (SVG `fill`) CSS o'zgaruvchisini o'qiy olmaydi.

### Tartib

**Yuqori gorizontal nav** (yon panel emas) — sabab: asosiy ekran
**xarita** va u iloji boricha keng bo'lishi kerak. 240 px lik yon panel
noutbuk ekranida xaritaning oltidan birini yeb qo'yardi.

Faol tab — to'ldirilgan **yumaloq** (pill), tagidagi chiziq emas: chiziq
och fonda zaif ko'rinadi.

---

## 3. Tuzilma

```
src/
├── app/            # router (lazy sahifalar), providers
├── layouts/        # AppLayout + TopNav, DistrictFilter, Logo
├── shared/
│   ├── api/        # axios mijoz (token yangilash), endpointlar, tiplar
│   ├── constants/  # holat meta'si, menyu
│   ├── hooks/      # useRealtime (WebSocket), useDebounce
│   ├── ui/         # Card, StatCard, Button, Field, Table, Modal…
│   └── utils/      # cn, sana (o'zbekcha), son formati
├── store/          # auth, filters (tanlangan tumanlar), ui (mavzu)
└── features/
    ├── auth        dashboard     map
    ├── boilers     devices       alerts
    ├── catalogs    responsibles  users      settings
```

### Tuman mas'ullari (`features/responsibles`)

Har bir tuman uchun alohida hisob yaratish ekrani.

⚠️ Ro'yxat **TUMANLARDAN** boshlanadi, foydalanuvchilardan emas — va
mas'ulsiz tumanlar **ro'yxat boshida**, ajratib ko'rsatiladi.
Foydalanuvchilar ro'yxati bo'lsa, mas'uli yo'q tuman umuman
ko'rinmasdi; holbuki ekranning butun maqsadi aynan shu bo'shliqni
ko'rsatish.

⚠️ Parol `crypto.getRandomValues` bilan generatsiya qilinadi
(`Math.random()` EMAS — u bashorat qilinadi), alifboda chalkashadigan
belgilar yo'q (`0/O`, `1/l/I`) — parol qog'ozga yozib topshiriladi.

⚠️ Yaratilgandan keyin login+parol **bir marta** ko'rsatiladi
(`CredentialsModal`): serverda faqat hash bor, oyna yopilgach parolni
qayta olib bo'lmaydi — faqat yangisini generatsiya qilish mumkin.

### Muhim qarorlar

| Qaror | Sabab |
|---|---|
| Tuman filtri **umumiy** (`filters.store`) | Xaritada Jalaquduqni tanlab, ro'yxatga o'tgan odam butun viloyatni ko'rsa, buni xato deb o'qiydi |
| Xarita **har doim hamma tumanni** so'raydi | Tanlov rang bilan ko'rsatiladi; tanlanganlarnigina so'rasak, qolgan tumanlar yo'qolib, tanlovni bekor qilib bo'lmasdi |
| WebSocket hodisasi **keshni bekor qiladi**, qo'lda yozmaydi | Agregatlarni mijozda hisoblash server hisobidan asta-sekin ajralib ketardi |
| Token yangilash — **bitta va'da** | Dashboard 8 ta parallel so'rov yuboradi; har biri alohida `refresh` yuborsa, rotatsiya tufayli 7 tasi tizimdan chiqarib yuborardi |
| Sahifalar **lazy** | Leaflet + Recharts ~550 KB; login sahifasi ularni yuklamasligi kerak |
| Nuqtalar **faqat tanlov bo'lganda** | Butun viloyat bo'yicha ~1700 marker — Leaflet har birini DOM elementi qilib chizadi va xarita qotib qoladi |

---

## 4. Sana formati (qat'iy)

| Nima | Ko'rinishi |
|---|---|
| Kun | `21-may, 2025` |
| Kun + vaqt | `21-may, 2025 14:30` |
| Oy | `Yanvar, 2026` |
| Bo'sh qiymat | `—` |

⚠️ `toLocaleDateString('uz-UZ')` **taqiqlanadi**: natija kod ishlayotgan
muhitga bog'liq va bitta jadvalda ikki xil format paydo bo'lardi. Faqat
`src/shared/utils/date.ts`.

---

## 5. Buyruqlar

```bash
npm run dev          # dev server (5173)
npm run build        # tsc -b && vite build
npm run typecheck    # tiplarni tekshirish
npm run preview      # build natijasini ko'rish
```

---

## 6. Xarita va fon (basemap)

Xarita — **[Leaflet](https://leafletjs.com/)**. ⚠️ Leaflet'ning o'zida
xarita YO'Q: u faqat **render** qiladi va taylarni (256×256 rasm
bo'laklari) tashqi serverdan oladi.

**Sukut bo'yicha — OpenStreetMap:** bepul, **API kalit va bank kartasi
kerak emas**. Xarita ustidagi qatlam tugmasi bilan fonni o'chirib,
toza ko'k ko'rinishga qaytish mumkin.

⚠️ **Atributsiya olib tashlanmaydi.** OpenStreetMap ma'lumoti ODbL
litsenziyasida — manba ko'rsatilmasa, foydalanish litsenziyani buzadi.
Leaflet uni o'zi boshqaradi: tayl qatlami qo'shilganda «© OpenStreetMap
hissadorlari» paydo bo'ladi, olib tashlanganda yo'qoladi.

⚠️ Qorong'i rejimda taylar CSS filtri bilan teskari rangga o'tkaziladi
(`invert` + `hue-rotate`): OSM faqat och uslubda taylar beradi va to'q
interfeysda ular ko'zni qamashtiruvchi oq maydon bo'lib qolardi.
Filtr **faqat tayl qatlamiga** qo'llanadi — butun xaritaga qo'llansa,
holat ranglari ham teskari bo'lib, yashil «faol» qizil ko'rinardi.

### Boshqa xizmatga o'tish

Faqat ikki qatorni to'ldiring, kodga tegish shart emas:

```ini
VITE_BASEMAP_URL=https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=KALIT
VITE_BASEMAP_ATTRIBUTION=&copy; MapTiler &copy; OpenStreetMap hissadorlari
```

⚠️ Google Maps taylarini Leaflet'ga to'g'ridan-to'g'ri ulab **bo'lmaydi**
(litsenziya taqiqlaydi) — buning uchun Google'ning o'z JS API si va
billing hisobi kerak.

## 7. Muhit o'zgaruvchilari

```ini
VITE_API_URL=http://localhost:3000/api/v1   # oxirida / QO'YILMAYDI
VITE_SOCKET_URL=http://localhost:3000
VITE_BASEMAP_URL=                            # bo'sh = OpenStreetMap
VITE_BASEMAP_ATTRIBUTION=
```

⚠️ Xato manzil qo'yilsa, tayl serveri xato **matnini** rasm sifatida
qaytarib, xaritani suv belgilari bilan to'ldiradi — manzilni brauzerda
bir marta ochib tekshiring.
