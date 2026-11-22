import { ArrowLeftRight, Banknote, Building2, CalendarDays, ChevronRight, FileText, Wallet } from "lucide-react";
import "./FinancialManagement.css";

type Props = { onNavigate: (page: string) => void };
const money = (value: number) => `LKR ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function FinancialManagement({ onNavigate }: Props) {
  return <div className="financial-dashboard">
    <div className="financial-heading"><div><span>WORKSPACE / FINANCIAL MANAGEMENT</span><h1>Financial Management</h1><p>Manage cash flow, bank accounts, overdraft facilities and supplier cheque commitments.</p></div><button onClick={() => onNavigate("Transactions")}><ArrowLeftRight size={16}/> View Transactions</button></div>
    <div className="financial-stat-grid">
      <article><div className="financial-stat-icon"><Wallet size={19}/></div><span>Combined bank balance</span><strong>{money(0)}</strong><small>Connect account balances in the database stage</small></article>
      <article><div className="financial-stat-icon"><Building2 size={19}/></div><span>Total OD facilities</span><strong>{money(0)}</strong><small>Two account facilities</small></article>
      <article><div className="financial-stat-icon"><FileText size={19}/></div><span>Outstanding cheques</span><strong>{money(0)}</strong><small>Pending issued cheques</small></article>
      <article><div className="financial-stat-icon"><CalendarDays size={19}/></div><span>Upcoming cheque payments</span><strong>0</strong><small>Scheduled commitments</small></article>
    </div>
    <section className="financial-section"><div className="financial-section-title"><div><h2>Financial workspace</h2><p>Choose an area to manage.</p></div></div><div className="financial-shortcuts">
      <button onClick={() => onNavigate("Cheque Management")}><span className="shortcut-icon"><CalendarDays size={20}/></span><span><strong>Cheque Management</strong><small>Calendar, issued cheque register and payment dates</small></span><ChevronRight size={18}/></button>
      <button onClick={() => onNavigate("Bank Accounts & OD")}><span className="shortcut-icon"><Building2 size={20}/></span><span><strong>Bank Accounts &amp; OD</strong><small>Two bank accounts, cheque books and OD limits</small></span><ChevronRight size={18}/></button>
      <button onClick={() => onNavigate("Transactions")}><span className="shortcut-icon"><ArrowLeftRight size={20}/></span><span><strong>Transactions</strong><small>Review financial movements and adjustments</small></span><ChevronRight size={18}/></button>
    </div></section>
    <div className="financial-preview-note"><Banknote size={17}/><p>This is the UI-first dashboard preview. Figures are placeholders until the Supabase database integration is completed. No financial balances or cheque records are being changed.</p></div>
  </div>;
}
