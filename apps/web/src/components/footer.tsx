import Link from 'next/link';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-foreground/5">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-3">
          {/* Бренд */}
          <div>
            <Link
              href="/"
              className="font-heading text-xl font-bold text-foreground"
              aria-label="PsyhoCourse"
            >
              Psyho<span className="text-accent">Course</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-muted max-w-[240px]">
              Структурированный онлайн-курс по психологии от практикующего специалиста.
            </p>
          </div>

          {/* Навигация */}
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-foreground/40 mb-4">Навигация</p>
            <nav className="flex flex-col gap-3 text-[15px]" aria-label="Дополнительная навигация">
              <Link href="/#program" className="text-muted transition-colors hover:text-foreground w-fit">
                Программа
              </Link>
              <Link href="/#pricing" className="text-muted transition-colors hover:text-foreground w-fit">
                Стоимость
              </Link>
              <Link href="/#faq" className="text-muted transition-colors hover:text-foreground w-fit">
                Вопросы и ответы
              </Link>
            </nav>
          </div>

          {/* Юридическое */}
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-foreground/40 mb-4">Правовая информация</p>
            <nav className="flex flex-col gap-3 text-[15px]">
              <Link href="/terms" className="text-muted transition-colors hover:text-foreground w-fit">
                Условия использования
              </Link>
              <Link href="/privacy" className="text-muted transition-colors hover:text-foreground w-fit">
                Политика конфиденциальности
              </Link>
            </nav>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-foreground/5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-foreground/30">
            © {year} PsyhoCourse
          </p>
          <p className="text-xs text-foreground/30">
            Все права защищены
          </p>
        </div>
      </div>
    </footer>
  );
}
