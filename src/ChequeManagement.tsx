import { useMemo, useState } from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, X, Building2,
  BookOpen, Clock3, AlertCircle, SlidersHorizontal,
} from "lucide-react"
import "./ChequeManagement.css";

type Cheque = {
  id: string; supplier: string; account: string; chequeBook: string;
  chequeNumber: string; amount: number; chequeDate: string; issueDate: string;
  purpose: string; notes: string; status: "Pending" | "Cleared" | "Cancelled";
};

type Account = { id: string; name: string; bank: string; openingBalance: number; odLimit: number; chequeBook: string; };

const initialAccounts: Account[] = [
  { id: "bank-1", name: "Bank Account 1", bank: "Add bank name", openingBalance: 0, odLimit: 0, chequeBook: "Cheque Book 1" },
  { id: "bank-2", name: "Bank Account 2", bank: "Add bank name", openingBalance: 0, odLimit: 0, chequeBook: "Cheque Book 2" },
];
const money = (value: number) => `LKR ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export default function ChequeManagement({ mode = "calendar" }: { mode?: "calendar" | "accounts" }) {
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(isoDate(today));
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [showForm, setShowForm] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [accountId, setAccountId] = useState("bank-1");
  const [chequeNumber, setChequeNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [chequeDate, setChequeDate] = useState(isoDate(today));
  const [issueDate, setIssueDate] = useState(isoDate(today));
  const [purpose, setPurpose] = useState("Supplier payment");
  const [notes, setNotes] = useState("");
  const [filterAccount, setFilterAccount] = useState("all");
  const [editingAccount, setEditingAccount] = useState<string | null>(null);

  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const calendarCells = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (calendarCells.length % 7) calendarCells.push(null);
  const monthLabel = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const selectedCheques = useMemo(() => cheques.filter((item) => item.chequeDate === selectedDate && (filterAccount === "all" || item.account === filterAccount)), [cheques, selectedDate, filterAccount]);
  const selectedTotal = selectedCheques.filter((item) => item.status === "Pending").reduce((sum, item) => sum + item.amount, 0);
  const accountForForm = accounts.find((item) => item.id === accountId) ?? accounts[0];

  function openAdd(date = selectedDate) {
    setSelectedDate(date); setChequeDate(date); setIssueDate(isoDate(today));
    setSupplier(""); setChequeNumber(""); setAmount(""); setPurpose("Supplier payment"); setNotes("");
    setAccountId("bank-1"); setShowForm(true);
  }
  function saveCheque(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const book = accounts.find((item) => item.id === accountId)?.chequeBook ?? "Cheque Book 1";
    setCheques((items) => [...items, { id: crypto.randomUUID(), supplier: supplier.trim(), account: accountId, chequeBook: book, chequeNumber: chequeNumber.trim(), amount: Number(amount), chequeDate, issueDate, purpose, notes: notes.trim(), status: "Pending" }]);
    setSelectedDate(chequeDate); setMonth(new Date(`${chequeDate}T00:00:00`)); setShowForm(false);
  }
  function updateAccount(id: string, field: "bank" | "openingBalance" | "odLimit" | "name" | "chequeBook", value: string) {
    setAccounts((items) => items.map((item) => item.id === id ? { ...item, [field]: field === "openingBalance" || field === "odLimit" ? Number(value) || 0 : value } : item));
  }
  function accountMetrics(account: Account) {
    const reserved = cheques.filter((item) => item.account === account.id && item.status === "Pending").reduce((sum, item) => sum + item.amount, 0);
    const balance = account.openingBalance;
    return { reserved, balance, available: balance + account.odLimit - reserved, odRemaining: Math.max(0, account.odLimit - Math.max(0, reserved - balance)) };
  }

  if (mode === "accounts") return <div className="cheque-module">
    <div className="cheque-page-heading"><div><div className="cheque-eyebrow">FINANCIAL MANAGEMENT</div><h1>Bank Accounts &amp; OD</h1><p>Manage both bank accounts, cheque books and overdraft facilities in one place.</p></div></div>
    <div className="bank-account-grid">{accounts.map((account, index) => {
      const metrics = accountMetrics(account);
      return <section className="bank-account-card" key={account.id}>
        <div className="bank-card-top"><div className="bank-icon"><Building2 size={20}/></div><span className="bank-card-label">ACCOUNT {index + 1}</span><button className="quiet-button" onClick={() => setEditingAccount(editingAccount === account.id ? null : account.id)}>{editingAccount === account.id ? "Close" : "Edit details"}</button></div>
        {editingAccount === account.id ? <div className="account-edit-grid"><label>Account name<input value={account.name} onChange={(e) => updateAccount(account.id, "name", e.target.value)}/></label><label>Bank name<input value={account.bank} onChange={(e) => updateAccount(account.id, "bank", e.target.value)}/></label><label>Opening / current balance (LKR)<input type="number" value={account.openingBalance} onChange={(e) => updateAccount(account.id, "openingBalance", e.target.value)}/></label><label>OD limit (LKR)<input type="number" value={account.odLimit} onChange={(e) => updateAccount(account.id, "odLimit", e.target.value)}/></label><label>Linked cheque book<input value={account.chequeBook} onChange={(e) => updateAccount(account.id, "chequeBook", e.target.value)}/></label></div> : <><h2>{account.name}</h2><p className="bank-name">{account.bank}</p><div className="account-balance-row"><span>Available funds incl. OD</span><strong>{money(metrics.available)}</strong></div><div className="account-metrics"><div><span>Bank balance</span><strong>{money(metrics.balance)}</strong></div><div><span>OD limit</span><strong>{money(account.odLimit)}</strong></div><div><span>Cheque reservations</span><strong>{money(metrics.reserved)}</strong></div><div><span>Remaining OD*</span><strong>{money(metrics.odRemaining)}</strong></div></div><div className="cheque-book-strip"><BookOpen size={17}/><div><strong>{account.chequeBook}</strong><span>Linked to this account</span></div></div></>}
      </section>;
    })}</div>
    <div className="module-note"><AlertCircle size={17}/><p>These account values are currently a local interface preview. Bank reconciliation and live balance calculations will be connected after the database migration is configured. *OD figures shown here are indicative.</p></div>
  </div>;

  return <div className="cheque-module">
    <div className="cheque-page-heading"><div><div className="cheque-eyebrow">FINANCIAL MANAGEMENT</div><h1>Cheque Calendar</h1><p>Plan supplier payments and keep track of upcoming cheque commitments.</p></div><button className="cheque-primary-button" onClick={() => openAdd()}><Plus size={17}/> Add Cheque</button></div>
    <section className="calendar-panel">
      <div className="calendar-toolbar"><div><h2><CalendarDays size={19}/>{monthLabel}</h2><p>Select a date to view or add issued cheques.</p></div><div className="calendar-controls"><button aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={19}/></button><button onClick={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(isoDate(today)); }}>Today</button><button aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={19}/></button></div></div>
      <div className="calendar-weekdays">{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">{calendarCells.map((day, index) => {
        if (!day) return <div className="calendar-empty" key={`empty-${index}`}/>;
        const date = isoDate(new Date(month.getFullYear(), month.getMonth(), day));
        const dayCheques = cheques.filter((item) => item.chequeDate === date && (filterAccount === "all" || item.account === filterAccount));
        const total = dayCheques.filter((item) => item.status === "Pending").reduce((sum, item) => sum + item.amount, 0);
        return <button key={date} className={`calendar-day ${selectedDate === date ? "selected" : ""} ${date === isoDate(today) ? "today" : ""}`} onClick={() => openAdd(date)}><span className="calendar-day-number">{day}</span>{dayCheques.length > 0 && <><span className="calendar-day-count">{dayCheques.length} cheque{dayCheques.length > 1 ? "s" : ""}</span><span className="calendar-day-total">{money(total)}</span><span className="calendar-dot-row"><i/></span></>}</button>;
      })}</div>
      <div className="calendar-legend"><span><i className="legend-dot pending"/> Pending</span><span><i className="legend-dot cleared"/> Cleared</span><span><i className="legend-dot cancelled"/> Cancelled</span></div>
    </section>
    <section className="selected-date-panel">
      <div className="selected-date-heading"><div><span className="cheque-eyebrow">SELECTED DATE</span><h2>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2><p>{selectedCheques.length} cheque{selectedCheques.length === 1 ? "" : "s"} scheduled · Pending total {money(selectedTotal)}</p></div><button className="cheque-primary-button" onClick={() => openAdd(selectedDate)}><Plus size={17}/> Add Cheque</button></div>
      <div className="cheque-filter"><SlidersHorizontal size={16}/><label htmlFor="cheque-account-filter">Bank account</label><select id="cheque-account-filter" value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)}><option value="all">All accounts</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></div>
      {selectedCheques.length === 0 ? <div className="cheque-empty-state"><div><CalendarDays size={24}/></div><strong>No cheques scheduled for this date</strong><p>Add a cheque and it will appear on this calendar date.</p><button className="cheque-secondary-button" onClick={() => openAdd(selectedDate)}><Plus size={16}/> Add cheque for this day</button></div> : <div className="issued-cheque-list">{selectedCheques.map((item) => <article className="issued-cheque-row" key={item.id}><div className="issued-cheque-icon"><BookOpen size={18}/></div><div className="issued-cheque-main"><strong>{item.supplier}</strong><span>Cheque #{item.chequeNumber} · {item.chequeBook}</span><small>{accounts.find((account) => account.id === item.account)?.name} · {item.purpose}</small></div><div className="issued-cheque-end"><strong>{money(item.amount)}</strong><span className={`cheque-status ${item.status.toLowerCase()}`}>{item.status}</span></div></article>)}</div>}
    </section>
    {showForm && <div className="cheque-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}><section className="cheque-modal" role="dialog" aria-modal="true" aria-labelledby="add-cheque-title"><div className="cheque-modal-header"><div><span className="cheque-eyebrow">ISSUED CHEQUE</span><h2 id="add-cheque-title">Add Cheque</h2><p>Record a supplier payment cheque.</p></div><button className="modal-close" aria-label="Close" onClick={() => setShowForm(false)}><X size={20}/></button></div><form onSubmit={saveCheque} className="cheque-form"><div className="selected-date-callout"><CalendarDays size={18}/><div><span>CHEQUE DATE</span><strong>{new Date(`${chequeDate}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</strong></div><button type="button" onClick={() => setChequeDate(selectedDate)}>Use selected date</button></div><label>Supplier name *<input required value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Enter supplier name" autoFocus/></label><div className="form-two-columns"><label>Bank account *<select value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name} · {account.bank}</option>)}</select></label><label>Cheque book<input readOnly value={accountForForm?.chequeBook ?? ""}/></label></div><label>Cheque number *<input required value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} placeholder="Enter cheque number"/></label><label>Amount (LKR) *<input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"/></label><div className="form-two-columns"><label>Cheque date *<input required type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)}/></label><label>Actual issue date<input required type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}/></label></div><label>Payment purpose<select value={purpose} onChange={(e) => setPurpose(e.target.value)}><option>Supplier payment</option><option>Stock purchase</option><option>Other</option></select></label><label>Notes<textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional details"/></label><div className="reservation-note"><Clock3 size={17}/><p>When database integration is enabled, saving an issued cheque will reserve its amount immediately. The bank balance changes only when the cheque is cleared.</p></div><div className="cheque-form-actions"><button type="button" className="cheque-secondary-button" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="cheque-primary-button"><Plus size={16}/> Save Cheque</button></div></form></section></div>}
    <div className="module-note"><AlertCircle size={17}/><p>Local UI preview: cheque entries currently remain in this browser session only. Supabase persistence, cheque status updates, OD reservation transactions and audit history require the database migration and integration stage.</p></div>
  </div>;
}
