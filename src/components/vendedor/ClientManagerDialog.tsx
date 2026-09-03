import { useEffect, useMemo, useState } from 'react';
import { Search, Users, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useLMS } from '@/contexts/LMSContext';
import { supabase } from '@/integrations/supabase/client';
import { getSessionRemainingSeconds, User } from '@/types/lms';
import { formatMinutes } from '@/lib/lanhouse';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientManagerDialog({ open, onOpenChange }: Props) {
  const { users, gameSessions, computers } = useLMS();
  const [search, setSearch] = useState('');
  const [saldos, setSaldos] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<User | null>(null);
  const [addMinutes, setAddMinutes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSaldos = async () => {
    const { data, error } = await supabase
      .from('lan_clientes')
      .select('id, saldo_minutos');
    if (error) {
      console.warn('[client manager] load saldos failed:', error.message);
      return;
    }
    const map: Record<string, number> = {};
    for (const row of (data || []) as unknown as { id: string; saldo_minutos?: number }[]) {
      map[row.id] = Number(row.saldo_minutos) || 0;
    }
    setSaldos(map);
  };

  useEffect(() => {
    if (!open) return;
    loadSaldos();
  }, [open]);

  const clientes = useMemo(
    () => users.filter((u) => u.role === 'cliente' || u.role === 'aluno'),
    [users]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = clientes.map((u) => {
      const session = (gameSessions || []).find((s) => s.userId === u.id);
      const activeMinutes = session ? Math.ceil(getSessionRemainingSeconds(session) / 60) : 0;
      const savedMinutes = saldos[u.id] ?? 0;
      const remaining = session ? activeMinutes : savedMinutes;
      const pc = session?.computerId
        ? computers.find((c) => c.id === session.computerId)?.name
        : undefined;
      return { user: u, remaining, pc, active: !!session };
    });
    const sorted = list.sort((a, b) => a.user.name.localeCompare(b.user.name, 'pt-BR'));
    if (!q) return sorted;
    return sorted.filter(({ user }) =>
      user.name.toLowerCase().includes(q) ||
      (user.cpf || '').toLowerCase().includes(q) ||
      (user.phone || '').toLowerCase().includes(q)
    );
  }, [clientes, gameSessions, saldos, search, computers]);

  const handleAddSaldo = async () => {
    if (!selected) return;
    const mins = parseInt(addMinutes, 10);
    if (!Number.isFinite(mins) || mins <= 0) {
      toast.error('Informe minutos válidos');
      return;
    }
    setSaving(true);
    try {
      const current = saldos[selected.id] ?? 0;
      const next = current + mins;
      const { error } = await supabase
        .from('lan_clientes')
        .upsert(
          {
            id: selected.id,
            name: selected.name,
            cpf: selected.cpf ?? null,
            phone: selected.phone ?? null,
            address: selected.address ?? null,
            age: selected.age ?? null,
            saldo_minutos: next,
          } as any,
          { onConflict: 'id' }
        );
      if (error) throw error;
      setSaldos((s) => ({ ...s, [selected.id]: next }));
      toast.success(`+${formatMinutes(mins)} adicionados a ${selected.name}`);
      setSelected(null);
      setAddMinutes('');
    } catch (e: any) {
      toast.error('Falha ao salvar: ' + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Gerenciar clientes
            </DialogTitle>
            <DialogDescription>
              Clientes salvos no banco de dados (nuvem). Clique em um cliente para adicionar saldo de tempo.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, CPF ou telefone…"
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-border divide-y divide-border">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">
                Nenhum cliente encontrado.
              </p>
            ) : (
              filtered.map(({ user, remaining, pc, active }) => (
                <button
                  key={user.id}
                  onClick={() => {
                    setSelected(user);
                    setAddMinutes('');
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 gap-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[user.cpf, user.phone].filter(Boolean).join(' • ') || 'Sem contato'}
                      {active && pc && ` • conectado em ${pc}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <p className={remaining > 0 ? 'text-success font-semibold' : 'text-muted-foreground'}>
                        {formatMinutes(remaining)}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {active ? 'em sessão' : 'saldo salvo'}
                      </p>
                    </div>
                    <Plus className="h-4 w-4 text-primary" />
                  </div>
                </button>
              ))
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Total: {filtered.length} {filtered.length === 1 ? 'cliente' : 'clientes'} • Dados sincronizados na nuvem.
          </p>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar saldo</DialogTitle>
            <DialogDescription>
              {selected?.name} • saldo atual: {formatMinutes(saldos[selected?.id ?? ''] ?? 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Minutos a adicionar</Label>
              <Input
                type="number"
                min={1}
                value={addMinutes}
                onChange={(e) => setAddMinutes(e.target.value.replace(/\D/g, ''))}
                placeholder="Ex: 60"
                autoFocus
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[15, 30, 60, 120].map((m) => (
                <Button key={m} size="sm" variant="outline" onClick={() => setAddMinutes(String(m))}>
                  +{m}min
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              <X className="h-4 w-4" /> Cancelar
            </Button>
            <Button onClick={handleAddSaldo} disabled={saving}>
              <Plus className="h-4 w-4" /> {saving ? 'Salvando…' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
