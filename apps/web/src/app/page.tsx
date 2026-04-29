import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Button } from '@/components/button';
import {
  CheckIcon,
  ArrowRightIcon,
  StarIcon,
} from '@/components/icons';
import { ReviewSection } from '@/components/review-carousel';
import { DynamicPricingSection } from '@/components/dynamic-pricing';

export const metadata: Metadata = {
  title: 'PsyhoCourse | Онлайн-курс по психологии',
  description: 'Онлайн-курс по психологии от практикующего специалиста. Когнитивная психология, эмоциональный интеллект, работа со стрессом. Видеоуроки с практическими заданиями.',
  openGraph: {
    title: 'PsyhoCourse | Онлайн-курс по психологии',
    description: 'Онлайн-курс по психологии от практикующего специалиста. Видеоуроки с практическими заданиями.',
  },
};

/* ─── Hero ─── */
function HeroSection() {
  return (
    <section className="relative flex min-h-[92vh] flex-col items-center justify-center px-4 pt-20 pb-12">
      {/* Фоновый градиент — асимметричный */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 grain"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 30% 35%, rgba(166,124,82,0.08) 0%, transparent 60%), radial-gradient(ellipse 40% 40% at 80% 60%, rgba(61,107,79,0.05) 0%, transparent 50%)',
        }}
      />

      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-6 text-sm tracking-wide text-muted">
          видео-курс от практикующего психолога
        </p>

        <h1 className="text-[2.5rem] font-bold leading-[1.1] sm:text-5xl md:text-6xl lg:text-[4.25rem]">
          Понять себя,<br />
          чтобы изменить <span className="italic text-accent">жизнь</span>
        </h1>

        <p className="mx-auto mt-6 max-w-lg text-[15px] leading-relaxed text-muted sm:text-lg">
          Когнитивная психология, эмоциональный интеллект, работа со&nbsp;стрессом.
          24&nbsp;видеоурока с практическими заданиями. Только наука и практика.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link href="/auth/register">
            <Button size="lg">
              Начать обучение
              <ArrowRightIcon size={18} />
            </Button>
          </Link>
          <Link href="#inside" className="text-sm text-muted transition-colors hover:text-foreground">
            Что внутри ↓
          </Link>
        </div>
      </div>

      {/* Цифры — горизонтальная полоска с разделителями */}
      <div className="mt-20 flex items-center gap-6 text-center sm:gap-10">
        <div>
          <p className="font-heading text-2xl font-bold sm:text-3xl">24</p>
          <p className="mt-0.5 text-xs text-muted">урока</p>
        </div>
        <div className="h-8 w-px bg-foreground/10" />
        <div>
          <p className="font-heading text-2xl font-bold sm:text-3xl">40+</p>
          <p className="mt-0.5 text-xs text-muted">часов</p>
        </div>
        <div className="h-8 w-px bg-foreground/10" />
        <div>
          <p className="font-heading text-2xl font-bold sm:text-3xl">1 200+</p>
          <p className="mt-0.5 text-xs text-muted">студентов</p>
        </div>
      </div>
    </section>
  );
}

