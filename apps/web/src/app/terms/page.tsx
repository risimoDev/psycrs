import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Условия использования',
  description: 'Условия использования PsyhoCourse: подписка, интеллектуальная собственность, возврат, ответственность.',
};

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 pt-28 pb-16 sm:px-6">
        <h1 className="font-heading text-3xl font-bold sm:text-4xl">Условия использования</h1>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted">
          <section>
            <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">1. Общие положения</h2>
            <p>
              Настоящие Условия использования (далее - «Условия») регулируют отношения между
              владельцем платформы PsyhoCourse (далее - «Платформа») и пользователем
              (далее - «Пользователь»), возникающие при использовании сервиса.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">2. Подписка и оплата</h2>
            <p>
              Доступ к материалам курса предоставляется по подписке. Подписка оформляется на
              ежемесячной основе. Оплата производится рекуррентными платежами через платёжную
              систему ЮKassa. Пользователь может отменить подписку в любой момент через личный
              кабинет - доступ сохраняется до конца оплаченного периода.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">3. Интеллектуальная собственность</h2>
            <p>
              Все материалы курса, включая видео, тексты и графику, являются интеллектуальной
              собственностью Платформы. Копирование, распространение и публичный показ
              материалов без письменного разрешения запрещены.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">4. Ответственность</h2>
            <p>
              Материалы курса носят информационно-образовательный характер и не являются
              медицинской или психотерапевтической помощью. Платформа не несёт ответственности
              за результаты применения полученных знаний.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">5. Возврат средств</h2>
            <p>
              Возврат средств возможен в течение 14&nbsp;дней с момента первой оплаты, если
              пользователь просмотрел менее 20% материалов курса. Для оформления возврата
              свяжитесь с поддержкой.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">6. Изменение условий</h2>
            <p>
              Платформа оставляет за собой право изменять настоящие Условия. Актуальная
              версия всегда доступна на данной странице. Продолжение использования сервиса
              после изменений означает согласие с ними.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
