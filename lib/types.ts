export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  author: string;
}

export interface Resident {
  id: string;
  name: string;
  block?: string;
  number?: string;
}

export interface Payment {
  id: string;
  residentId: string;
  residentName: string;
  year: number;
  months: number[]; // 1-12
  amount: number;
  paymentDate: string; // YYYY-MM-DD
  createdAt: string;
}

export interface CashEntry {
  id: string;
  description: string;
  date: string; // YYYY-MM-DD
  type: 'income' | 'expense';
  amount: number;
  category: string;
  paymentId?: string; // Linked to a payment
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  isActive: boolean;
  createdAt: string;
}