/* ─── О курсе — свободная верстка, не сетка карточек ─── */
function AboutSection() {
  return (
    <section id="about" className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6">
      <div className="grid gap-14 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <div>
          <div className="accent-line mb-6" />
          <h2 className="text-2xl font-bold sm:text-3xl lg:text-[2.25rem] leading-tight">
            Психология как инструмент <br className="hidden sm:block" />для повседневной жизни
          </h2>
          <p className="mt-5 text-[15px] leading-[1.7] text-muted">
            Если вы хотите лучше понимать свои реакции, разобраться
            в&nbsp;привычных сценариях поведения и выстроить более здоровые отношения
            с&nbsp;близкими, этот курс для вас.
          </p>
          <p className="mt-3 text-[15px] leading-[1.7] text-muted">
            В каждом уроке есть теория и конкретные упражнения,
            которые можно попробовать в тот же день.
          </p>

          <ul className="mt-8 space-y-3.5">
            {[
              'Научный подход: когнитивная и поведенческая психология',
              'Практические задания к каждому уроку',
              'Новые материалы каждый месяц',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-foreground/75">
                <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/12">
                  <CheckIcon size={10} className="text-accent" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Правый блок — цитата-карточка вместо шаблонной иконки */}
        <div className="relative">
          <blockquote className="rounded-2xl bg-warm/50 p-8 sm:p-10">
            <p className="font-heading text-lg font-semibold leading-snug italic text-foreground/90 sm:text-xl">
              «Когда начинаешь замечать свои привычные реакции, многое в жизни становится понятнее.»
            </p>
            <footer className="mt-5 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-accent/15 flex items-center justify-center text-accent font-heading font-bold text-sm">
                АК
              </div>
              <div>
                <p className="text-sm font-medium">Автор курса</p>
                <p className="text-xs text-muted">Практикующий психолог</p>
              </div>
            </footer>
          </blockquote>

          {/* Плавающая карточка с рейтингом */}
          <div className="absolute -bottom-5 -left-3 hidden rounded-xl border border-foreground/5 bg-surface px-4 py-3 card-shadow sm:block">
            <p className="text-[11px] text-muted">Средняя оценка</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <StarIcon size={13} className="text-accent" />
              <span className="font-heading text-lg font-bold leading-none">4.9</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Как это работает — 3 шага ─── */
function HowItWorksSection() {
  return (
    <section className="bg-warm/30 py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="accent-line mb-6" />
        <h2 className="text-2xl font-bold sm:text-3xl">Как проходит обучение</h2>

        <div className="mt-14 grid gap-10 sm:grid-cols-3">
          {[
            {
              step: '01',
              title: 'Смотрите уроки',
              desc: 'Видео в хорошем качестве, удобный плеер. Смотрите в своём темпе.',
            },
            {
              step: '02',
              title: 'Выполняете практику',
              desc: 'К каждому уроку есть задание, которое можно сделать прямо сегодня.',
            },
            {
              step: '03',
              title: 'Замечаете изменения',
              desc: 'Прогресс сохраняется. Возвращайтесь к пройденному, двигайтесь дальше.',
            },
          ].map((s, i) => (
            <div key={s.step} className="relative">
              <span className="font-heading text-6xl font-bold text-accent/[0.07] leading-none absolute -top-6 -left-1 select-none">
                {s.step}
              </span>
              <div className="relative pt-12">
                <h3 className="text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.desc}</p>
              </div>
              {/* Соединительная линия */}
              {i < 2 && (
                <div className="hidden sm:block absolute top-12 -right-5 w-10 border-t border-dashed border-foreground/10" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Для кого и Преимущества — объединённая секция ─── */
function WhyThisCourseSection() {
  return (
    <section id="for-whom" className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
      <div className="grid gap-16 lg:grid-cols-2 lg:items-start">
        {/* Левая колонка — для кого */}
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-accent/70 mb-3">Для кого</p>
          <h2 className="text-2xl font-bold sm:text-3xl leading-tight">
            Кому подойдёт курс
          </h2>

          <div className="mt-8 space-y-5">
            {[
              { who: 'Хотите лучше понимать себя', why: 'Замечаете, что повторяете одни и те же ошибки? Здесь разберёмся, почему так происходит.' },
              { who: 'Работаете с людьми', why: 'Педагоги, руководители, специалисты по работе с людьми. Психология помогает в любой профессии.' },
              { who: 'Хотите наладить отношения', why: 'Конфликты, границы, привязанность. Разбираем на конкретных примерах.' },
              { who: 'Устали от тревоги и стресса', why: 'Проверенные техники, которые реально помогают справляться.' },
            ].map((a) => (
              <div key={a.who} className="flex gap-4">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent/60" />
                <div>
                  <p className="text-sm font-medium text-foreground/90">{a.who}</p>
                  <p className="mt-0.5 text-sm text-muted">{a.why}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Правая колонка — преимущества платформы */}
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-accent/70 mb-3">Удобство</p>
          <h2 className="text-2xl font-bold sm:text-3xl leading-tight">
            Как устроено обучение
          </h2>

          <div className="mt-8 space-y-4">
            {[
              { title: 'Удобный плеер', desc: 'Смотрите видео на любой скорости, с субтитрами.' },
              { title: 'Подстройка качества', desc: 'Видео подстраивается под скорость вашего интернета.' },
              { title: 'Запоминаем, где вы остановились', desc: 'Продолжайте просмотр с того же места.' },
              { title: 'Работает на любом устройстве', desc: 'Телефон, планшет, компьютер.' },
              { title: 'Безопасная оплата', desc: 'Оплата через ЮKassa. Отмена подписки в любой момент.' },
            ].map((f) => (
              <div key={f.title} className="flex gap-4 rounded-lg border border-foreground/5 bg-surface/60 px-5 py-4 transition-colors hover:border-accent/15">
                <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-green/60" />
                <div>
                  <p className="text-sm font-medium">{f.title}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Что внутри — 3 категории контента ─── */
function WhatsInsideSection() {
  const categories = [
    {
      title: 'Видео лекции',
      desc: 'Глубокие видеозанятия по когнитивной психологии, эмоциональному интеллекту и психологии отношений. Теория с практическими заданиями.',
      items: [
        'Когнитивные искажения и как ими управлять',
        'Эмоциональный интеллект на практике',
        'Психология отношений и границ',
        'Работа со стрессом и тревогой',
      ],
      accent: 'rgba(166,124,82,0.07)',
    },
    {
      title: 'Аффирмации',
      desc: 'Короткие аудио и видеоматериалы для ежедневной практики. Помогают закрепить новые установки мышления.',
      items: [
        'Утренние и вечерние практики',
        'Работа с внутренним диалогом',
        'Техники осознанности',
        'Закрепление положительного мышления',
      ],
      accent: 'rgba(61,107,79,0.07)',
    },
    {
      title: 'Статьи',
      desc: 'Практические руководства в формате PDF для чтения и хранения. Стратегии, схемы, чек-листы по темам курса.',
      items: [
        'Схемы и инструменты психологии',
        'Практические чек-листы',
        'Разбор конкретных ситуаций',
        'Дополнительные материалы к урокам',
      ],
      accent: 'rgba(166,124,82,0.04)',
    },
  ];

  return (
    <section id="inside" className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-12">
        <div>
          <div className="accent-line mb-5" />
          <h2 className="text-2xl font-bold sm:text-3xl">Что внутри</h2>
          <p className="mt-2 text-sm text-muted">Три формата материалов — выбирайте удобный для вас</p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          Открыть кабинет
          <ArrowRightIcon size={15} />
        </Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        {categories.map((cat) => (
          <div
            key={cat.title}
            className="relative overflow-hidden rounded-2xl border border-foreground/[0.07] bg-surface p-6 transition-all hover:border-accent/20 hover:shadow-md hover:shadow-foreground/[0.04] hover:-translate-y-0.5"
          >
            <div
              className="pointer-events-none absolute inset-0 grain opacity-70"
              style={{ background: `radial-gradient(ellipse 80% 70% at 20% 90%, ${cat.accent} 0%, transparent 65%)` }}
            />

            <h3 className="font-heading text-lg font-semibold text-foreground mb-2">{cat.title}</h3>
            <p className="text-[13px] leading-relaxed text-muted mb-5">{cat.desc}</p>

            <ul className="space-y-2">
              {cat.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[13px] text-foreground/70">
                  <CheckIcon size={13} className="text-accent mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Отзывы ─── */
function TestimonialsSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 mb-12">
        <div className="accent-line mb-5" />
        <h2 className="text-2xl font-bold sm:text-3xl">Что говорят студенты</h2>
      </div>
      <ReviewSection />
    </section>
  );
}

/* ─── Стоимость ─── */
function PricingSection() {
  return (
    <section id="tariffs" className="bg-warm/30 py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold sm:text-3xl">Тарифы</h2>
          <p className="mt-2 text-[15px] text-muted">
            Полный доступ ко всем урокам. Без скрытых платежей.
          </p>
        </div>
        <DynamicPricingSection />
      </div>
    </section>
  );
}

/* ─── FAQ ─── */
function FAQSection() {
  const faqs = [
    {
      q: 'Нужен ли опыт в психологии?',
      a: 'Нет, опыт не нужен. Всё объясняем с нуля, понятным языком.',
    },
    {
      q: 'Как долго действует подписка?',
      a: 'Подписка помесячная. Можно отменить в любой момент в личном кабинете, доступ сохранится до конца оплаченного периода.',
    },
    {
      q: 'Можно ли смотреть с телефона?',
      a: 'Да, сайт работает на телефоне, планшете и компьютере.',
    },
    {
      q: 'Будут ли новые уроки?',
      a: 'Да, мы добавляем новые материалы каждый месяц. Подписчики получают доступ ко всем обновлениям.',
    },
    {
      q: 'Можно ли задать вопрос автору?',
      a: 'Конечно. Если что-то непонятно в уроке, пишите, и автор ответит.',
    },
  ];

  return (
    <section id="faq" className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
      <div className="accent-line mx-auto mb-5" />
      <h2 className="text-center text-2xl font-bold sm:text-3xl">Вопросы и ответы</h2>

      <div className="mt-10 space-y-3">
        {faqs.map((f) => (
          <details
            key={f.q}
            className="group rounded-lg border border-foreground/5 bg-surface/50 px-5 py-4 transition-all hover:border-accent/15 [&[open]]:border-accent/20 [&[open]]:bg-surface"
          >
            <summary className="flex cursor-pointer items-center justify-between text-[15px] font-medium text-foreground marker:content-[''] list-none select-none">
              <span>{f.q}</span>
              <svg
                className="h-4 w-4 shrink-0 text-foreground/25 transition-transform duration-200 group-open:rotate-180 group-open:text-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </summary>
            <p className="mt-3 text-[14px] leading-relaxed text-muted pr-8">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ─── CTA ─── */
function CTASection() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="relative overflow-hidden rounded-2xl bg-foreground/[0.03] px-6 py-14 text-center sm:px-12 grain">
        <h2 className="text-2xl font-bold sm:text-3xl">
          Готовы начать?
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          Доступ ко всем урокам сразу после регистрации. Более 1 200 человек уже учатся.
        </p>
        <Link href="/auth/register" className="mt-8 inline-block">
          <Button size="lg">
            Создать аккаунт
            <ArrowRightIcon size={18} />
          </Button>
        </Link>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <AboutSection />
        <HowItWorksSection />
        <WhyThisCourseSection />
        <WhatsInsideSection />
        <TestimonialsSection />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
