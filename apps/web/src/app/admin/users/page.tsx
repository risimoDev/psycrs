'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type AdminUser } from '../../../lib/api';
import { Button } from '../../../components/button';

function GrantSubscriptionCell({ user }: { user: AdminUser }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(30);

  const grantMut = useMutation({
    mutationFn: () => adminApi.grantSubscription(user.id, days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setOpen(false);
    },
  });

  const revokeMut = useMutation({
    mutationFn: () => adminApi.revokeSubscription(user.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const hasActive =
    user.subscription?.status === 'active' || user.subscription?.status === 'grace_period';

  if (open) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={1}
          max={3650}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="w-16 bg-transparent border border-foreground/20 rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent/40"
        />
        <span className="text-xs text-foreground/40">дн.</span>
        <Button size="sm" variant="primary" loading={grantMut.isPending} onClick={() => grantMut.mutate()}>
          ОК
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          ✕
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 justify-end">
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Выдать подписку
      </Button>
      {hasActive && (
        <Button
          size="sm"
          variant="ghost"
          loading={revokeMut.isPending}
          onClick={() => revokeMut.mutate()}
          className="text-red-400"
        >
          Отозвать
        </Button>
      )}
    </div>
  );
}

function RoleToggleCell({ user }: { user: AdminUser }) {
  const queryClient = useQueryClient();

  const roleMut = useMutation({
    mutationFn: (role: 'admin' | 'user') => adminApi.setUserRole(user.id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  if (user.role === 'admin') {
    return (
      <Button
        size="sm"
        variant="outline"
        loading={roleMut.isPending}
        onClick={() => {
          if (confirm(`Забрать права администратора у ${user.email}?`)) {
            roleMut.mutate('user');
          }
        }}
        className="text-yellow-500 border-yellow-500/20 hover:border-yellow-500/40"
      >
        Снять админа
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      loading={roleMut.isPending}
      onClick={() => {
        if (confirm(`Назначить ${user.email} администратором?`)) {
          roleMut.mutate('admin');
        }
      }}
    >
      Сделать админом
    </Button>
  );
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, search],
    queryFn: () => adminApi.users(page, 20, search || undefined),
  });

  const banMut = useMutation({
    mutationFn: (id: string) => adminApi.banUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const unbanMut = useMutation({
    mutationFn: (id: string) => adminApi.unbanUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  function formatDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold text-foreground mb-6">Пользователи</h1>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Поиск по email..."
          className="flex-1 max-w-xs bg-transparent border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent/40"
        />
        <Button type="submit" size="sm" variant="outline">Найти</Button>
        {search && (
          <Button type="button" size="sm" variant="ghost" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}>
            Сбросить
          </Button>
        )}
      </form>

      {isLoading ? (
        <p className="text-foreground/50 font-body text-sm">Загрузка...</p>
      ) : (
        <>
          <div className="border border-foreground/10 rounded-lg overflow-hidden">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="border-b border-foreground/10 bg-foreground/[0.03]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground/50 uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground/50 uppercase tracking-wider">Роль</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground/50 uppercase tracking-wider">Подписка</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground/50 uppercase tracking-wider">Регистрация</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground/50 uppercase tracking-wider">Последний вход</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-foreground/50 uppercase tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {data?.items.map((user: AdminUser) => (
                  <tr key={user.id} className="hover:bg-foreground/[0.02] transition-colors">
                    <td className="px-4 py-3 text-foreground">
                      {user.isBanned && (
                        <span className="mr-2 text-xs bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded">БАН</span>
                      )}
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-foreground/60">{user.role === 'admin' ? 'Админ' : 'Пользователь'}</td>
                    <td className="px-4 py-3">
                      {user.subscription ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          user.subscription.status === 'active' ? 'bg-green-500/15 text-green-400' :
                          user.subscription.status === 'grace_period' ? 'bg-yellow-500/15 text-yellow-400' :
                          'bg-foreground/5 text-foreground/40'
                        }`}>
                          {user.subscription.status === 'active' ? 'Активна' :
                           user.subscription.status === 'grace_period' ? 'Льготный период' :
                           user.subscription.status === 'expired' ? 'Истекла' :
                           user.subscription.status === 'cancelled' ? 'Отменена' :
                           user.subscription.status}
                        </span>
                      ) : (
                        <span className="text-foreground/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground/50">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3 text-foreground/50">{formatDate(user.lastLoginAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <GrantSubscriptionCell user={user} />
                        <RoleToggleCell user={user} />
                        {user.isBanned ? (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={unbanMut.isPending}
                            onClick={() => unbanMut.mutate(user.id)}
                          >
                            Разблокировать
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={banMut.isPending}
                            onClick={() => banMut.mutate(user.id)}
                            className="text-red-400 border-red-500/20 hover:border-red-500/40"
                          >
                            Заблокировать
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-foreground/30 text-sm">
                      Пользователи не найдены
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-foreground/40 font-body">
                Всего: {data?.total ?? 0}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  ←
                </Button>
                <span className="flex items-center px-2 text-xs text-foreground/50 font-body">
                  {page} / {totalPages}
                </span>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  →
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
