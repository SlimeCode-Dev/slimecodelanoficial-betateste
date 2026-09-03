import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Turma, Material, StudentSubmission, Payment, LMSData, UserRole, Announcement, AttendanceRecord, MaterialProgress, GameTimeTransaction, GameSession, Expense, Computer, getSessionRemainingSeconds } from '@/types/lms';
import { supabase } from '@/integrations/supabase/client';

interface LMSContextType {
  currentUser: User | null;
  isInitialized: boolean;
  users: User[];
  turmas: Turma[];
  materials: Material[];
  submissions: StudentSubmission[];
  payments: Payment[];
  announcements: Announcement[];
  attendanceRecords: AttendanceRecord[];
  materialProgress: MaterialProgress[];
  loginByCredentials: (email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  addUser: (user: Omit<User, 'id' | 'createdAt'>) => void;
  updateUser: (id: string, data: Partial<User>) => void;
  deleteUser: (id: string) => void;
  addTurma: (turma: Omit<Turma, 'id' | 'createdAt'>) => void;
  updateTurma: (id: string, data: Partial<Turma>) => void;
  deleteTurma: (id: string) => void;
  addMaterial: (material: Omit<Material, 'id' | 'uploadedAt'>) => void;
  deleteMaterial: (id: string) => void;
  addSubmission: (submission: Omit<StudentSubmission, 'id' | 'submittedAt' | 'status'>) => void;
  updateSubmission: (id: string, data: Partial<StudentSubmission>) => void;
  addPayment: (payment: Omit<Payment, 'id'>) => void;
  updatePayment: (id: string, data: Partial<Payment>) => void;
  deletePayment: (id: string) => void;
  markPaymentAsPaid: (id: string) => void;
  markPaymentAsPending: (id: string) => void;
  deleteGameTimeTransaction: (id: string) => Promise<void>;
  getStudentsByTurma: (turmaId: string) => User[];
  getMaterialsByTurma: (turmaId: string) => Material[];
  getSubmissionsByTurma: (turmaId: string) => StudentSubmission[];
  getPaymentsByStudent: (studentId: string) => Payment[];
  getTurmaById: (id: string) => Turma | undefined;
  getUserById: (id: string) => User | undefined;
  getTurmasByProfessor: (professorId: string) => Turma[];
  generate2026Payments: (studentId: string) => void;
  // Announcements
  addAnnouncement: (announcement: Omit<Announcement, 'id' | 'createdAt'>) => void;
  deleteAnnouncement: (id: string) => void;
  // Attendance
  addAttendanceRecord: (record: Omit<AttendanceRecord, 'id' | 'createdAt'>) => void;
  getAttendanceByTurmaAndDate: (turmaId: string, date: string) => AttendanceRecord | undefined;
  getAttendanceByTurma: (turmaId: string) => AttendanceRecord[];
  getStudentAttendance: (studentId: string) => { date: string; present: boolean; note?: string; turmaId: string }[];
  // Progress
  toggleMaterialProgress: (studentId: string, materialId: string) => void;
  getStudentProgress: (studentId: string) => MaterialProgress[];
  // Game time (lan house)
  gameTimeTransactions: GameTimeTransaction[];
  gameSessions: GameSession[];
  addGameTime: (userId: string, minutes: number, amountPaid: number, note?: string, opts?: { computerId?: string; paymentMethod?: string; operation?: string }) => void;
  removeGameTime: (userId: string, minutes: number, note?: string) => void;
  getUserTimeBalance: (userId: string) => number;
  getUserTimeTransactions: (userId: string) => GameTimeTransaction[];
  importGameTransactions: (txs: GameTimeTransaction[]) => number;
  getGameSession: (userId: string) => GameSession | undefined;
  startGameSession: (userId: string) => void;
  pauseGameSession: (userId: string) => void;
  finishGameSession: (userId: string) => void;
  // Computers (lan house machines)
  computers: Computer[];
  addComputer: (name?: string) => void;
  removeComputer: (id: string) => void;
  renameComputer: (id: string, name: string) => void;
  assignComputer: (userId: string, computerId: string | undefined) => void;
  getSessionByComputer: (computerId: string) => GameSession | undefined;
  // Expenses (company financial control)
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id' | 'createdBy'>) => void;
  deleteExpense: (id: string) => void;
  importExpenses: (expenses: Expense[]) => number;
  syncLanHouseToCloud: () => Promise<{ clientes: number; transactions: number; error?: string }>;
}

const LMSContext = createContext<LMSContextType | undefined>(undefined);

const STORAGE_KEY = 'lms_data';
const SESSION_KEY = 'lms_session';
const DATA_VERSION_KEY = 'lms_data_version';
const CURRENT_DATA_VERSION = 9; // Increment for new features

const generateId = () => Math.random().toString(36).substring(2, 9);

const initialData: LMSData = {
  users: [
    { 
      id: 'admin-1', 
      name: 'Administrador', 
      email: 'admin@codeschool.com', 
      password: 'admin123',
      cpf: '000.000.000-00',
      role: 'admin', 
      createdAt: '2026-01-01T00:00:00.000Z' 
    },
    { 
      id: 'admin-slime', 
      name: 'Slime Code Admin', 
      email: 'admslimecode@gmail.com', 
      password: 'slimecode@789',
      cpf: '000.000.000-01',
      role: 'admin', 
      createdAt: '2026-01-01T00:00:00.000Z' 
    },
    { 
      id: 'vendedor-1', 
      name: 'Vendedor', 
      email: 'vendas@code.com', 
      password: 'vendas123',
      cpf: '000.000.000-02',
      role: 'vendedor', 
      createdAt: '2026-01-01T00:00:00.000Z' 
    },
    { 
      id: 'prof-1', 
      name: 'Prof. Maria Silva', 
      email: 'maria@codeschool.com', 
      password: 'prof123',
      cpf: '111.111.111-11',
      role: 'professor', 
      turmaIds: ['turma-1'],
      createdAt: '2026-01-01T00:00:00.000Z' 
    },
    { 
      id: 'prof-2', 
      name: 'Prof. João Santos', 
      email: 'joao@codeschool.com', 
      password: 'prof123',
      cpf: '222.222.222-22',
      role: 'professor', 
      turmaIds: ['turma-2'],
      createdAt: '2026-01-01T00:00:00.000Z' 
    },
    { 
      id: 'aluno-1', 
      name: 'Ana Costa', 
      email: 'ana@codeschool.com', 
      password: 'aluno123',
      cpf: '333.333.333-33',
      role: 'aluno', 
      turmaId: 'turma-1', 
      createdAt: '2026-01-15T00:00:00.000Z', 
      enrollmentDate: '2026-01-15T00:00:00.000Z',
      courseStartDate: '2026-02-01',
      courseEndDate: '2026-12-01'
    },
    { 
      id: 'aluno-2', 
      name: 'Pedro Lima', 
      email: 'pedro@codeschool.com', 
      password: 'aluno123',
      cpf: '444.444.444-44',
      role: 'aluno', 
      turmaId: 'turma-1', 
      createdAt: '2026-01-10T00:00:00.000Z', 
      enrollmentDate: '2026-01-10T00:00:00.000Z',
      courseStartDate: '2026-01-15',
      courseEndDate: '2026-11-15'
    },
    { 
      id: 'aluno-3', 
      name: 'Lucas Oliveira', 
      email: 'lucas@codeschool.com', 
      password: 'aluno123',
      cpf: '555.555.555-55',
      role: 'aluno', 
      turmaId: 'turma-2', 
      createdAt: '2026-01-05T00:00:00.000Z', 
      enrollmentDate: '2026-01-05T00:00:00.000Z',
      courseStartDate: '2026-01-10',
      courseEndDate: '2026-10-10'
    },
    // Clientes da Lan House (restaurados a partir do backup do usuário)
    { name: 'Caue Vitor Santos Riborio', email: 'caue.vitor.santos.riborio.1783860361877@cliente.local', password: '', phone: '71 987725482', address: 'Rua Direta em frente a mercearia Maia', role: 'cliente', id: 'vvx2w5a', createdAt: '2026-07-12T12:46:01.877Z' },
    { name: 'Jhon Lucas', email: 'jhon.lucas.1783860441291@cliente.local', password: '', role: 'cliente', id: 'j5oin3j', createdAt: '2026-07-12T12:47:21.291Z' },
    { name: 'Luan Jaimes Mata Luz', email: 'luan.jaimes.mata.luz.1783860502946@cliente.local', password: '', address: 'Casa 157 perto do mercado santana', role: 'cliente', id: 'omn2f50', createdAt: '2026-07-12T12:48:22.946Z' },
    { name: 'Vitor hugor Fernandes Dos Santos', email: 'vitor.hugor.fernandes.dos.santos.1783860552715@cliente.local', password: '', address: 'Rua Dipa', role: 'cliente', id: 's11mo2m', createdAt: '2026-07-12T12:49:12.715Z' },
    { name: 'Thales Santana', email: 'thales.santana.1783863422500@cliente.local', password: '', phone: '7182462424', address: 'Final De linha', role: 'cliente', id: 'nioroqf', createdAt: '2026-07-12T13:37:02.501Z' },
    { name: 'Moises Freitas Ramos', email: 'moises.freitas.ramos.1783864164527@cliente.local', password: '', address: 'Rua Dipa, 42', role: 'cliente', id: '2kth985', createdAt: '2026-07-12T13:49:24.527Z' },
    { name: 'Leandro Dos Santos Bito', email: 'leandro.dos.santos.bito.1783864255854@cliente.local', password: '', address: 'Rua São Sonçalo do Retiro 590', role: 'cliente', id: 'cxpyszn', createdAt: '2026-07-12T13:50:55.854Z' },
    { name: 'Eloa Fernandes Dos Santos', email: 'eloa.fernandes.dos.santos.1783864405830@cliente.local', password: '', phone: '71 985390534', address: 'Rua Adipa', role: 'cliente', id: 'prpsaei', createdAt: '2026-07-12T13:53:25.830Z' },
    { name: 'Emanuelly Freitas', email: 'emanuelly.freitas.1783864466710@cliente.local', password: '', phone: '71985390534', address: 'Rua Adipa', role: 'cliente', id: 'bznzg1m', createdAt: '2026-07-12T13:54:26.710Z' },
    { name: 'Stefane Borges de Souza', email: 'stefane.borges.de.souza.1783867370828@cliente.local', password: '', address: 'Rua Santa Adrea - Retiro', role: 'cliente', id: 'bzevwfb', createdAt: '2026-07-12T14:42:50.828Z' },
    { name: 'Yan Lucas', email: 'yan.lucas.1783869269537@cliente.local', password: '', phone: '71991625660', address: 'Rua Francisco de Sá', role: 'cliente', id: '7xpq4vb', createdAt: '2026-07-12T15:14:29.538Z' },
    { name: 'Davi Dos Santos Alves', email: 'davi.dos.santos.alves.1783869367771@cliente.local', password: '', phone: '71 991761888', address: 'Francisco de Sá', role: 'cliente', id: 'eh104w0', createdAt: '2026-07-12T15:16:07.771Z' },
    { name: 'Sandro Conceição criança', email: 'sandro.conceição.criança.1783875773100@cliente.local', password: '', cpf: '13009084595', phone: '71991857214', address: 'Rua São Francisco de Sá', role: 'cliente', id: 'm6lp9sm', createdAt: '2026-07-12T17:02:53.100Z' },
    { name: 'Jose Jonas', email: 'jose.jonas.1783876242933@cliente.local', password: '', phone: '71 993080274', address: 'Rua Francisco Sá', role: 'cliente', id: 'a6twvrx', createdAt: '2026-07-12T17:10:42.933Z' },
    { name: 'Ryan Emanuel Dias Silva - KD', email: 'ryan.emanuel.dias.silva.-.kd.1783883058210@cliente.local', password: '', cpf: '07600005573', phone: '71999934077', address: 'Rua Adipa', role: 'cliente', id: 'ye00wqm', createdAt: '2026-07-12T19:04:18.210Z' },
    { name: 'Gustavo Lage', email: 'gustavo.lage.1783885388651@cliente.local', password: '', phone: '71991486685', address: 'Rua Adalgisa', role: 'cliente', id: 'v0ymyjq', createdAt: '2026-07-12T19:43:08.651Z' },
    { name: 'asd', email: 'asd.1783951087697@cliente.local', password: '', role: 'cliente', id: 'c1mj17b', createdAt: '2026-07-13T13:58:07.697Z' },
    { name: 'Cristian Ronald', email: 'cristian.ronald.1783952731883@cliente.local', password: '', cpf: '86902994595', phone: '7193885694', address: 'Rua Direta São Gonçalo 159', role: 'cliente', id: 's34twfn', createdAt: '2026-07-13T14:25:31.883Z' },
    { name: 'Felipe Antonio Vieira Dos Santos', email: 'felipe.antonio.vieira.dos.santos.1783952879212@cliente.local', password: '', cpf: '10229039502', phone: '71993664397', address: 'Rua direta de são Gonçalo 159', role: 'cliente', id: 'ojqq3u4', createdAt: '2026-07-13T14:27:59.212Z' },
    { name: 'Rodrigo Borges', email: 'rodrigo.borges.1783952953583@cliente.local', password: '', cpf: '86902987541', phone: '7199193777107', address: 'Rua Direta são Gonçalo', role: 'cliente', id: 't8h8olm', createdAt: '2026-07-13T14:29:13.583Z' },
    { name: 'Miguel Ribeiro', email: 'miguel.ribeiro.1783961650508@cliente.local', password: '', cpf: '11017846529', phone: '71993416309', address: 'Rua Agilsa Silva Lima 154', role: 'cliente', id: 'rtqghm3', createdAt: '2026-07-13T16:54:10.508Z' },
    { name: 'Arthor Paixão', email: 'arthor.paixão.1783961708283@cliente.local', password: '', cpf: '11190893525', phone: '71 991096260', address: 'Rua Adalgisa Silva Lima 162 e', role: 'cliente', id: 'd4x8scn', createdAt: '2026-07-13T16:55:08.283Z' },
    { name: 'Uarlen Tavares', email: 'uarlen.tavares.1783961767127@cliente.local', password: '', cpf: '08139478555', phone: '71 985317892', address: 'Rua Adalgisa Silva Lima 162', role: 'cliente', id: 'zgbybxh', createdAt: '2026-07-13T16:56:07.127Z' },
    { name: 'Stevan Conceição', email: 'stevan.conceição.1783969638545@cliente.local', password: '', cpf: '10459311522', phone: '71 993839908', address: 'Rua João Batista 5', role: 'cliente', id: 'sb1irt4', createdAt: '2026-07-13T19:07:18.545Z' },
    { name: 'Larissa Assis', email: 'larissa.assis.1783969807167@cliente.local', password: '', cpf: '04031770570', phone: '71999623195', address: 'Rua Adalgisa 183', role: 'cliente', id: 'q2tbv0y', createdAt: '2026-07-13T19:10:07.167Z' },
    { name: 'Luna', email: 'luna.1783969872133@cliente.local', password: '', role: 'cliente', id: 'y0mki23', createdAt: '2026-07-13T19:11:12.133Z' },
    { name: 'Fabio Dos Santos', email: 'fabio.dos.santos.1783969945195@cliente.local', password: '', cpf: '10530099500', phone: '71981802506', address: 'Rua 8 de dezembro 56F', role: 'cliente', id: 'tfbwqrx', createdAt: '2026-07-13T19:12:25.195Z' },
  ],
  turmas: [
    { id: 'turma-1', name: 'Turma A - Programação Web', description: 'Curso completo de desenvolvimento web', professorId: 'prof-1', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'turma-2', name: 'Turma B - Design UI/UX', description: 'Fundamentos de design de interfaces', professorId: 'prof-2', createdAt: '2026-01-01T00:00:00.000Z' },
  ],
  materials: [
    { id: 'mat-1', turmaId: 'turma-1', professorId: 'prof-1', title: 'Introdução ao HTML', type: 'pdf', fileName: 'intro-html.pdf', fileType: 'pdf', uploadedAt: '2026-01-05T00:00:00.000Z' },
    { id: 'mat-2', turmaId: 'turma-1', professorId: 'prof-1', title: 'Aula 1 - CSS Básico', type: 'video', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', uploadedAt: '2026-01-10T00:00:00.000Z' },
  ],
  submissions: [
    { id: 'sub-1', studentId: 'aluno-1', turmaId: 'turma-1', fileName: 'exercicio-1.pdf', fileType: 'pdf', submittedAt: '2026-01-12T00:00:00.000Z', status: 'pending' },
    { id: 'sub-2', studentId: 'aluno-2', turmaId: 'turma-1', fileName: 'projeto-final.zip', fileType: 'archive', submittedAt: '2026-01-14T00:00:00.000Z', status: 'reviewed' },
  ],
  payments: [
    // Ana Costa - 2026 payments
    { id: 'pay-1', studentId: 'aluno-1', month: '2026-01', amount: 299.90, status: 'paid', paidAt: '2026-01-10T00:00:00.000Z' },
    { id: 'pay-2', studentId: 'aluno-1', month: '2026-02', amount: 299.90, status: 'pending' },
    { id: 'pay-3', studentId: 'aluno-1', month: '2026-03', amount: 299.90, status: 'pending' },
    { id: 'pay-4', studentId: 'aluno-1', month: '2026-04', amount: 299.90, status: 'pending' },
    { id: 'pay-5', studentId: 'aluno-1', month: '2026-05', amount: 299.90, status: 'pending' },
    { id: 'pay-6', studentId: 'aluno-1', month: '2026-06', amount: 299.90, status: 'pending' },
    { id: 'pay-7', studentId: 'aluno-1', month: '2026-07', amount: 299.90, status: 'pending' },
    { id: 'pay-8', studentId: 'aluno-1', month: '2026-08', amount: 299.90, status: 'pending' },
    { id: 'pay-9', studentId: 'aluno-1', month: '2026-09', amount: 299.90, status: 'pending' },
    { id: 'pay-10', studentId: 'aluno-1', month: '2026-10', amount: 299.90, status: 'pending' },
    { id: 'pay-11', studentId: 'aluno-1', month: '2026-11', amount: 299.90, status: 'pending' },
    { id: 'pay-12', studentId: 'aluno-1', month: '2026-12', amount: 299.90, status: 'pending' },
    // Pedro Lima - 2026 payments
    { id: 'pay-13', studentId: 'aluno-2', month: '2026-01', amount: 299.90, status: 'paid', paidAt: '2026-01-08T00:00:00.000Z' },
    { id: 'pay-14', studentId: 'aluno-2', month: '2026-02', amount: 299.90, status: 'pending' },
    { id: 'pay-15', studentId: 'aluno-2', month: '2026-03', amount: 299.90, status: 'pending' },
    // Lucas Oliveira - 2026 payments
    { id: 'pay-16', studentId: 'aluno-3', month: '2026-01', amount: 349.90, status: 'paid', paidAt: '2026-01-05T00:00:00.000Z' },
    { id: 'pay-17', studentId: 'aluno-3', month: '2026-02', amount: 349.90, status: 'pending' },
  ],
  announcements: [
    { id: 'ann-1', title: 'Bem-vindos ao novo semestre!', content: 'Estamos felizes em iniciar mais um período letivo. Confiram os materiais disponíveis.', authorId: 'admin-1', createdAt: '2026-01-15T10:00:00.000Z' },
  ],
  attendanceRecords: [],
  materialProgress: [],
  gameTimeTransactions: [],
  gameSessions: [],
  expenses: [],
  computers: Array.from({ length: 10 }, (_, i) => ({
    id: `pc-${i + 1}`,
    name: `PC${String(i + 1).padStart(2, '0')}`,
    createdAt: '2026-01-01T00:00:00.000Z',
  })),
};

type LanComputerStatus = 'livre' | 'ativo' | 'pausado';

type LanComputerRow = {
  id: string;
  name: string;
  status: string;
  user_id: string | null;
  tempo_comprado_minutos: number;
  tempo_usado_minutos: number;
  timestamp_ultimo_inicio: string | null;
  created_at: string;
  updated_at: string;
};

type LanTimeTransactionRow = {
  id: string;
  user_id: string;
  seller_id: string | null;
  minutes: number;
  amount_paid: number;
  note: string | null;
  computer_id: string | null;
  payment_method: string | null;
  operation: string | null;
  created_at: string;
};

type LanClienteRow = {
  id: string;
  name: string;
  email: string | null;
  cpf: string | null;
  phone: string | null;
  address: string | null;
  age: number | null;
  created_at: string;
};

const toLanComputerStatus = (value: string | null | undefined): LanComputerStatus => {
  if (value === 'ativo' || value === 'pausado' || value === 'livre') return value;
  return 'livre';
};

const cloudComputerToComputer = (row: LanComputerRow): Computer => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  status: toLanComputerStatus(row.status),
  userId: row.user_id ?? undefined,
  tempoCompradoMinutos: Number(row.tempo_comprado_minutos) || 0,
  tempoUsadoMinutos: Number(row.tempo_usado_minutos) || 0,
  timestampUltimoInicio: row.timestamp_ultimo_inicio ?? undefined,
  updatedAt: row.updated_at,
});

