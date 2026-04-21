import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Политика конфиденциальности',
  description: 'Политика конфиденциальности PsyhoCourse: обработка данных, cookie, права пользователей по GDPR.',
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 pt-28 pb-16 sm:px-6">
        <h1 className="font-heading text-3xl font-bold sm:text-4xl">Политика конфиденциальности</h1>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted">
          <section>
            <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">1. Сбор данных</h2>
            <p>
              Платформа PsyhoCourse собирает минимальные персональные данные, необходимые
              для предоставления сервиса: адрес электронной почты, данные об&nbsp;оплате
              (обрабатываются платёжной системой ЮKassa), а&nbsp;также данные о&nbsp;прогрессе
              обучения.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">2. Использование данных</h2>
            <p>
              Собранные данные используются исключительно для: предоставления доступа к
              материалам курса, обработки платежей, отправки уведомлений о&nbsp;курсе
              и&nbsp;улучшения качества сервиса.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">3. Хранение данных</h2>
            <p>
              Персональные данные хранятся на защищённых серверах. Доступ к&nbsp;базе данных ограничен и&nbsp;защищён.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">4. Передача третьим лицам</h2>
            <p>
              Платформа не передаёт персональные данные третьим лицам, за исключением
              случаев, предусмотренных законодательством, а&nbsp;также передачи данных
              платёжной системе для обработки платежей.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">5. Cookies</h2>
            <p>
              Платформа использует технические cookie-файлы для поддержания сессии
              авторизации. Рекламные и&nbsp;аналитические cookie не используются.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">6. Права пользователя</h2>
            <p>
              Пользователь имеет право запросить удаление своих персональных данных,
              отправив запрос через поддержку. Данные будут удалены в течение 30&nbsp;дней,
              за исключением данных, которые обязаны храниться по закону.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">7. Контакты</h2>
            <p>
              По вопросам, связанным с персональными данными, вы можете обратиться
              к администрации платформы через форму обратной связи.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
