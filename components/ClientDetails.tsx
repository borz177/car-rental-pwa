
import React, { useState, useMemo } from 'react';
import { Client, Rental, Transaction, TransactionType, Car, Fine, FineStatus } from '../types';
import OperationModal from './OperationModal';

interface ClientDetailsProps {
  client: Client;
  rentals: Rental[];
  transactions: Transaction[];
  cars: Car[];
  fines: Fine[];
  onBack: () => void;
  onAddFine: (f: Partial<Fine>) => void;
  onPayFine: (id: string) => void;
}

const ClientDetails: React.FC<ClientDetailsProps> = ({ client, rentals, transactions, cars, fines, onBack, onAddFine, onPayFine }) => {
  const [activeTab, setActiveTab] = useState<'INFO' | 'HISTORY' | 'FINES'>('INFO');
  const [selectedOperation, setSelectedOperation] = useState<any | null>(null);
  const [showFineModal, setShowFineModal] = useState(false);
  const [fineToPay, setFineToPay] = useState<Fine | null>(null);

  // Advanced history calculation including rental extensions
  const history = useMemo(() => {
    const clientRentals = rentals.filter(r => r.clientId === client.id);
    const clientTransactions = transactions.filter(t => t.clientId === client.id && t.type === TransactionType.INCOME);

    const items: any[] = [];

    // Add basic rentals
    clientRentals.forEach(r => {
      // Calculate initial amount (total minus sum of all extensions)
      const extensionTotal = r.extensions?.reduce((s, e) => s + (e.amount || 0), 0) || 0;
      items.push({
        ...r,
        type: 'RENTAL',
        date: r.startDate,
        displayTitle: `Аренда дог. ${r.contractNumber}`,
        displayAmount: r.totalAmount - extensionTotal
      });

      // Add extensions as separate history items
      if (r.extensions && r.extensions.length > 0) {
        r.extensions.forEach((ext, idx) => {
          items.push({
            ...r,
            id: `${r.id}-ext-${idx}`,
            type: 'EXTENSION',
            date: ext.date || r.startDate, // fallback to start date
            displayTitle: `Продление дог. ${r.contractNumber}`,
            displayAmount: ext.amount,
            newEndDate: ext.endDate
          });
        });
      }
    });

    // Add standard payments (manual transactions from cashbox)
    clientTransactions.forEach(t => {
      // Avoid double counting if transaction was created from rental payment logic
      // Usually these have a specific description or category
      items.push({
        ...t,
        type: 'PAYMENT',
        displayTitle: `Платеж: ${t.category}`,
        displayAmount: t.amount
      });
    });

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [client.id, rentals, transactions]);

  const clientFines = fines.filter(f => f.clientId === client.id);

  const clientRentalsForFines = rentals.filter(r => r.clientId === client.id);
  const rentedCarIds = new Set(clientRentalsForFines.map(r => r.carId));
  const relatedCars = cars.filter(c => rentedCarIds.has(c.id));
  const otherCars = cars.filter(c => !rentedCarIds.has(c.id));

  const handleAddFine = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const fineData: Partial<Fine> = {
      clientId: client.id,
      carId: fd.get('carId') as string,
      amount: Number(fd.get('amount')),
      description: fd.get('description') as string,
      source: fd.get('source') as string,
      date: new Date().toISOString(),
      status: FineStatus.UNPAID
    };

    if (!fineData.carId) {
      alert('Пожалуйста, выберите автомобиль');
      return;
    }

    onAddFine(fineData);
    setShowFineModal(false);
  };

  const confirmPayFine = () => {
    if (fineToPay) {
      onPayFine(fineToPay.id);
      setFineToPay(null);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-24 md:pb-0">
      <button onClick={onBack} className="flex items-center space-x-2 text-slate-500 font-bold hover:text-blue-600 transition-all">
        <i className="fas fa-arrow-left"></i> <span>Назад к списку</span>
      </button>

      <div className="bg-white rounded-[3rem] shadow-xl overflow-hidden border border-slate-100">
        <div className="p-8 md:p-12 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center space-x-6">
            <div className="w-20 h-20 rounded-[2rem] bg-blue-600 flex items-center justify-center text-white text-3xl font-black shadow-xl">
              {client.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-900">{client.name}</h2>
              <p className="text-sm font-bold text-slate-400 tracking-widest uppercase mt-1">Детальный профиль клиента</p>
            </div>
          </div>
          <div className={`px-8 py-5 rounded-[2rem] border-2 text-center min-w-[200px] ${client.debt && client.debt > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Баланс долга</div>
            <div className={`text-2xl font-black ${client.debt && client.debt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {client.debt?.toLocaleString() || 0} ₽
            </div>
          </div>
        </div>

        <div className="flex border-b border-slate-100">
          <button onClick={() => setActiveTab('INFO')} className={`flex-1 py-5 font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'INFO' ? 'bg-white text-blue-600 border-b-4 border-blue-600' : 'text-slate-400 hover:text-slate-600 bg-slate-50'}`}>Информация</button>
          <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 py-5 font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'HISTORY' ? 'bg-white text-blue-600 border-b-4 border-blue-600' : 'text-slate-400 hover:text-slate-600 bg-slate-50'}`}>История</button>
          <button onClick={() => setActiveTab('FINES')} className={`flex-1 py-5 font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'FINES' ? 'bg-white text-rose-600 border-b-4 border-rose-600' : 'text-slate-400 hover:text-slate-600 bg-slate-50'}`}>Штрафы</button>
        </div>

        <div className="p-8 md:p-12">
          {activeTab === 'INFO' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
              <DetailBox icon="fa-phone" label="Телефон" value={client.phone} />
              <DetailBox icon="fa-envelope" label="Email" value={client.email || '—'} />
              <DetailBox icon="fa-id-card" label="Паспорт" value={client.passport} />
              <DetailBox icon="fa-id-badge" label="ВУ" value={client.driverLicense} />
              <DetailBox icon="fa-calendar" label="Зарегистрирован" value={new Date(client.createdAt).toLocaleDateString()} />
            </div>
          )}

          {activeTab === 'HISTORY' && (
            <div className="space-y-4 animate-fadeIn">
              {history.map((item, idx) => (
                <div key={idx} onClick={() => setSelectedOperation(item)} className="p-6 rounded-[1.8rem] border border-slate-100 hover:bg-slate-50 cursor-pointer transition-all flex items-center justify-between group">
                  <div className="flex items-center space-x-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.type === 'PAYMENT' ? 'bg-emerald-100 text-emerald-600' : item.type === 'EXTENSION' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                      <i className={`fas ${item.type === 'PAYMENT' ? 'fa-money-bill-wave' : item.type === 'EXTENSION' ? 'fa-calendar-plus' : 'fa-car'}`}></i>
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {item.displayTitle}
                        {item.type === 'EXTENSION' && <span className="ml-2 text-[10px] font-black text-amber-600 uppercase">До {new Date(item.newEndDate).toLocaleDateString()}</span>}
                      </div>
                      <div className="text-xs text-slate-400 font-medium">{new Date(item.date).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-slate-900">
                      {item.displayAmount.toLocaleString()} ₽
                    </div>
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <div className="p-20 text-center text-slate-300 italic font-medium">История операций пуста</div>
              )}
            </div>
          )}

          {activeTab === 'FINES' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900 uppercase">Штрафы клиента</h3>
                <button
                  onClick={() => setShowFineModal(true)}
                  className="bg-rose-600 text-white px-6 py-2 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-rose-700 shadow-lg shadow-rose-200"
                >
                  Выставить штраф
                </button>
              </div>

              <div className="grid gap-4">
                {clientFines.map(fine => (
                  <div key={fine.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center space-x-5">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${fine.status === FineStatus.PAID ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                        <i className={`fas ${fine.status === FineStatus.PAID ? 'fa-check' : 'fa-gavel'}`}></i>
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{fine.description}</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {fine.source} • {new Date(fine.date).toLocaleDateString()} • {cars.find(c => c.id === fine.carId)?.plate}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <div className="font-black text-xl text-slate-900">{fine.amount.toLocaleString()} ₽</div>
                        <div className={`text-[8px] font-black uppercase ${fine.status === FineStatus.PAID ? 'text-emerald-500' : 'text-rose-500'}`}>{fine.status}</div>
                      </div>
                      {fine.status === FineStatus.UNPAID && (
                        <button
                          onClick={() => setFineToPay(fine)}
                          className="w-10 h-10 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-200 flex items-center justify-center active:scale-90 transition-all hover:bg-emerald-600"
                          title="Оплатить штраф"
                        >
                          <i className="fas fa-check"></i>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {clientFines.length === 0 && (
                  <div className="p-20 text-center text-slate-300 italic font-medium">Штрафов не найдено</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Paying Fine */}
      {fineToPay && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl animate-scaleIn text-center">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
              <i className="fas fa-hand-holding-usd"></i>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Оплата штрафа</h2>
            <p className="text-slate-500 font-medium mb-8">
              Вы подтверждаете получение <span className="text-slate-900 font-black">{fineToPay.amount.toLocaleString()} ₽</span> за "{fineToPay.description}"?
              <br/><span className="text-[10px] text-slate-400 mt-2 block">Сумма будет автоматически зачислена в кассу как доход.</span>
            </p>
            <div className="flex gap-4">
              <button type="button" onClick={() => setFineToPay(null)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold text-slate-500 hover:bg-slate-200 transition-all">Отмена</button>
              <button onClick={confirmPayFine} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all">Подтвердить</button>
            </div>
          </div>
        </div>
      )}

      {showFineModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <form onSubmit={handleAddFine} className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl animate-scaleIn">
            <h2 className="text-2xl font-black text-slate-900 mb-8 uppercase tracking-tight">Новый штраф</h2>
            <div className="space-y-4 mb-10">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Автомобиль</label>
                <select name="carId" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-rose-500 appearance-none text-slate-900">
                  <option value="">-- Выберите авто --</option>
                  {relatedCars.length > 0 && <optgroup label="Из истории аренды">
                    {relatedCars.map(c => <option key={c.id} value={c.id}>{c.brand} {c.model} ({c.plate})</option>)}
                  </optgroup>}
                  <optgroup label="Весь автопарк">
                    {otherCars.map(c => <option key={c.id} value={c.id}>{c.brand} {c.model} ({c.plate})</option>)}
                  </optgroup>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Сумма (₽)</label>
                  <input name="amount" type="number" required placeholder="0" className="w-full p-4 bg-slate-50 rounded-2xl font-black text-xl outline-none border-none focus:ring-2 focus:ring-rose-500" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Источник</label>
                  <select name="source" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-rose-500 appearance-none">
                    <option value="ГИБДД">ГИБДД</option>
                    <option value="Парковка">Парковка</option>
                    <option value="ЦОДД">ЦОДД</option>
                    <option value="Ущерб">Ущерб</option>
                    <option value="Прочее">Прочее</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Описание нарушения</label>
                <input name="description" required placeholder="Напр. Превышение скорости 20-40 км/ч" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-none focus:ring-2 focus:ring-rose-500" />
              </div>
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setShowFineModal(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold text-slate-500">Отмена</button>
              <button type="submit" className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-bold shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all">Выставить</button>
            </div>
          </form>
        </div>
      )}

      {selectedOperation && (
        <OperationModal item={selectedOperation} cars={cars} onClose={() => setSelectedOperation(null)} />
      )}
    </div>
  );
};

const DetailBox = ({ icon, label, value }: { icon: string, label: string, value: string }) => (
  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-start space-x-4">
    <div className="text-blue-500 mt-1"><i className={`fas ${icon}`}></i></div>
    <div>
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-sm font-bold text-slate-800 break-words">{value}</div>
    </div>
  </div>
);

export default ClientDetails;
