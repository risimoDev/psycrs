# DRM (Widevine / FairPlay) — Руководство по настройке

## Обзор

Платформа поддерживает два режима DRM-защиты видеоконтента:

| Режим         | Требования                       | Уровень защиты |
| ------------- | -------------------------------- | -------------- |
| **Clear Key** | Нет (встроено)                   | Средний        |
| **Widevine**  | Коммерческий DRM-сервер лицензий | Высокий        |

### Текущая защита (без DRM)

- HLS AES-128 шифрование сегментов
- AES-256-GCM шифрование токена
- Аутентифицированная доставка ключей
- IP-привязка токенов
- Водяные знаки (canvas overlay)
- Аудит-логирование доступа

### Что добавляет DRM

- **CENC-шифрование** — стандартизированное шифрование DASH-сегментов (Common Encryption)
- **Clear Key** — ключ доставляется через EME API браузера; защищает от простого копирования
- **Widevine L1/L3** — ключ расшифровки НИКОГДА не виден JavaScript; обрабатывается аппаратным/программным CDM

---

## Архитектура

```
┌──────────┐    1. Загрузка     ┌──────────┐
│  Админ   │───────────────────>│  source   │
└──────────┘                    │   .mp4    │
                                └────┬─────┘
                                     │
                       ┌─────────────┼─────────────┐
                       ▼             ▼              ▼
                 ┌──────────┐ ┌──────────┐  ┌──────────────┐
                 │  HLS     │ │  DASH    │  │ Shaka        │
                 │ AES-128  │ │ CENC     │  │ Packager     │
                 │ (FFmpeg) │ │ (Shaka)  │  │ --raw-key    │
                 └──────────┘ └──────────┘  └──────────────┘
                       │             │
                       ▼             ▼
                 ┌─────────────────────────┐
                 │      Shaka Player       │
                 │  (HLS fallback / DASH   │
                 │   + ClearKey/Widevine)  │
                 └─────────────────────────┘
```

---

## Установка Shaka Packager

Shaka Packager — бесплатный инструмент от Google для упаковки медиа с DRM.

### Windows

```powershell
# Скачать последний релиз
Invoke-WebRequest -Uri "https://github.com/shaka-project/shaka-packager/releases/latest/download/packager-win-x64.exe" -OutFile "C:\tools\packager.exe"

# Проверить
C:\tools\packager.exe --version
```

### Linux

```bash
wget https://github.com/shaka-project/shaka-packager/releases/latest/download/packager-linux-x64
chmod +x packager-linux-x64
sudo mv packager-linux-x64 /usr/local/bin/packager
```

---

## Настройка

### 1. Clear Key (работает сразу)

```env
# .env (apps/api)
DRM_ENABLED=true
DRM_MODE=clearkey
SHAKA_PACKAGER_PATH=C:/tools/packager.exe   # или /usr/local/bin/packager
```

Ключи генерируются автоматически при процессинге видео. Доставка ключей через EME Clear Key — ключ передаётся браузеру напрямую через JavaScript.

**Важно**: Clear Key НЕ скрывает ключ от пользователя (он виден в DevTools). Это защита от случайного копирования, но не от целенаправленного пиратства.

### 2. Widevine (коммерческий DRM)

```env
DRM_ENABLED=true
DRM_MODE=widevine
SHAKA_PACKAGER_PATH=/usr/local/bin/packager
DRM_LICENSE_SERVER_URL=https://your-drm-provider.com/license
DRM_SIGNING_KEY=your-signing-key
```

#### Получение лицензии Widevine

Для Widevine необходим контракт с DRM-провайдером:

| Провайдер    | Сайт         | Примерная цена |
| ------------ | ------------ | -------------- |
| **PallyCon** | pallycon.com | от $300/мес    |
| **BuyDRM**   | buydrm.com   | от $500/мес    |
| **Axinom**   | axinom.com   | по запросу     |
| **EZDRM**    | ezdrm.com    | от $250/мес    |
| **CastLabs** | castlabs.com | по запросу     |

Процесс:

1. Зарегистрироваться у DRM-провайдера
2. Получить URL лицензирования и ключи подписи
3. Настроить env-переменные
4. Процессировать видео с помощью Shaka Packager (автоматически при загрузке)

---

## Процессинг видео для DRM

После включения DRM (`DRM_ENABLED=true`), при загрузке видео через админ-панель автоматически выполняется:

1. **FFmpeg** — транскодирование в HLS (360p/480p/720p) с AES-128 (обычный путь)
2. **FFmpeg** — транскодирование промежуточных MP4 для каждого качества
3. **Shaka Packager** — упаковка MP4 в DASH+CENC с указанным режимом DRM

Результат на диске:

```
storage/videos/{videoId}/
├── source.mp4
├── master.m3u8            # HLS (fallback)
├── 360p/
│   ├── index.m3u8
│   ├── enc.key
│   └── segment*.ts
├── 480p/...
├── 720p/...
├── dash/                   # DASH+CENC
│   ├── manifest.mpd
│   ├── 360p.mp4           # intermediate
│   ├── 480p.mp4
│   ├── 720p.mp4
│   ├── 360p_video.mp4     # CENC encrypted
│   ├── 480p_video.mp4
│   ├── 720p_video.mp4
│   └── audio.mp4
└── drm/
    └── keyinfo.json        # key ID + content key
```

---

## FairPlay (Apple)

FairPlay Streaming требует:

1. **Apple Developer Program** ($99/год)
2. **FairPlay Streaming Deployment Package** — заказывается через Apple
3. **Сертификат FPS** (.cer файл)

Платформа подготовлена к интеграции, но полная поддержка FairPlay требует:

- Получения сертификата от Apple
- Настройки HLS с SAMPLE-AES шифрованием (вместо AES-128)
- Реализации SPC/CKC обмена на сервере

FairPlay работает **только** в Safari и на устройствах Apple.

---

## Клиентская часть

Фронтенд автоматически определяет наличие DRM:

1. Если `requestPlayback` возвращает `drm` — используется **Shaka Player** с DASH+CENC
2. Если DRM не настроен — используется **hls.js** с HLS+AES-128 (стандартный путь)

Shaka Player поддерживает:

- Clear Key (все браузеры)
- Widevine L1/L3 (Chrome, Firefox, Edge, Android)
- FairPlay (Safari — при настройке)

---

## Сравнение уровней защиты

| Мера                 | Без DRM | Clear Key | Widevine L3 | Widevine L1 |
| -------------------- | ------- | --------- | ----------- | ----------- |
| Шифрование сегментов | AES-128 | CENC      | CENC        | CENC        |
| Ключ виден в JS      | Да      | Да        | Нет         | Нет         |
| Аппаратная защита    | Нет     | Нет       | Нет         | Да          |
| Защита от скриншотов | Нет     | Нет       | Нет         | Да (HDCP)   |
| Цена                 | $0      | $0        | $250+/мес   | $250+/мес   |