const cloudComputerToSession = (row: LanComputerRow): GameSession | undefined => {
  if (!row.user_id) return undefined;
  const totalPurchasedMinutes = Number(row.tempo_comprado_minutos) || 0;
  const usedMinutes = Number(row.tempo_usado_minutos) || 0;
  const status = toLanComputerStatus(row.status) === 'ativo' ? 'running' : 'paused';
  return {
    userId: row.user_id,
    status,
    remainingSeconds: Math.max(0, (totalPurchasedMinutes - usedMinutes) * 60),
    totalPurchasedMinutes,
    usedMinutes,
    lastStartedAt: row.timestamp_ultimo_inicio ?? undefined,
    updatedAt: row.updated_at,
    computerId: row.id,
  };
};

const cloudTxToGameTx = (row: LanTimeTransactionRow): GameTimeTransaction => ({
  id: row.id,
  userId: row.user_id,
  sellerId: row.seller_id || '',
  minutes: Number(row.minutes) || 0,
  amountPaid: Number(row.amount_paid) || 0,
  note: row.note ?? undefined,
  computerId: row.computer_id ?? undefined,
  paymentMethod: row.payment_method ?? undefined,
  operation: row.operation ?? undefined,
  createdAt: row.created_at,
});

const cloudClienteToUser = (row: LanClienteRow): User => ({
  id: row.id,
  name: row.name,
  email: row.email || '',
  password: '',
  cpf: row.cpf ?? undefined,
  phone: row.phone ?? undefined,
  address: row.address ?? undefined,
  age: row.age ?? undefined,
  role: 'cliente',
  createdAt: row.created_at,
});

