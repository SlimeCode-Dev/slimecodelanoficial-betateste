import { useState, useMemo, useEffect } from 'react';
import { Timer, Clock, Play, Pause, Plus, Minus, Monitor, RefreshCw, Download, ArrowLeftRight, Search } from 'lucide-react';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLMS } from '@/contexts/LMSContext';
import {
  getSessionRemainingSeconds,
  getTimeStatus,
  TIME_STATUS_TEXT,
  minutesToAmount,
  amountToMinutes,
} from '@/types/lms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DashboardStats } from '@/components/vendedor/DashboardStats';
import { TimeBadge } from '@/components/vendedor/TimeBadge';
import { useLanHouseMetrics } from '@/hooks/useLanHouseMetrics';
import { formatCurrency, formatClock } from '@/lib/lanhouse';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';


type SessionFilter = 'all' | 'running' | 'paused';

export default function VendedorAtivos() {
  const {
    currentUser,
    gameSessions,
    computers,
    getUserById,
    startGameSession,
    pauseGameSession,
    addGameTime,
    removeGameTime,
    syncLanHouseToCloud,
    getSessionByComputer,
    assignComputer,
  } = useLMS();

  const [syncing, setSyncing] = useState(false);
  const handleSync = async () => {
    setSyncing(true);
    const res = await syncLanHouseToCloud();
    setSyncing(false);
    if (res.error) toast.error(`Erro ao sincronizar: ${res.error}`);
    else toast.success(`Sincronizado: ${res.clientes} cliente(s) e ${res.transactions} transação(ões).`);
  };

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const metrics = useLanHouseMetrics(now);
  const [quickAmount, setQuickAmount] = useState<Record<string, string>>({});
  const [quickRemove, setQuickRemove] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<SessionFilter>('all');
  const [nameQuery, setNameQuery] = useState('');
  const [moving, setMoving] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);



  const active = useMemo(() => {
    return (gameSessions || [])
      .map((s) => ({
        session: s,
        user: getUserById(s.userId),
        remaining: getSessionRemainingSeconds(s, now),
        computer: computers.find((c) => c.id === s.computerId),
      }))
      .filter((x) => x.user && (x.remaining > 0 || x.session.status === 'running'))
      .sort((a, b) => {
        const ra = a.session.status === 'running';
        const rb = b.session.status === 'running';
        if (ra && !rb) return -1;
        if (rb && !ra) return 1;
        return a.remaining - b.remaining;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameSessions, computers, now]);

  const filtered = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    let list = active;
    if (filter === 'running') list = list.filter((x) => x.session.status === 'running' && x.remaining > 0);
    else if (filter === 'paused') list = list.filter((x) => !(x.session.status === 'running' && x.remaining > 0));
    if (q) list = list.filter((x) => x.user!.name.toLowerCase().includes(q));
    return list;
  }, [active, filter, nameQuery]);

  const freeComputers = useMemo(
    () => computers.filter((c) => !getSessionByComputer(c.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [computers, gameSessions]
  );

  const handleMove = async (userId: string, computerId: string) => {
    setMoving(userId);
    await assignComputer(userId, undefined);
    await assignComputer(userId, computerId);
    setMoving(null);
    toast.success('Cliente movido de computador');
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const [{ data: clientes, error: cErr }, { data: pcs, error: pErr }] = await Promise.all([
        supabase.from('lan_clientes').select('id, name, saldo_minutos').order('name'),
        supabase.from('lan_computers').select('id, name, status, user_id, tempo_comprado_minutos, tempo_usado_minutos, timestamp_ultimo_inicio'),
      ]);
      if (cErr || pErr) throw new Error(cErr?.message || pErr?.message);

      const nowMs = Date.now();
      const byUser = new Map<string, { pc: string; status: string; seconds: number }>();
      (pcs || []).forEach((pc) => {
        if (!pc.user_id) return;
        const elapsed =
          pc.status === 'ativo' && pc.timestamp_ultimo_inicio
            ? Math.max(0, Math.floor((nowMs - new Date(pc.timestamp_ultimo_inicio).getTime()) / 1000))
            : 0;
        const seconds = Math.max(
          0,
          pc.tempo_comprado_minutos * 60 - pc.tempo_usado_minutos * 60 - elapsed
        );
        byUser.set(pc.user_id, {
          pc: pc.name,
          status: pc.status === 'ativo' ? 'Em uso' : 'Pausado',
          seconds,
        });
      });

      const rows = [
        ['Cliente', 'Computador', 'Status', 'Tempo restante'],
        ...(clientes || []).map((c) => {
          const s = byUser.get(c.id);
          return [
            c.name,
            s?.pc || '-',
            s?.status || 'Sem sessão',
            formatClock(s ? s.seconds : (c.saldo_minutos || 0) * 60),
          ];
        }),
      ];
      if (rows.length === 1) {
        toast.error('Nenhum cliente no banco de dados');
        return;
      }
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
      const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `tempos-lanhouse-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${rows.length - 1} cliente(s) exportado(s) do banco`);
    } catch (e) {
      toast.error(`Erro ao baixar: ${(e as Error).message}`);
    } finally {
      setDownloading(false);
    }
  };


  if (!currentUser) return null;


  const handleAdd = (userId: string, computerId?: string) => {
    const raw = quickAmount[userId];
    const value = parseFloat((raw || '').replace(',', '.'));
    if (isNaN(value) || value <= 0) {
      toast.error('Informe o valor pago');
      return;
    }
    addGameTime(userId, amountToMinutes(value), value, undefined, {
      computerId,
      operation: 'Adição de tempo',
    });
    toast.success(`+${formatCurrency(value)} adicionado`);
    setQuickAmount((p) => ({ ...p, [userId]: '' }));
  };

  const handleRemove = (userId: string) => {
    const mins = parseInt(quickRemove[userId] || '', 10);
    if (isNaN(mins) || mins <= 0) {
      toast.error('Informe os minutos a retirar');
      return;
    }
    removeGameTime(userId, mins, 'Retirada de tempo');
    toast.success(`-${mins} min removidos`);
    setQuickRemove((p) => ({ ...p, [userId]: '' }));
  };



  return (
    <MainLayout title="Sessões em tempo real">
      <div className="space-y-6">
        <DashboardStats metrics={metrics} />

        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Timer className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">Sessões em tempo real</h2>
            <p className="text-sm text-muted-foreground">
              {filtered.length} sessão(ões) • ordenadas por quem termina primeiro
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading} title="Baixar do banco: nome e tempo restante de todos os clientes">
            <Download className={cn('h-4 w-4', downloading && 'animate-pulse')} /> {downloading ? 'Baixando…' : 'Baixar lista'}

          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSync}
            disabled={syncing}
            title="Enviar clientes e histórico de tempo para o banco de dados"
          >
            <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
            {syncing ? 'Sincronizando…' : 'Sincronizar com o banco'}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Filtrar por nome"
              className="h-9 w-56 pl-8"
            />
          </div>
          {([
            { key: 'running', label: 'Em uso', count: active.filter((x) => x.session.status === 'running' && x.remaining > 0).length },
            { key: 'paused', label: 'Pausados', count: active.filter((x) => !(x.session.status === 'running' && x.remaining > 0)).length },
            { key: 'all', label: 'Todos', count: active.length },
          ] as const).map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? 'default' : 'outline'}
              onClick={() => setFilter(f.key)}
            >
              {f.key === 'running' ? <Play className="h-4 w-4" /> : f.key === 'paused' ? <Pause className="h-4 w-4" /> : <Timer className="h-4 w-4" />}
              {f.label} ({f.count})
            </Button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
            Nenhuma sessão nesse filtro.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(({ session, user, remaining, computer }) => {

              const running = session.status === 'running' && remaining > 0;
              const status = getTimeStatus(remaining, true);
              const pulsing = running && remaining <= 120;
              const consumido = minutesToAmount(Math.max(0, (remaining) / 60));

              return (
                <div
                  key={user!.id}
                  className={cn(
                    'rounded-2xl border p-5 bg-card transition-all duration-200',
                    running ? 'border-destructive/40' : 'border-yellow-400/40',
                    pulsing && 'animate-pulse'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-foreground truncate">{user!.name}</p>
                    {computer && (
                      <span className="text-xs font-mono text-primary flex items-center gap-1">
                        <Monitor className="h-3 w-3" /> {computer.name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {running ? 'Em uso' : 'Pausado'} • valor restante {formatCurrency(consumido)}
                  </p>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className={cn('h-7 w-7', TIME_STATUS_TEXT[status])} />
                    <TimeBadge session={session} now={now} className="text-3xl" />
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <ArrowLeftRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Select
                      value=""
                      disabled={moving === user!.id || freeComputers.length === 0}
                      onValueChange={(v) => handleMove(user!.id, v)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue
                          placeholder={
                            freeComputers.length === 0 ? 'Sem PCs livres' : 'Mover para outro PC'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {freeComputers.map((fc) => (
                          <SelectItem key={fc.id} value={fc.id}>
                            {fc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>



                  <div className="grid grid-cols-1 gap-2 mb-2">
                    {running ? (
                      <Button size="sm" variant="outline" onClick={() => pauseGameSession(user!.id)}>
                        <Pause className="h-4 w-4" /> Pausar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          if (remaining <= 0) {
                            toast.error('Sem tempo. Adicione tempo primeiro.');
                            return;
                          }
                          startGameSession(user!.id);
                        }}
                      >
                        <Play className="h-4 w-4" /> Iniciar
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={quickAmount[user!.id] || ''}
                      onChange={(e) =>
                        setQuickAmount((p) => ({ ...p, [user!.id]: e.target.value }))
                      }
                      placeholder="R$ adicionar"
                      inputMode="decimal"
                      className="h-9"
                    />
                    <Button size="sm" onClick={() => handleAdd(user!.id, session.computerId)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={quickRemove[user!.id] || ''}
                      onChange={(e) =>
                        setQuickRemove((p) => ({ ...p, [user!.id]: e.target.value }))
                      }
                      placeholder="Min. retirar"
                      inputMode="numeric"
                      className="h-9"
                    />
                    <Button size="sm" variant="destructive" onClick={() => handleRemove(user!.id)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
