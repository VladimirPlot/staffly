import api from "../../shared/api/apiClient";

export type IncomePeriodSummary = {
  id: number;
  name: string;
  description?: string | null;
  shiftCount: number;
  totalHours: string;
  totalIncome: string;
  totalTips: string;
  totalPersonalRevenue: string;
  createdAt: string;
  updatedAt: string;
};

export type IncomeShift = {
  id: number;
  date: string;
  type: "SHIFT" | "HOURLY";
  fixedAmount?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  hourlyRate?: string | null;
  tipsAmount?: string | null;
  personalRevenue?: string | null;
  comment?: string | null;
  hours: string;
  totalIncome: string;
  createdAt: string;
  updatedAt: string;
};

export type IncomePeriodDetail = {
  period: IncomePeriodSummary;
  shifts: IncomeShift[];
};

export type SaveIncomePeriodPayload = {
  name: string;
  description?: string;
};

export type SaveIncomeShiftPayload = {
  date: string;
  type: "SHIFT" | "HOURLY";
  fixedAmount?: number;
  startTime?: string;
  endTime?: string;
  hourlyRate?: number;
  tipsAmount?: number;
  personalRevenue?: number;
  comment?: string;
};

export type PersonalNote = {
  id: number;
  title?: string | null;
  content?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SavePersonalNotePayload = {
  title?: string;
  content?: string;
};

export async function listIncomePeriods() {
  const res = await api.get<IncomePeriodSummary[]>("/api/me/income/periods");
  return res.data;
}

export async function createIncomePeriod(payload: SaveIncomePeriodPayload) {
  const res = await api.post<IncomePeriodSummary>("/api/me/income/periods", payload);
  return res.data;
}

export async function updateIncomePeriod(id: number, payload: SaveIncomePeriodPayload) {
  const res = await api.patch<IncomePeriodSummary>(`/api/me/income/periods/${id}`, payload);
  return res.data;
}

export async function deleteIncomePeriod(id: number) {
  await api.delete(`/api/me/income/periods/${id}`);
}

export async function getIncomePeriod(id: number) {
  const res = await api.get<IncomePeriodDetail>(`/api/me/income/periods/${id}`);
  return res.data;
}

export async function createIncomeShift(periodId: number, payload: SaveIncomeShiftPayload) {
  const res = await api.post<IncomeShift>(`/api/me/income/periods/${periodId}/shifts`, payload);
  return res.data;
}

export async function updateIncomeShift(id: number, payload: SaveIncomeShiftPayload) {
  const res = await api.patch<IncomeShift>(`/api/me/income/shifts/${id}`, payload);
  return res.data;
}

export async function deleteIncomeShift(id: number) {
  await api.delete(`/api/me/income/shifts/${id}`);
}

export async function listNotes() {
  const res = await api.get<PersonalNote[]>("/api/me/notes");
  return res.data;
}

export async function createNote(payload: SavePersonalNotePayload) {
  const res = await api.post<PersonalNote>("/api/me/notes", payload);
  return res.data;
}

export async function updateNote(id: number, payload: SavePersonalNotePayload) {
  const res = await api.patch<PersonalNote>(`/api/me/notes/${id}`, payload);
  return res.data;
}

export async function deleteNote(id: number) {
  await api.delete(`/api/me/notes/${id}`);
}