const readLocalLmsData = (): Partial<LMSData> | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const buildComputerSeedRows = (localData: Partial<LMSData> | null): LanComputerRow[] => {
  const computers = localData?.computers?.length ? localData.computers : initialData.computers;
  const sessions = localData?.gameSessions || [];
  const now = new Date().toISOString();
  return computers.map((computer) => {
    const session = sessions.find((s) => s.computerId === computer.id);
    const remainingMinutes = session ? Math.max(0, Math.ceil(getSessionRemainingSeconds(session) / 60)) : 0;
    const running = !!session?.userId && session.status === 'running' && remainingMinutes > 0;
    return {
      id: computer.id,
      name: computer.name,
      status: session?.userId ? (running ? 'ativo' : 'pausado') : 'livre',
      user_id: session?.userId ?? null,
      tempo_comprado_minutos: remainingMinutes,
      tempo_usado_minutos: 0,
      timestamp_ultimo_inicio: running ? now : null,
      created_at: computer.createdAt || now,
      updated_at: now,
    };
  });
};

const mergeCloudComputerRows = (prev: LMSData, rows: LanComputerRow[]): LMSData => ({
  ...prev,
  computers: rows.map(cloudComputerToComputer).sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR', { numeric: true })
  ),
  gameSessions: rows.map(cloudComputerToSession).filter(Boolean) as GameSession[],
});

