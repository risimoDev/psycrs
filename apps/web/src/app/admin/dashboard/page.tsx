'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi, type DashboardData, type RetentionData } from '../../../lib/api';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-foreground/5 border border-foreground/10 rounded-lg p-5">
      <p className="text-xs font-body text-foreground/50 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-heading font-semibold text-foreground">{value}</p>
      {sub && <p className="text-xs font-body text-foreground/40 mt-1">{sub}</p>}
    </div>
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(amount);
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['admin', 'dashboard'],
    queryFn: adminApi.dashboard,
  });

  const { data: retention } = useQuery<RetentionData>({
    queryKey: ['admin', 'retention'],
    queryFn: adminApi.retention,
  });

  if (isLoading || !data) {
    return <p className="text-foreground/50 font-body">Загрузка данных...</p>;
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold text-foreground mb-6">Дашборд</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Пользователи" value={data.totalUsers} />
        <StatCard label="Активные подписки" value={data.activeSubscriptions} />
        <StatCard label="Ежемес. доход" value={formatCurrency(data.mrr)} />
        <StatCard
          label="Отток"
          value={`${data.churnRate}%`}
          sub={`${data.expiredSubscriptions} из ${data.activeSubscriptions + data.gracePeriodSubscriptions + data.expiredSubscriptions}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue summary */}
        <div className="bg-foreground/5 border border-foreground/10 rounded-lg p-5">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-4">Доход</h2>
          <div className="space-y-3">
            <div className="flex justify-between font-body text-sm">
              <span className="text-foreground/60">Общий доход</span>
              <span className="text-foreground">{formatCurrency(data.totalRevenue)}</span>
            </div>
            <div className="flex justify-between font-body text-sm">
              <span className="text-foreground/60">Всего оплат</span>
              <span className="text-foreground">{data.totalPayments}</span>
            </div>
            <div className="flex justify-between font-body text-sm">
              <span className="text-foreground/60">Льготный период</span>
              <span className="text-foreground">{data.gracePeriodSubscriptions}</span>
            </div>
          </div>
        </div>

        {/* Recent payments */}
        <div className="bg-foreground/5 border border-foreground/10 rounded-lg p-5">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-4">Последние оплаты</h2>
          {data.recentPayments.length === 0 ? (
            <p className="text-foreground/40 text-sm font-body">Нет оплат</p>
          ) : (
            <div className="space-y-2">
              {data.recentPayments.map((p) => (
                <div key={p.id} className="flex justify-between items-center text-sm font-body">
                  <span className="text-foreground/70 truncate max-w-[200px]">{p.user.email}</span>
                  <span className="text-foreground">{formatCurrency(Number(p.amount))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* User signups chart (simple bar) */}
      {data.usersByMonth.length > 0 && (
        <div className="mt-6 bg-foreground/5 border border-foreground/10 rounded-lg p-5">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-4">Регистрации по месяцам</h2>
          <div className="flex items-end gap-3 h-32">
            {data.usersByMonth.map((m) => {
              const maxCount = Math.max(...data.usersByMonth.map((x) => x.count), 1);
              const height = Math.max((m.count / maxCount) * 100, 4);
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-foreground/60 font-body">{m.count}</span>
                  <div
                    className="w-full bg-accent/60 rounded-t"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-xs text-foreground/40 font-body">
                    {m.month.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Retention metrics */}
      {retention && (
        <div className="mt-6 bg-foreground/5 border border-foreground/10 rounded-lg p-5">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-4">Вовлечённость</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-body text-foreground/50 uppercase tracking-wider">Активны за день</p>
              <p className="text-xl font-heading font-semibold text-foreground">{retention.dau}</p>
            </div>
            <div>
              <p className="text-xs font-body text-foreground/50 uppercase tracking-wider">Активны за неделю</p>
              <p className="text-xl font-heading font-semibold text-foreground">{retention.wau}</p>
            </div>
            <div>
              <p className="text-xs font-body text-foreground/50 uppercase tracking-wider">Активны за месяц</p>
              <p className="text-xl font-heading font-semibold text-foreground">{retention.mau}</p>
            </div>
            <div>
              <p className="text-xs font-body text-foreground/50 uppercase tracking-wider">Удержание 7 дней</p>
              <p className="text-xl font-heading font-semibold text-foreground">{retention.retention7d}%</p>
            </div>
            <div>
              <p className="text-xs font-body text-foreground/50 uppercase tracking-wider">Удержание 30 дней</p>
              <p className="text-xl font-heading font-semibold text-foreground">{retention.retention30d}%</p>
            </div>
            <div>
              <p className="text-xs font-body text-foreground/50 uppercase tracking-wider">Ср. прогресс курса</p>
              <p className="text-xl font-heading font-semibold text-foreground">{retention.avgCourseCompletion}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
