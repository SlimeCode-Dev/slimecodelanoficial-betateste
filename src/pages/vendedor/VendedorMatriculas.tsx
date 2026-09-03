import { useEffect, useMemo, useState } from 'react';
import { GraduationCap, Plus, Trash2, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type Matricula = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  curso: string;
  status: string;
  dia_aula: string | null;
  horario: string | null;
  note: string | null;
  created_at: string;
};

const CURSOS = [
  { value: 'design', label: 'Design Gráfico' },
  { value: 'jogos', label: 'Desenvolvimento de Jogos' },
  { value: 'ambos', label: 'Os dois cursos' },
] as const;

const STATUS = [
  { value: 'interessado', label: 'Interessado' },
  { value: 'agendado', label: 'Aula agendada' },
  { value: 'matriculado', label: 'Matriculado' },
  { value: 'cancelado', label: 'Cancelado' },
] as const;

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const STATUS_STYLE: Record<string, string> = {
  interessado: 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30',
  agendado: 'bg-primary/15 text-primary border-primary/30',
  matriculado: 'bg-success/15 text-success border-success/30',
  cancelado: 'bg-destructive/15 text-destructive border-destructive/30',
};

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  curso: 'design',
  status: 'interessado',
  dia_aula: '',
  horario: '',
  note: '',
};

export default function VendedorMatriculas() {
  const [rows, setRows] = useState<Matricula[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lan_matriculas')
      .select('*')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(`Erro ao carregar: ${error.message}`);
      return;
    }
    setRows((data || []) as Matricula[]);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Informe o nome do aluno');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from('lan_matriculas')
      .insert({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        curso: form.curso,
        status: form.status,
        dia_aula: form.dia_aula || null,
        horario: form.horario || null,
        note: form.note.trim() || null,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }
    setRows((p) => [data as Matricula, ...p]);
    setForm({ ...emptyForm });
    toast.success('Aluno cadastrado no banco de dados');
  };

  const patch = async (id: string, values: Partial<Matricula>) => {
    setRows((p) => p.map((r) => (r.id === id ? { ...r, ...values } : r)));
    const { error } = await supabase.from('lan_matriculas').update(values).eq('id', id);
    if (error) {
      toast.error(`Erro ao atualizar: ${error.message}`);
      load();
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('lan_matriculas').delete().eq('id', id);
    if (error) {
      toast.error(`Erro ao excluir: ${error.message}`);
      return;
    }
    setRows((p) => p.filter((r) => r.id !== id));
    toast.success('Cadastro removido');
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (statusFilter === 'todos' || r.status === statusFilter) &&
        (!q || r.name.toLowerCase().includes(q))
    );
  }, [rows, query, statusFilter]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => (m[r.status] = (m[r.status] || 0) + 1));
    return m;
  }, [rows]);

  return (
    <MainLayout title="Agendamento e matrículas">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GraduationCap className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">Agendamento e matrículas</h2>
            <p className="text-sm text-muted-foreground">
              {rows.length} cadastro(s) • salvo automaticamente no banco de dados
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Atualizar
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-4 font-medium text-foreground">Novo aluno interessado</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nome do aluno"
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Curso</Label>
              <Select value={form.curso} onValueChange={(v) => setForm((p) => ({ ...p, curso: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURSOS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Dia da aula</Label>
                <Select value={form.dia_aula} onValueChange={(v) => setForm((p) => ({ ...p, dia_aula: v }))}>
                  <SelectTrigger><SelectValue placeholder="Dia" /></SelectTrigger>
                  <SelectContent>
                    {DIAS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Horário</Label>
                <Input
                  type="time"
                  value={form.horario}
                  onChange={(e) => setForm((p) => ({ ...p, horario: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label>Observações</Label>
              <Textarea
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Anotações sobre o aluno, responsável, valores combinados…"
                rows={2}
              />
            </div>
          </div>
          <Button className="mt-4" onClick={handleCreate} disabled={saving}>
            <Plus className="h-4 w-4" /> {saving ? 'Salvando…' : 'Cadastrar aluno'}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar por nome"
              className="h-9 w-56 pl-8"
            />
          </div>
          <Button
            size="sm"
            variant={statusFilter === 'todos' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('todos')}
          >
            Todos ({rows.length})
          </Button>
          {STATUS.map((s) => (
            <Button
              key={s.value}
              size="sm"
              variant={statusFilter === s.value ? 'default' : 'outline'}
              onClick={() => setStatusFilter(s.value)}
            >
              {s.label} ({counts[s.value] || 0})
            </Button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <GraduationCap className="mx-auto mb-3 h-10 w-10 opacity-50" />
            {loading ? 'Carregando…' : 'Nenhum aluno nesse filtro.'}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{r.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.phone || r.email || 'Sem contato'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2 py-0.5 text-[11px]',
                      STATUS_STYLE[r.status] || 'border-border text-muted-foreground'
                    )}
                  >
                    {STATUS.find((s) => s.value === r.status)?.label || r.status}
                  </span>
                </div>

                <div className="space-y-2">
                  <Select value={r.curso} onValueChange={(v) => patch(r.id, { curso: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURSOS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={r.status} onValueChange={(v) => patch(r.id, { status: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={r.dia_aula || ''}
                      onValueChange={(v) => patch(r.id, { dia_aula: v })}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="Dia" /></SelectTrigger>
                      <SelectContent>
                        {DIAS.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="time"
                      className="h-9"
                      value={r.horario || ''}
                      onChange={(e) =>
                        setRows((p) =>
                          p.map((x) => (x.id === r.id ? { ...x, horario: e.target.value } : x))
                        )
                      }
                      onBlur={(e) => patch(r.id, { horario: e.target.value || null })}
                    />
                  </div>

                  {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}

                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full"
                    onClick={() => remove(r.id)}
                  >
                    <Trash2 className="h-4 w-4" /> Excluir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