const replaceCloudComputerRow = (prev: LMSData, row: LanComputerRow): LMSData => {
  const computer = cloudComputerToComputer(row);
  const session = cloudComputerToSession(row);
  const computers = [
    ...(prev.computers || []).filter((c) => c.id !== row.id),
    computer,
  ].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
  const sessions = (prev.gameSessions || []).filter(
    (s) => s.computerId !== row.id && (!row.user_id || s.userId !== row.user_id)
  );
  if (session) sessions.push(session);
  return { ...prev, computers, gameSessions: sessions };
};

export function LMSProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [data, setData] = useState<LMSData>(initialData);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load data and session from localStorage on mount
  useEffect(() => {
    // Check data version - if outdated, reset to initial data
    const storedVersion = localStorage.getItem(DATA_VERSION_KEY);
    const version = storedVersion ? parseInt(storedVersion) : 0;
    
    if (version < CURRENT_DATA_VERSION) {
      // Data structure changed: reset seed data BUT preserve lan house history
      // (clients, time transactions, sessions and computers) so nothing is lost.
      let preserved: Partial<LMSData> = {};
      try {
        const prev = localStorage.getItem(STORAGE_KEY);
        if (prev) {
          const parsed = JSON.parse(prev) as Partial<LMSData>;
          const prevClientes = (parsed.users || []).filter((u: any) => u?.role === 'cliente');
          const seedIds = new Set(initialData.users.map(u => u.id));
          const mergedUsers = [
            ...initialData.users,
            ...prevClientes.filter((c: any) => !seedIds.has(c.id)),
          ];
          preserved = {
            users: mergedUsers,
            gameTimeTransactions: parsed.gameTimeTransactions || [],
            gameSessions: parsed.gameSessions || [],
            computers: parsed.computers && parsed.computers.length ? parsed.computers : initialData.computers,
          };
        }
      } catch {
        // ignore, fall back to initialData
      }
      const migrated: LMSData = { ...initialData, ...preserved } as LMSData;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      localStorage.setItem(DATA_VERSION_KEY, CURRENT_DATA_VERSION.toString());
      setData(migrated);
      setIsInitialized(true);
      return;
    }
    
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setData(JSON.parse(stored));
      } catch {
        setData(initialData);
      }
    }

    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
      try {
        const userId = JSON.parse(session);
        const storedData = stored ? JSON.parse(stored) : initialData;
        const user = storedData.users.find((u: User) => u.id === userId);
        if (user) {
          setCurrentUser(user);
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }

    setIsInitialized(true);
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  // Lan House cloud state is the source of truth for PCs/timers.
  // localStorage remains only a local cache/backup for fast startup and offline recovery.
  useEffect(() => {
    let cancelled = false;
    const loadLanCloudState = async () => {
      try {
        const [clientesRes, txsRes, computersRes] = await Promise.all([
          supabase.from('lan_clientes').select('*').order('created_at', { ascending: true }),
          supabase.from('lan_time_transactions').select('*').order('created_at', { ascending: false }).limit(2000),
          supabase.from('lan_computers').select('*').order('name', { ascending: true }),
        ]);
        if (cancelled) return;
        let computerRows = (computersRes.data || []) as LanComputerRow[];
        if (computerRows.length === 0) {
          const seedRows = buildComputerSeedRows(readLocalLmsData());
          const seeded = await supabase.from('lan_computers').upsert(seedRows).select('*').order('name', { ascending: true });
          if (!cancelled && !seeded.error) computerRows = (seeded.data || []) as LanComputerRow[];
          if (seeded.error) console.warn('[cloud sync] lan_computers seed failed:', seeded.error.message);
        }
        const cloudClients = ((clientesRes.data || []) as LanClienteRow[]).map(cloudClienteToUser);
        const cloudTxs = ((txsRes.data || []) as LanTimeTransactionRow[]).map(cloudTxToGameTx);
        setData(prev => {
          const userIds = new Set(prev.users.map(u => u.id));
          const mergedUsers = [...prev.users, ...cloudClients.filter(c => !userIds.has(c.id))];
          const txIds = new Set(prev.gameTimeTransactions.map(t => t.id));
          const mergedTxs = [
            ...cloudTxs.filter(t => !txIds.has(t.id)),
            ...prev.gameTimeTransactions,
          ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          return mergeCloudComputerRows(
            { ...prev, users: mergedUsers, gameTimeTransactions: mergedTxs },
            computerRows
          );
        });
      } catch (e) {
        console.warn('[cloud sync] lan house load failed:', e);
      }
    };

    loadLanCloudState();

    const computersChannel = supabase
      .channel('lan-computers-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lan_computers' },
        (payload) => {
          if (cancelled) return;
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string })?.id;
            if (!oldId) return;
            setData(prev => ({
              ...prev,
              computers: (prev.computers || []).filter(c => c.id !== oldId),
              gameSessions: (prev.gameSessions || []).filter(s => s.computerId !== oldId),
            }));
            return;
          }
          const row = payload.new as LanComputerRow;
          if (row?.id) setData(prev => replaceCloudComputerRow(prev, row));
        }
      )
      .subscribe();

    const txChannel = supabase
      .channel('lan-time-transactions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lan_time_transactions' },
        (payload) => {
          if (cancelled) return;
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string })?.id;
            if (!oldId) return;
            setData(prev => ({
              ...prev,
              gameTimeTransactions: prev.gameTimeTransactions.filter(t => t.id !== oldId),
            }));
            return;
          }
          const row = payload.new as LanTimeTransactionRow;
          if (!row?.id) return;
          const tx = cloudTxToGameTx(row);
          setData(prev => {
            const exists = prev.gameTimeTransactions.some(t => t.id === tx.id);
            const txs = exists
              ? prev.gameTimeTransactions.map(t => t.id === tx.id ? tx : t)
              : [tx, ...prev.gameTimeTransactions];
            return { ...prev, gameTimeTransactions: txs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
          });
        }
      )
      .subscribe();

    const clientesChannel = supabase
      .channel('lan-clientes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lan_clientes' },
        (payload) => {
          if (cancelled) return;
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string })?.id;
            if (!oldId) return;
            setData(prev => ({ ...prev, users: prev.users.filter(u => u.id !== oldId) }));
            return;
          }
          const row = payload.new as LanClienteRow;
          if (!row?.id) return;
          const user = cloudClienteToUser(row);
          setData(prev => {
            const exists = prev.users.some(u => u.id === user.id);
            const users = exists
              ? prev.users.map(u => u.id === user.id ? { ...u, ...user } : u)
              : [...prev.users, user];
            return { ...prev, users };
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(computersChannel);
      supabase.removeChannel(txChannel);
      supabase.removeChannel(clientesChannel);
    };
  }, []);


  // Heartbeat: every 60s persist elapsed time of ACTIVE PCs into the DB so
  // nothing is lost if the browser/PC dies. Uses a ref-free snapshot via setData.
  useEffect(() => {
    const tick = async () => {
      const snapshot = await new Promise<Computer[]>((resolve) => {
        setData(prev => {
          resolve(prev.computers || []);
          return prev;
        });
      });
      const active = snapshot.filter(c => c.status === 'ativo' && c.userId && c.timestampUltimoInicio);
      for (const c of active) {
        const { data: row, error } = await supabase.rpc('lan_computer_heartbeat', { _computer_id: c.id });
        if (error) console.warn('[cloud sync] heartbeat failed:', error.message);
        else if (row) setData(prev => replaceCloudComputerRow(prev, row as LanComputerRow));
      }
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);


  const loginByCredentials = (email: string, password: string): { success: boolean; error?: string } => {
    const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      return { success: false, error: 'E-mail não encontrado' };
    }
    
    if (user.password !== password) {
      return { success: false, error: 'Senha incorreta' };
    }
    
    setCurrentUser(user);
    localStorage.setItem(SESSION_KEY, JSON.stringify(user.id));
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const addUser = (userData: Omit<User, 'id' | 'createdAt'>) => {
    const newUser: User = {
      ...userData,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setData(prev => ({ ...prev, users: [...prev.users, newUser] }));

    // Auto-create 2026 payments for new student
    if (userData.role === 'aluno') {
      const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
      const newPayments = months.map(month => ({
        id: generateId(),
        studentId: newUser.id,
        month: `2026-${month}`,
        amount: 299.90,
        status: 'pending' as const,
      }));
      setData(prev => ({ ...prev, payments: [...prev.payments, ...newPayments] }));
    }

    // Fire-and-forget cloud sync for lan house clients
    if (userData.role === 'cliente') {
      supabase.from('lan_clientes').upsert({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        cpf: newUser.cpf ?? null,
        phone: newUser.phone ?? null,
        address: newUser.address ?? null,
        age: newUser.age ?? null,
        created_at: newUser.createdAt,
      }).then(({ error }) => {
        if (error) console.warn('[cloud sync] lan_clientes upsert failed:', error.message);
      });
    }
  };

  const updateUser = (id: string, userData: Partial<User>) => {
    setData(prev => {
      const target = prev.users.find(u => u.id === id);
      const syncTurmas =
        target?.role === 'professor' && userData.turmaIds !== undefined;
      const newTurmaIds = userData.turmaIds || [];

      // Cloud sync for cliente edits
      if (target?.role === 'cliente') {
        supabase.from('lan_clientes').upsert({
          id,
          name: userData.name ?? target.name,
          email: userData.email ?? target.email,
          cpf: (userData.cpf ?? target.cpf) ?? null,
          phone: (userData.phone ?? target.phone) ?? null,
          address: (userData.address ?? target.address) ?? null,
          age: (userData.age ?? target.age) ?? null,
          updated_at: new Date().toISOString(),
        }).then(({ error }) => {
          if (error) console.warn('[cloud sync] lan_clientes update failed:', error.message);
        });
      }

      return {
        ...prev,
        users: prev.users.map(u => (u.id === id ? { ...u, ...userData } : u)),
        turmas: syncTurmas
          ? prev.turmas.map(t => {
              if (newTurmaIds.includes(t.id)) return { ...t, professorId: id };
              if (t.professorId === id && !newTurmaIds.includes(t.id)) {
                return { ...t, professorId: '' };
              }
              return t;
            })
          : prev.turmas,
      };
    });

    if (currentUser?.id === id) {
      setCurrentUser(prev => prev ? { ...prev, ...userData } : null);
    }
  };

  const deleteUser = (id: string) => {
    setData(prev => {
      const target = prev.users.find(u => u.id === id);
      const isProfessor = target?.role === 'professor';

      if (target?.role === 'cliente') {
        supabase.from('lan_clientes').delete().eq('id', id).then(({ error }) => {
          if (error) console.warn('[cloud sync] lan_clientes delete failed:', error.message);
        });
      }


      return {
        ...prev,
        users: prev.users.filter(u => u.id !== id),
        // Clean student-related data
        payments: prev.payments.filter(p => p.studentId !== id),
        submissions: prev.submissions.filter(s => s.studentId !== id),
        materialProgress: prev.materialProgress.filter(p => p.studentId !== id),
        // Remove the deleted student from attendance records
        attendanceRecords: prev.attendanceRecords.map(r => ({
          ...r,
          records: r.records.filter(rec => rec.studentId !== id),
        })),
        // If a professor was deleted, unassign their turmas + clean materials authored
        turmas: isProfessor
          ? prev.turmas.map(t => (t.professorId === id ? { ...t, professorId: '' } : t))
          : prev.turmas,
        materials: isProfessor
          ? prev.materials.filter(m => m.professorId !== id)
          : prev.materials,
      };
    });
  };

  const addTurma = (turmaData: Omit<Turma, 'id' | 'createdAt'>) => {
    const newTurma: Turma = {
      ...turmaData,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    // Single atomic update: add turma + sync professor's turmaIds (avoids stale reads)
    setData(prev => ({
      ...prev,
      turmas: [...prev.turmas, newTurma],
      users: prev.users.map(u =>
        u.id === turmaData.professorId
          ? { ...u, turmaIds: [...(u.turmaIds || []), newTurma.id] }
          : u
      ),
    }));
  };

  const updateTurma = (id: string, turmaData: Partial<Turma>) => {
    setData(prev => {
      const existing = prev.turmas.find(t => t.id === id);
      const oldProfessorId = existing?.professorId;
      const newProfessorId = turmaData.professorId;
      const professorChanged =
        newProfessorId !== undefined && newProfessorId !== oldProfessorId;

      return {
        ...prev,
        turmas: prev.turmas.map(t => (t.id === id ? { ...t, ...turmaData } : t)),
        users: professorChanged
          ? prev.users.map(u => {
              if (u.id === oldProfessorId) {
                return { ...u, turmaIds: (u.turmaIds || []).filter(tid => tid !== id) };
              }
              if (u.id === newProfessorId) {
                const ids = u.turmaIds || [];
                return { ...u, turmaIds: ids.includes(id) ? ids : [...ids, id] };
              }
              return u;
            })
          : prev.users,
      };
    });
  };

  const deleteTurma = (id: string) => {
    setData(prev => {
      const materialIds = prev.materials.filter(m => m.turmaId === id).map(m => m.id);
      return {
        ...prev,
        turmas: prev.turmas.filter(t => t.id !== id),
        materials: prev.materials.filter(m => m.turmaId !== id),
        submissions: prev.submissions.filter(s => s.turmaId !== id),
        attendanceRecords: prev.attendanceRecords.filter(r => r.turmaId !== id),
        materialProgress: prev.materialProgress.filter(p => !materialIds.includes(p.materialId)),
        // Unassign deleted turma from students and professors
        users: prev.users.map(u => {
          if (u.turmaId === id) return { ...u, turmaId: undefined };
          if (u.turmaIds?.includes(id)) {
            return { ...u, turmaIds: u.turmaIds.filter(tid => tid !== id) };
          }
          return u;
        }),
      };
    });
  };

  const addMaterial = (materialData: Omit<Material, 'id' | 'uploadedAt'>) => {
    const newMaterial: Material = {
      ...materialData,
      id: generateId(),
      uploadedAt: new Date().toISOString(),
    };
    setData(prev => ({ ...prev, materials: [...prev.materials, newMaterial] }));
  };

  const deleteMaterial = (id: string) => {
    setData(prev => ({
      ...prev,
      materials: prev.materials.filter(m => m.id !== id),
    }));
  };

  const addSubmission = (submissionData: Omit<StudentSubmission, 'id' | 'submittedAt' | 'status'>) => {
    const newSubmission: StudentSubmission = {
      ...submissionData,
      id: generateId(),
      submittedAt: new Date().toISOString(),
      status: 'pending',
    };
    setData(prev => ({ ...prev, submissions: [...prev.submissions, newSubmission] }));
  };

  const updateSubmission = (id: string, submissionData: Partial<StudentSubmission>) => {
    setData(prev => ({
      ...prev,
      submissions: prev.submissions.map(s => s.id === id ? { ...s, ...submissionData } : s),
    }));
  };

  const addPayment = (paymentData: Omit<Payment, 'id'>) => {
    const newPayment: Payment = {
      ...paymentData,
      id: generateId(),
    };
    setData(prev => ({ ...prev, payments: [...prev.payments, newPayment] }));
  };

  const updatePayment = (id: string, paymentData: Partial<Payment>) => {
    setData(prev => ({
      ...prev,
      payments: prev.payments.map(p => p.id === id ? { ...p, ...paymentData } : p),
    }));
  };

  const markPaymentAsPaid = (id: string) => {
    setData(prev => ({
      ...prev,
      payments: prev.payments.map(p => 
        p.id === id ? { ...p, status: 'paid' as const, paidAt: new Date().toISOString() } : p
      ),
    }));
  };

  const markPaymentAsPending = (id: string) => {
    setData(prev => ({
      ...prev,
      payments: prev.payments.map(p => 
        p.id === id ? { ...p, status: 'pending' as const, paidAt: undefined } : p
      ),
    }));
  };

  const deletePayment = (id: string) => {
    setData(prev => ({ ...prev, payments: prev.payments.filter(p => p.id !== id) }));
  };



  const generate2026Payments = (studentId: string) => {
    const existingMonths = data.payments
      .filter(p => p.studentId === studentId && p.month.startsWith('2026'))
      .map(p => p.month);
    
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const newPayments: Payment[] = [];
    
    months.forEach(month => {
      const monthKey = `2026-${month}`;
      if (!existingMonths.includes(monthKey)) {
        newPayments.push({
          id: generateId(),
          studentId,
          month: monthKey,
          amount: 299.90,
          status: 'pending',
        });
      }
    });
    
    if (newPayments.length > 0) {
      setData(prev => ({ ...prev, payments: [...prev.payments, ...newPayments] }));
    }
  };

  // Announcements
  const addAnnouncement = (announcementData: Omit<Announcement, 'id' | 'createdAt'>) => {
    const newAnnouncement: Announcement = {
      ...announcementData,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setData(prev => ({ ...prev, announcements: [newAnnouncement, ...prev.announcements] }));
  };

  const deleteAnnouncement = (id: string) => {
    setData(prev => ({
      ...prev,
      announcements: prev.announcements.filter(a => a.id !== id),
    }));
  };

  // Attendance
  const addAttendanceRecord = (recordData: Omit<AttendanceRecord, 'id' | 'createdAt'>) => {
    // Check if record already exists for this turma and date
    const existing = data.attendanceRecords.find(
      r => r.turmaId === recordData.turmaId && r.date === recordData.date
    );
    
    if (existing) {
      // Update existing record
      setData(prev => ({
        ...prev,
        attendanceRecords: prev.attendanceRecords.map(r => 
          r.id === existing.id ? { ...r, records: recordData.records } : r
        ),
      }));
    } else {
      const newRecord: AttendanceRecord = {
        ...recordData,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      setData(prev => ({ ...prev, attendanceRecords: [...prev.attendanceRecords, newRecord] }));
    }
  };

  const getAttendanceByTurmaAndDate = (turmaId: string, date: string) => 
    data.attendanceRecords.find(r => r.turmaId === turmaId && r.date === date);

  const getAttendanceByTurma = (turmaId: string) =>
    data.attendanceRecords
      .filter(r => r.turmaId === turmaId)
      .sort((a, b) => b.date.localeCompare(a.date));

  const getStudentAttendance = (studentId: string) => {
    const result: { date: string; present: boolean; note?: string; turmaId: string }[] = [];
    data.attendanceRecords.forEach(r => {
      const rec = r.records.find(x => x.studentId === studentId);
      if (rec) {
        result.push({ date: r.date, present: rec.present, note: rec.note, turmaId: r.turmaId });
      }
    });
    return result.sort((a, b) => b.date.localeCompare(a.date));
  };

  // Progress
  const toggleMaterialProgress = (studentId: string, materialId: string) => {
    const existing = data.materialProgress.find(
      p => p.studentId === studentId && p.materialId === materialId
    );
    
    if (existing) {
      setData(prev => ({
        ...prev,
        materialProgress: prev.materialProgress.filter(p => p.id !== existing.id),
      }));
    } else {
      const newProgress: MaterialProgress = {
        id: generateId(),
        studentId,
        materialId,
        completedAt: new Date().toISOString(),
      };
      setData(prev => ({ ...prev, materialProgress: [...prev.materialProgress, newProgress] }));
    }
  };

  const getStudentProgress = (studentId: string) => 
    data.materialProgress.filter(p => p.studentId === studentId);

  const getStudentsByTurma = (turmaId: string) => 
    data.users.filter(u => u.role === 'aluno' && u.turmaId === turmaId);

  const getMaterialsByTurma = (turmaId: string) => 
    data.materials.filter(m => m.turmaId === turmaId);

  const getSubmissionsByTurma = (turmaId: string) => 
    data.submissions.filter(s => s.turmaId === turmaId);

  const getPaymentsByStudent = (studentId: string) => 
    data.payments.filter(p => p.studentId === studentId);

  const getTurmaById = (id: string) => data.turmas.find(t => t.id === id);
  
  const getUserById = (id: string) => data.users.find(u => u.id === id);

  const getTurmasByProfessor = (professorId: string) => {
    const professor = data.users.find(u => u.id === professorId);
    if (!professor?.turmaIds) {
      // Fallback to old behavior for backwards compatibility
      return data.turmas.filter(t => t.professorId === professorId);
    }
    return data.turmas.filter(t => professor.turmaIds?.includes(t.id));
  };

  // Game time (lan house) — cloud-first. The database stores the current machine
  // state and timestamps; the UI only derives the live countdown from that state.
  const applyCloudComputer = (row: LanComputerRow | null | undefined) => {
    if (!row?.id) return;
    setData(prev => replaceCloudComputerRow(prev, row));
  };

  const deleteGameTimeTransaction = async (id: string) => {
    setData(prev => ({
      ...prev,
      gameTimeTransactions: prev.gameTimeTransactions.filter(t => t.id !== id),
    }));
    const { error } = await supabase.from('lan_time_transactions').delete().eq('id', id);
    if (error) console.warn('[cloud sync] lan_time_transactions delete failed:', error.message);
  };



  const syncGameTx = async (tx: GameTimeTransaction) => {
    const { error } = await supabase.from('lan_time_transactions').upsert({
      id: tx.id,
      user_id: tx.userId,
      seller_id: tx.sellerId || null,
      minutes: tx.minutes,
      amount_paid: tx.amountPaid,
      note: tx.note ?? null,
      computer_id: tx.computerId ?? null,
      payment_method: tx.paymentMethod ?? null,
      operation: tx.operation ?? null,
      created_at: tx.createdAt,
    });
    if (error) console.warn('[cloud sync] lan_time_transactions failed:', error.message);
  };

  const addGameTime = async (userId: string, minutes: number, amountPaid: number, note?: string, opts?: { computerId?: string; paymentMethod?: string; operation?: string }) => {
    if (minutes <= 0) return;
    const session = getGameSession(userId);
    const computerId = opts?.computerId || session?.computerId;
    const tx: GameTimeTransaction = {
      id: generateId(),
      userId,
      sellerId: currentUser?.id || '',
      minutes,
      amountPaid,
      note,
      createdAt: new Date().toISOString(),
      computerId,
      paymentMethod: opts?.paymentMethod,
      operation: opts?.operation || 'Adição de tempo',
    };
    setData(prev => ({
      ...prev,
      gameTimeTransactions: [tx, ...prev.gameTimeTransactions],
    }));
    await syncGameTx(tx);
    if (computerId) {
      const { data: row, error } = await supabase.rpc('lan_computer_add_time', {
        _computer_id: computerId,
        _minutes: minutes,
      });
      if (error) console.warn('[cloud sync] lan_computers add time failed:', error.message);
      else applyCloudComputer(row as LanComputerRow);
    }
  };

  const removeGameTime = async (userId: string, minutes: number, note?: string) => {
    if (minutes <= 0) return;
    const session = getGameSession(userId);
    const tx: GameTimeTransaction = {
      id: generateId(),
      userId,
      sellerId: currentUser?.id || '',
      minutes: -Math.abs(minutes),
      amountPaid: 0,
      note,
      createdAt: new Date().toISOString(),
      computerId: session?.computerId,
      operation: 'Retirada de tempo',
    };
    setData(prev => ({
      ...prev,
      gameTimeTransactions: [tx, ...prev.gameTimeTransactions],
    }));
    await syncGameTx(tx);
    if (session?.computerId) {
      const { data: row, error } = await supabase.rpc('lan_computer_remove_time', {
        _computer_id: session.computerId,
        _minutes: Math.abs(minutes),
      });
      if (error) console.warn('[cloud sync] lan_computers remove time failed:', error.message);
      else applyCloudComputer(row as LanComputerRow);
    }
  };

  const getUserTimeBalance = (userId: string) => {
    const activeSession = getGameSession(userId);
    if (activeSession) return Math.ceil(getSessionRemainingSeconds(activeSession) / 60);
    return data.gameTimeTransactions
      .filter(t => t.userId === userId)
      .reduce((sum, t) => sum + t.minutes, 0);
  };

  const getUserTimeTransactions = (userId: string) =>
    data.gameTimeTransactions
      .filter(t => t.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const importGameTransactions = (txs: GameTimeTransaction[]) => {
    if (!txs.length) return 0;
    let added = 0;
    setData(prev => {
      const existingIds = new Set(prev.gameTimeTransactions.map(t => t.id));
      const toAdd = txs.filter(t => t.id && !existingIds.has(t.id));
      added = toAdd.length;
      if (!toAdd.length) return prev;
      const merged = [...toAdd, ...prev.gameTimeTransactions].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
      return { ...prev, gameTimeTransactions: merged };
    });
    return added;
  };

  const getGameSession = (userId: string) =>
    (data.gameSessions || []).find(s => s.userId === userId);

  const startGameSession = async (userId: string) => {
    const existing = getGameSession(userId);
    if (!existing?.computerId || getSessionRemainingSeconds(existing) <= 0) return;
    const { data: row, error } = await supabase.rpc('lan_computer_start', {
      _computer_id: existing.computerId,
    });
    if (error) console.warn('[cloud sync] lan_computers start failed:', error.message);
    else applyCloudComputer(row as LanComputerRow);
  };

  const pauseGameSession = async (userId: string) => {
    const existing = getGameSession(userId);
    if (!existing?.computerId) return;
    const { data: row, error } = await supabase.rpc('lan_computer_pause', {
      _computer_id: existing.computerId,
    });
    if (error) console.warn('[cloud sync] lan_computers pause failed:', error.message);
    else applyCloudComputer(row as LanComputerRow);
  };

  // Finishes a session: consumes remaining time, records the finalization, frees the computer.
  const finishGameSession = async (userId: string) => {
    const existing = getGameSession(userId);
    if (!existing?.computerId) return;
    const remainingMinutes = Math.ceil(getSessionRemainingSeconds(existing) / 60);
    if (remainingMinutes > 0) {
      const finalTx: GameTimeTransaction = {
        id: generateId(),
        userId,
        sellerId: currentUser?.id || '',
        minutes: -remainingMinutes,
        amountPaid: 0,
        note: 'Sessão finalizada',
        createdAt: new Date().toISOString(),
        computerId: existing.computerId,
        operation: 'Finalização',
      };
      setData(prev => ({ ...prev, gameTimeTransactions: [finalTx, ...prev.gameTimeTransactions] }));
      await syncGameTx(finalTx);
    }
    const { data: pausedRow, error: pauseError } = await supabase.rpc('lan_computer_pause', {
      _computer_id: existing.computerId,
    });
    if (pauseError) {
      console.warn('[cloud sync] lan_computers finish pause failed:', pauseError.message);
      return;
    }
    const settled = pausedRow as LanComputerRow;
    const { data: row, error } = await supabase
      .from('lan_computers')
      .update({
        status: 'livre',
        user_id: null,
        tempo_usado_minutos: settled.tempo_comprado_minutos,
        timestamp_ultimo_inicio: null,
      })
      .eq('id', existing.computerId)
      .select('*')
      .single();
    if (error) console.warn('[cloud sync] lan_computers finish failed:', error.message);
    else applyCloudComputer(row as LanComputerRow);
  };

  // ===== Computers =====
  const getSessionByComputer = (computerId: string) =>
    (data.gameSessions || []).find(s => s.computerId === computerId);

  const addComputer = async (name?: string) => {
    const list = data.computers || [];
    const nextNum = list.length + 1;
    const now = new Date().toISOString();
    const row = {
      id: generateId(),
      name: name?.trim() || `PC${String(nextNum).padStart(2, '0')}`,
      status: 'livre',
      user_id: null,
      tempo_comprado_minutos: 0,
      tempo_usado_minutos: 0,
      timestamp_ultimo_inicio: null,
      created_at: now,
    };
    const { data: inserted, error } = await supabase.from('lan_computers').insert(row).select('*').single();
    if (error) console.warn('[cloud sync] lan_computers insert failed:', error.message);
    else applyCloudComputer(inserted as LanComputerRow);
  };

  const removeComputer = async (id: string) => {
    const { error } = await supabase.from('lan_computers').delete().eq('id', id);
    if (error) {
      console.warn('[cloud sync] lan_computers delete failed:', error.message);
      return;
    }
    setData(prev => ({
      ...prev,
      computers: (prev.computers || []).filter(c => c.id !== id),
      gameSessions: (prev.gameSessions || []).filter(s => s.computerId !== id),
    }));
  };

  const renameComputer = async (id: string, name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const { data: row, error } = await supabase
      .from('lan_computers')
      .update({ name: cleanName })
      .eq('id', id)
      .select('*')
      .single();
    if (error) console.warn('[cloud sync] lan_computers rename failed:', error.message);
    else applyCloudComputer(row as LanComputerRow);
  };

  // Seats a player at a computer (or frees the player's current computer).
  // Disconnect saves the client's remaining balance to lan_clientes.saldo_minutos.
  // Assign restores that saldo so the client resumes with the same time on any PC.
  const assignComputer = async (userId: string, computerId: string | undefined) => {
    if (!computerId) {
      const existing = getGameSession(userId);
      if (!existing?.computerId) return;
      // Atomic on the server: recomputes remaining on server clock, writes
      // saldo_minutos to lan_clientes and frees the PC in a single tx.
      const { data: row, error } = await supabase.rpc('lan_computer_disconnect_save_saldo', {
        _computer_id: existing.computerId,
      });
      if (error) {
        console.warn('[cloud sync] lan_computers disconnect_save_saldo failed:', error.message);
        return;
      }
      applyCloudComputer(row as LanComputerRow);
      return;
    }


    let initialMinutes = 0;
    const { data: cliente, error: cliErr } = await supabase
      .from('lan_clientes')
      .select('saldo_minutos' as never)
      .eq('id', userId)
      .maybeSingle();
    if (cliErr) console.warn('[cloud sync] lan_clientes saldo read failed:', cliErr.message);
    else if (cliente) initialMinutes = Number((cliente as { saldo_minutos?: number }).saldo_minutos) || 0;

    const { data: row, error } = await supabase.rpc('lan_computer_assign', {
      _computer_id: computerId,
      _user_id: userId,
      _initial_minutes: initialMinutes,
    } as { _computer_id: string; _user_id: string });
    if (error) console.warn('[cloud sync] lan_computers assign failed:', error.message);
    else applyCloudComputer(row as LanComputerRow);

    if (initialMinutes > 0) {
      const { error: zeroErr } = await supabase
        .from('lan_clientes')
        .update({ saldo_minutos: 0, updated_at: new Date().toISOString() } as never)
        .eq('id', userId);
      if (zeroErr) console.warn('[cloud sync] lan_clientes saldo reset failed:', zeroErr.message);
    }
  };

  // ===== Expenses =====
  const addExpense = (expense: Omit<Expense, 'id' | 'createdBy'>) => {
    const newExpense: Expense = {
      ...expense,
      id: generateId(),
      createdBy: currentUser?.id || 'system',
    };
    setData(prev => ({ ...prev, expenses: [newExpense, ...(prev.expenses || [])] }));
  };

  const deleteExpense = (id: string) => {
    setData(prev => ({ ...prev, expenses: (prev.expenses || []).filter(e => e.id !== id) }));
  };

  const importExpenses = (expenses: Expense[]) => {
    let added = 0;
    setData(prev => {
      const existing = prev.expenses || [];
      const ids = new Set(existing.map(e => e.id));
      const toAdd = expenses.filter(e => !ids.has(e.id));
      added = toAdd.length;
      return { ...prev, expenses: [...toAdd, ...existing] };
    });
    return added;
  };

  // Empurra clientes locais e transações de tempo para o Cloud (upsert em massa).
  // Útil pra migrar o que está no localStorage do navegador para o banco.
  const syncLanHouseToCloud = async () => {
    try {
      const clientes = (data.users || []).filter(u => u.role === 'cliente');
      const clienteRows = clientes.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email || null,
        cpf: c.cpf ?? null,
        phone: c.phone ?? null,
        address: c.address ?? null,
        age: c.age ?? null,
        created_at: c.createdAt,
      }));
      let clientesCount = 0;
      if (clienteRows.length) {
        const { error } = await supabase.from('lan_clientes').upsert(clienteRows, { onConflict: 'id' });
        if (error) throw error;
        clientesCount = clienteRows.length;
      }

      const txs = data.gameTimeTransactions || [];
      const txRows = txs.map(t => ({
        id: t.id,
        user_id: t.userId,
        seller_id: t.sellerId || null,
        minutes: t.minutes,
        amount_paid: t.amountPaid,
        note: t.note ?? null,
        computer_id: t.computerId ?? null,
        payment_method: t.paymentMethod ?? null,
        operation: t.operation ?? null,
        created_at: t.createdAt,
      }));
      let txCount = 0;
      // upsert em lotes de 500 pra evitar payload gigante
      for (let i = 0; i < txRows.length; i += 500) {
        const batch = txRows.slice(i, i + 500);
        const { error } = await supabase.from('lan_time_transactions').upsert(batch, { onConflict: 'id' });
        if (error) throw error;
        txCount += batch.length;
      }
      return { clientes: clientesCount, transactions: txCount };
    } catch (e: any) {
      console.warn('[cloud sync] syncLanHouseToCloud failed:', e?.message || e);
      return { clientes: 0, transactions: 0, error: e?.message || String(e) };
    }
  };







  return (
    <LMSContext.Provider value={{
      currentUser,
      isInitialized,
      users: data.users,
      turmas: data.turmas,
      materials: data.materials,
      submissions: data.submissions,
      payments: data.payments,
      announcements: data.announcements,
      attendanceRecords: data.attendanceRecords,
      materialProgress: data.materialProgress,
      loginByCredentials,
      logout,
      addUser,
      updateUser,
      deleteUser,
      addTurma,
      updateTurma,
      deleteTurma,
      addMaterial,
      deleteMaterial,
      addSubmission,
      updateSubmission,
      addPayment,
      updatePayment,

      deletePayment,
      markPaymentAsPaid,
      markPaymentAsPending,
      deleteGameTimeTransaction,

      getStudentsByTurma,
      getMaterialsByTurma,
      getSubmissionsByTurma,
      getPaymentsByStudent,
      getTurmaById,
      getUserById,
      getTurmasByProfessor,
      generate2026Payments,
      addAnnouncement,
      deleteAnnouncement,
      addAttendanceRecord,
      getAttendanceByTurmaAndDate,
      getAttendanceByTurma,
      getStudentAttendance,
      toggleMaterialProgress,
      getStudentProgress,
      gameTimeTransactions: data.gameTimeTransactions,
      gameSessions: data.gameSessions,
      addGameTime,
      removeGameTime,
      getUserTimeBalance,
      getUserTimeTransactions,
      importGameTransactions,
      getGameSession,
      startGameSession,
      pauseGameSession,
      finishGameSession,
      computers: data.computers || [],
      addComputer,
      removeComputer,
      renameComputer,
      assignComputer,
      getSessionByComputer,
      expenses: data.expenses || [],
      addExpense,
      deleteExpense,
      importExpenses,
      syncLanHouseToCloud,
    }}>
      {children}
    </LMSContext.Provider>
  );
}

export function useLMS() {
  const context = useContext(LMSContext);
  if (!context) {
    throw new Error('useLMS must be used within a LMSProvider');
  }
  return context;
}
