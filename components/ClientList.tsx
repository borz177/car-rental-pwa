
import React, { useState, useMemo } from 'react';
import { Client, Rental, Transaction, TransactionType } from '../types';

interface ClientListProps {
  clients: Client[];
  rentals: Rental[];
  transactions: Transaction[];
  onAdd: (c: Client) => void;
  onUpdate: (c: Client) => void;
  onDelete: (id: string) => void;
  onSelectClient: (id: string) => void;
}

const ClientList: React.FC<ClientListProps> = ({ clients, rentals, transactions, onAdd, onUpdate, onDelete, onSelectClient }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showActions, setShowActions] = useState<string | null>(null);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [showDebtorsOnly, setShowDebtorsOnly] = useState(false);

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchDebt = showDebtorsOnly ? (c.debt && c.debt > 0) : true;

      return matchSearch && matchDebt;
    });
  }, [clients, searchQuery, showDebtorsOnly]);

  // rentals и transactions передавались в компонент, но нигде не использовались —
  // карточка показывала только долг и дату регистрации.
  const statsByClient = useMemo(() => {
    const map: Record<string, { total: number; active: boolean; spent: number }> = {};
    clients.forEach(c => { map[c.id] = { total: 0, active: false, spent: 0 }; });
    rentals.forEach(r => {
      const s = map[r.clientId];
      if (!s) return;
      s.total++;
      if (r.status === 'ACTIVE' && !r.isReservation) s.active = true;
    });
    transactions.forEach(t => {
      if (t.type !== TransactionType.INCOME || !t.clientId) return;
      const s = map[t.clientId];
      if (s) s.spent += t.amount;
    });
    return map;
  }, [clients, rentals, transactions]);

  const summary = useMemo(() => ({
    total: clients.length,
    debtors: clients.filter(c => (c.debt || 0) > 0).length,
    debtSum: clients.reduce((s, c) => s + (c.debt || 0), 0),
    renting: Object.values(statsByClient).filter((s: { active: boolean }) => s.active).length
  }), [clients, statsByClient]);

  const handleDelete = (client: Client) => {
    const stats = statsByClient[client.id];
    if (stats?.total > 0) {
      alert(
        `Нельзя удалить клиента «${client.name}».\n\n`
        + `За ним числится договоров: ${stats.total}. Они содержат финансовую историю.\n`
        + `Сначала удалите или завершите эти договоры.`
      );
      return;
    }
    if (confirm(`Удалить клиента «${client.name}» (${client.phone})?\n\nДействие необратимо.`)) {
      onDelete(client.id);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const clientData: Client = {
      id: editingClient?.id || '', // Explicitly empty for new clients
      ownerId: editingClient?.ownerId || '',
      name: fd.get('name') as string,
      phone: fd.get('phone') as string,
      email: fd.get('email') as string,
      passport: fd.get('passport') as string,
      driverLicense: fd.get('license') as string,
      debt: Number(fd.get('debt')) || 0,
      createdAt: editingClient?.createdAt || new Date().toISOString()
    };

    if (editingClient) onUpdate(clientData);
    else onAdd(clientData);

    setIsModalOpen(false);
    setEditingClient(null);
  };

  return (
    <div className="space-y-4 pb-24 md:pb-0 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900">Клиенты</h2>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wide mt-1">Управление базой арендаторов</p>
        </div>
        <button
          onClick={() => { setEditingClient(null); setIsModalOpen(true); }}
          className="w-full md:w-auto bg-blue-600 text-white px-8 py-4 rounded-2xl font-semibold hover:bg-blue-700 shadow-md transition-all flex items-center justify-center space-x-2 active:scale-95"
        >
          <i className="fas fa-plus"></i>
          <span>Новый клиент</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Всего клиентов', value: String(summary.total), tone: 'text-slate-900' },
          { label: 'Сейчас в аренде', value: String(summary.renting), tone: 'text-blue-600' },
          { label: 'Должников', value: String(summary.debtors), tone: summary.debtors ? 'text-rose-600' : 'text-slate-900' },
          { label: 'Сумма долга', value: `${summary.debtSum.toLocaleString()} ₽`, tone: summary.debtSum ? 'text-rose-600' : 'text-slate-900' }
        ].map(s => (
          <div key={s.label} className="bg-white p-4 rounded-2xl border border-slate-100">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{s.label}</div>
            <div className={`text-2xl font-bold mt-1 ${s.tone}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по имени, телефону или email..."
            className="w-full pl-12 pr-4 py-4 bg-white rounded-xl font-bold text-slate-700 outline-none border border-slate-100 shadow-sm focus:border-blue-500 transition-all"
          />
        </div>
        <button
          onClick={() => setShowDebtorsOnly(!showDebtorsOnly)}
          className={`px-6 py-4 rounded-xl font-semibold uppercase text-[10px] tracking-wide transition-all shadow-sm flex items-center gap-2 ${showDebtorsOnly ? 'bg-rose-500 text-white' : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}`}
        >
          <i className={`fas ${showDebtorsOnly ? 'fa-check-square' : 'fa-square'}`}></i>
          <span>Только должники</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map(client => (
          <div key={client.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative group">
            <div className="flex items-start justify-between mb-4">
              <div
                onClick={() => onSelectClient(client.id)}
                className="flex items-center space-x-4 cursor-pointer min-w-0 group/name"
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-blue-600 text-lg font-semibold uppercase flex-shrink-0 relative">
                  {client.name.charAt(0)}
                  {statsByClient[client.id]?.active && (
                    <span
                      title="Сейчас в аренде"
                      className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-white"
                    ></span>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 tracking-tight truncate group-hover/name:text-blue-600 transition-colors">{client.name}</h3>
                  <p className="text-xs text-slate-400 font-bold">{client.phone}</p>
                </div>
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowActions(showActions === client.id ? null : client.id)}
                  className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-slate-900 transition-colors bg-slate-50 rounded-xl"
                >
                  <i className="fas fa-ellipsis-h"></i>
                </button>

                {showActions === client.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowActions(null)}></div>
                    <div className="absolute right-0 top-12 w-48 bg-white rounded-2xl shadow-md border border-slate-50 z-50 overflow-hidden animate-scaleIn">
                      <button onClick={() => { onSelectClient(client.id); setShowActions(null); }} className="w-full px-5 py-3 text-left text-sm font-bold hover:bg-slate-50 flex items-center space-x-3 text-slate-600 border-b border-slate-50">
                        <i className="fas fa-info-circle w-4 text-blue-500"></i> <span>Информация</span>
                      </button>
                      <button onClick={() => { setEditingClient(client); setIsModalOpen(true); setShowActions(null); }} className="w-full px-5 py-3 text-left text-sm font-bold hover:bg-slate-50 flex items-center space-x-3 text-slate-600 border-b border-slate-50">
                        <i className="fas fa-edit w-4 text-amber-500"></i> <span>Изменить</span>
                      </button>
                      <button onClick={() => { handleDelete(client); setShowActions(null); }} className="w-full px-5 py-3 text-left text-sm font-bold hover:bg-rose-50 text-rose-500 flex items-center space-x-3">
                        <i className="fas fa-trash-alt w-4"></i> <span>Удалить</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-50">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Аренд</div>
                <div className="font-bold text-slate-800 text-sm">{statsByClient[client.id]?.total || 0}</div>
              </div>
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Оплатил</div>
                <div className="font-bold text-slate-800 text-sm">{(statsByClient[client.id]?.spent || 0).toLocaleString()} ₽</div>
              </div>
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Долг</div>
                <div className={`font-bold text-sm ${client.debt && client.debt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {client.debt?.toLocaleString() || 0} ₽
                </div>
              </div>
            </div>
          </div>
        ))}
        {filteredClients.length === 0 && (
          <div className="col-span-full py-20 bg-white rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300">
            <i className="fas fa-users text-4xl mb-4 opacity-20"></i>
            <p className="font-bold uppercase tracking-wide text-sm">Клиенты не найдены</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-md animate-scaleIn">
            <h2 className="text-2xl font-semibold mb-8">{editingClient ? 'Редактировать' : 'Новый'} клиент</h2>
            <div className="space-y-4 mb-8">
              <input name="name" defaultValue={editingClient?.name} placeholder="ФИО" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              <div className="grid grid-cols-2 gap-4">
                <input name="phone" defaultValue={editingClient?.phone} placeholder="Телефон" required className="p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
                <input name="email" defaultValue={editingClient?.email} placeholder="Email" className="p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              </div>
              <input name="passport" defaultValue={editingClient?.passport} placeholder="Паспортные данные" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              <input name="license" defaultValue={editingClient?.driverLicense} placeholder="Водительское удостоверение" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-2">Долг (₽)</label>
                <input name="debt" type="number" defaultValue={editingClient?.debt || 0} className="w-full p-4 bg-rose-50 rounded-2xl font-bold text-rose-600 outline-none border-2 border-transparent focus:border-rose-500" />
              </div>
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold">Отмена</button>
              <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg">Сохранить</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ClientList;
