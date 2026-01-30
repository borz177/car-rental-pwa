
import React, { useState } from 'react';
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
    <div className="space-y-6 pb-24 md:pb-0 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-3xl font-black text-slate-900">Клиенты</h2>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Управление базой арендаторов</p>
        </div>
        <button
          onClick={() => { setEditingClient(null); setIsModalOpen(true); }}
          className="w-full md:w-auto bg-blue-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center space-x-2 active:scale-95"
        >
          <i className="fas fa-plus"></i>
          <span>Новый клиент</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map(client => (
          <div key={client.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative group">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-blue-600 text-lg font-black uppercase">
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
                      <button onClick={() => { onSelectClient(client.id); setShowActions(null); }} className="w-full px-5 py-3 text-left text-sm font-bold hover:bg-slate-50 flex items-center space-x-3 text-slate-600 border-b border-slate-50">
                        <i className="fas fa-info-circle w-4 text-blue-500"></i> <span>Информация</span>
                      </button>
                      <button onClick={() => { setEditingClient(client); setIsModalOpen(true); setShowActions(null); }} className="w-full px-5 py-3 text-left text-sm font-bold hover:bg-slate-50 flex items-center space-x-3 text-slate-600 border-b border-slate-50">
                        <i className="fas fa-edit w-4 text-amber-500"></i> <span>Изменить</span>
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
        {clients.length === 0 && (
          <div className="col-span-full py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300">
            <i className="fas fa-users text-4xl mb-4 opacity-20"></i>
            <p className="font-bold uppercase tracking-widest text-sm">Список клиентов пуст</p>
          </div>
        )}
      </div>

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

export default ClientList;
