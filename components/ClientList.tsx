
import React, { useState } from 'react';
import { Client, Rental, Transaction, TransactionType } from '../backend/src/types.ts';

interface ClientListProps {
  clients: Client[];
  rentals: Rental[];
  transactions: Transaction[];
  onAdd: (c: Client) => void;
  onUpdate: (c: Client) => void;
  onDelete: (id: string) => void;
  // Fix: Add onSelectClient to interface to resolve TS error in App.tsx
  onSelectClient: (id: string) => void;
}

const ClientList: React.FC<ClientListProps> = ({ clients, rentals, transactions, onAdd, onUpdate, onDelete, onSelectClient }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<'INFO' | 'HISTORY'>('INFO');
  const [showActions, setShowActions] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const clientData: Client = {
      id: editingClient?.id || Date.now().toString(),
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

  // Fix: Property 'date' does not exist on type 'Rental'. Refactor sort logic to use type-specific date fields.
  const clientHistory = viewingClient 
    ? [
        ...rentals.filter(r => r.clientId === viewingClient.id).map(r => ({ ...r, type: 'RENTAL' as const })),
        ...transactions.filter(t => t.clientId === viewingClient.id && t.type === TransactionType.INCOME).map(t => ({ ...t, type: 'PAYMENT' as const }))
      ].sort((a, b) => {
        const dateA = a.type === 'RENTAL' ? a.startDate : a.date;
        const dateB = b.type === 'RENTAL' ? b.startDate : b.date;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      })
    : [];

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-3xl font-black text-slate-900">Клиенты</h2>
        <button 
          onClick={() => { setEditingClient(null); setIsModalOpen(true); }} 
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all text-sm"
        >
          <i className="fas fa-plus mr-2"></i> Новый
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-2">
        {clients.map(client => (
          <div key={client.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative group">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-blue-600 text-lg font-black">
                  {client.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 tracking-tight">{client.name}</h3>
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
                    <div className="absolute right-0 top-12 w-48 bg-white rounded-2xl shadow-2xl border border-slate-50 z-50 overflow-hidden animate-scaleIn">
                      {/* Fix: Call onSelectClient for global navigation to detailed view instead of local modal */}
                      <button onClick={() => { onSelectClient(client.id); setShowActions(null); }} className="w-full px-5 py-3 text-left text-sm font-bold hover:bg-slate-50 flex items-center space-x-3 text-slate-600 border-b border-slate-50">
                        <i className="fas fa-info-circle w-4 text-blue-500"></i> <span>Информация</span>
                      </button>
                      <button onClick={() => { setEditingClient(client); setIsModalOpen(true); setShowActions(null); }} className="w-full px-5 py-3 text-left text-sm font-bold hover:bg-slate-50 flex items-center space-x-3 text-slate-600 border-b border-slate-50">
                        <i className="fas fa-edit w-4 text-amber-500"></i> <span>Редактировать</span>
                      </button>
                      <button onClick={() => { if(confirm('Удалить клиента?')) onDelete(client.id); setShowActions(null); }} className="w-full px-5 py-3 text-left text-sm font-bold hover:bg-rose-50 text-rose-500 flex items-center space-x-3">
                        <i className="fas fa-trash-alt w-4"></i> <span>Удалить</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400 pt-4 border-t border-slate-50">
              <span>Долг: <span className={client.debt && client.debt > 0 ? 'text-rose-500' : 'text-emerald-500'}>{client.debt?.toLocaleString() || 0} ₽</span></span>
              <span>{new Date(client.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Модалка информации (Детали) */}
      {viewingClient && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleIn">
            <div className="p-8 bg-slate-50 border-b border-slate-100">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-5">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-blue-600 flex items-center justify-center text-white text-2xl font-black">
                    {viewingClient.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">{viewingClient.name}</h3>
                    <p className="text-sm font-bold text-slate-400 italic">ID: {viewingClient.id.slice(-6)}</p>
                  </div>
                </div>
                <button onClick={() => setViewingClient(null)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-white rounded-full transition-all">
                  <i className="fas fa-times"></i>
                </button>
              </div>

              {/* Вкладки */}
              <div className="flex space-x-6 mt-8">
                <button 
                  onClick={() => setActiveTab('INFO')}
                  className={`text-sm font-black uppercase tracking-widest pb-2 transition-all border-b-2 ${activeTab === 'INFO' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}
                >
                  Инфо и долг
                </button>
                <button 
                  onClick={() => setActiveTab('HISTORY')}
                  className={`text-sm font-black uppercase tracking-widest pb-2 transition-all border-b-2 ${activeTab === 'HISTORY' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}
                >
                  История (Договоры и Платежи)
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
              {activeTab === 'INFO' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <InfoBox label="Телефон" value={viewingClient.phone} />
                    <InfoBox label="Email" value={viewingClient.email || '—'} />
                    <InfoBox label="Паспорт" value={viewingClient.passport} />
                    <InfoBox label="ВУ" value={viewingClient.driverLicense} />
                  </div>
                  <div className={`p-6 rounded-[2rem] border-2 flex items-center justify-between ${viewingClient.debt && viewingClient.debt > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Задолженность</div>
                      <div className={`text-3xl font-black ${viewingClient.debt && viewingClient.debt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {viewingClient.debt?.toLocaleString() || 0} ₽
                      </div>
                    </div>
                    <i className={`fas ${viewingClient.debt && viewingClient.debt > 0 ? 'fa-exclamation-triangle text-rose-300' : 'fa-check-circle text-emerald-300'} text-4xl`}></i>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {clientHistory.map((item: any, idx) => (
                    <div key={idx} className={`p-4 rounded-2xl border flex justify-between items-center ${item.type === 'RENTAL' ? 'bg-slate-50 border-slate-100' : 'bg-emerald-50 border-emerald-100'}`}>
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.type === 'RENTAL' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                          <i className={`fas ${item.type === 'RENTAL' ? 'fa-file-contract' : 'fa-money-bill-wave'}`}></i>
                        </div>
                        <div>
                          <div className="text-[10px] font-black text-slate-400 uppercase">
                            {item.type === 'RENTAL' ? 'Договор ' + item.contractNumber : 'Платеж (' + item.category + ')'}
                          </div>
                          <div className="font-bold text-slate-900">{item.description || 'Аренда авто'}</div>
                          <div className="text-xs text-slate-400">
                            {item.type === 'RENTAL' ? `${item.startDate} — ${item.endDate}` : new Date(item.date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-black ${item.type === 'RENTAL' ? 'text-slate-900' : 'text-emerald-600'}`}>
                          {item.type === 'RENTAL' ? '' : '+'}{item.totalAmount?.toLocaleString() || item.amount?.toLocaleString()} ₽
                        </div>
                        <div className={`text-[10px] font-black uppercase ${item.type === 'RENTAL' ? (item.paymentStatus === 'PAID' ? 'text-emerald-500' : 'text-amber-500') : 'text-emerald-500'}`}>
                          {item.type === 'RENTAL' ? (item.paymentStatus === 'PAID' ? 'Оплачено' : 'В долг') : 'Получено'}
                        </div>
                      </div>
                    </div>
                  ))}
                  {clientHistory.length === 0 && (
                    <div className="text-center py-10 text-slate-400 italic font-medium">История операций пуста</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модалка создания/редактирования */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl animate-scaleIn">
            <h2 className="text-2xl font-black mb-8">{editingClient ? 'Редактировать' : 'Новый'} клиент</h2>
            <div className="space-y-4 mb-8">
              <input name="name" defaultValue={editingClient?.name} placeholder="ФИО" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              <div className="grid grid-cols-2 gap-4">
                <input name="phone" defaultValue={editingClient?.phone} placeholder="Телефон" required className="p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
                <input name="email" defaultValue={editingClient?.email} placeholder="Email" className="p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              </div>
              <input name="passport" defaultValue={editingClient?.passport} placeholder="Паспортные данные" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              <input name="license" defaultValue={editingClient?.driverLicense} placeholder="Водительское удостоверение" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Долг (₽)</label>
                <input name="debt" type="number" defaultValue={editingClient?.debt || 0} className="w-full p-4 bg-rose-50 rounded-2xl font-black text-rose-600 outline-none border-2 border-transparent focus:border-rose-500" />
              </div>
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold">Отмена</button>
              <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20">Сохранить</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const InfoBox = ({ label, value }: { label: string, value: string }) => (
  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
    <div className="text-sm font-bold text-slate-800 break-words">{value}</div>
  </div>
);

export default ClientList;
