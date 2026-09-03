import { useMemo, useState } from 'react';
import { Search, Clock, User as UserIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useLMS } from '@/contexts/LMSContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/lanhouse';

function formatMinutes(total: number) {
  const abs = Math.abs(total);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = total < 0 ? '-' : '';
  if (h > 0) return `${sign}${h}h${m > 0 ? ` ${m}min` : ''}`;
  return `${sign}${m}min`;
}

export function UserTimeHistory() {
  const { users, gameTimeTransactions, computers } = useLMS();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const clientes = useMemo(
    () => users.filter((u) => u.role === 'cliente' || u.role === 'aluno'),
    [users]
  );

  const perUser = useMemo(() => {
    const byUser = new Map<string, typeof gameTimeTransactions>();
    (gameTimeTransactions || []).forEach((t) => {
      if (!byUser.has(t.userId)) byUser.set(t.userId, []);
      byUser.get(t.userId)!.push(t);
    });
    return clientes
      .map((u) => {
        const txs = (byUser.get(u.id) || []).sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt)
        );
        const totalMinutes = txs.reduce((s, t) => s + t.minutes, 0);
        const totalPaid = txs.reduce((s, t) => s + (t.amountPaid || 0), 0);
        const lastAt = txs[0]?.createdAt;
        return { user: u, txs, totalMinutes, totalPaid, lastAt };
      })
      .filter((r) => r.txs.length > 0);
  }, [clientes, gameTimeTransactions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return perUser;
    return perUser.filter(
      (r) =>
        r.user.name.toLowerCase().includes(q) ||
        (r.user.cpf || '').toLowerCase().includes(q) ||
        (r.user.phone || '').toLowerCase().includes(q)
    );
  }, [perUser, search]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) =>
        (b.lastAt || '').localeCompare(a.lastAt || '')
      ),
    [filtered]
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Histórico de tempo dos clientes
        </h3>
        <p className="text-xs text-muted-foreground">
          {sorted.length} cliente(s) com movimentações
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente por nome, CPF ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-2">
        {sorted.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">
            Nenhum cliente encontrado.
          </p>
        )}
        {sorted.map((r) => {
          const isOpen = expanded === r.user.id;
          return (
            <div key={r.user.id} className="rounded-xl border border-border bg-background/40">
              <button
                onClick={() => setExpanded(isOpen ? null : r.user.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <UserIcon className="h-4 w-4" />
                  </span>
                  <div className="text-left min-w-0">
                    <p className="font-medium text-foreground truncate">{r.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.txs.length} lançamento(s)
                      {r.user.age ? ` • ${r.user.age} anos` : ''}
                      {r.user.phone ? ` • ${r.user.phone}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className={cn('text-sm font-semibold', r.totalMinutes >= 0 ? 'text-success' : 'text-destructive')}>
                      {formatMinutes(r.totalMinutes)}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(r.totalPaid)}</p>
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-border overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground bg-muted/20">
                        <th className="py-2 px-3 font-medium">Data</th>
                        <th className="py-2 px-3 font-medium">Operação</th>
                        <th className="py-2 px-3 font-medium">PC</th>
                        <th className="py-2 px-3 font-medium text-right">Tempo</th>
                        <th className="py-2 px-3 font-medium text-right">Valor</th>
                        <th className="py-2 px-3 font-medium">Pgto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.txs.map((t) => {
                        const comp = computers.find((c) => c.id === t.computerId);
                        return (
                          <tr key={t.id} className="border-t border-border/40">
                            <td className="py-1.5 px-3 whitespace-nowrap">
                              {format(parseISO(t.createdAt), 'dd/MM/yy HH:mm')}
                            </td>
                            <td className="py-1.5 px-3">{t.operation || (t.minutes >= 0 ? 'Adição' : 'Retirada')}</td>
                            <td className="py-1.5 px-3 font-mono">{comp?.name || '—'}</td>
                            <td className={cn('py-1.5 px-3 text-right font-semibold', t.minutes >= 0 ? 'text-success' : 'text-destructive')}>
                              {formatMinutes(t.minutes)}
                            </td>
                            <td className="py-1.5 px-3 text-right">
                              {t.amountPaid > 0 ? formatCurrency(t.amountPaid) : '—'}
                            </td>
                            <td className="py-1.5 px-3 text-muted-foreground">{t.paymentMethod || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
