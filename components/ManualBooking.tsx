
import React, { useState, useMemo, useEffect } from 'react';
import { Car, Client, Rental } from '../types';

interface ManualBookingProps {
  cars: Car[];
  clients: Client[];
  onCreate: (rental: Rental, isDebt: boolean) => void;
  onQuickAddClient: (c: Partial<Client>) => Promise<string>;
}

const ManualBooking: React.FC<ManualBookingProps> = ({ cars, clients, onCreate, onQuickAddClient }) => {
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMode, setPaymentMode] = useState<'PAID' | 'DEBT'>('PAID');

  const today = new Date().toISOString().split('T')[0];
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [formData, setFormData] = useState({
    carId: '',
    clientId: '',
    clientName: '',
    startDate: today,
    startTime: nowTime,
    endDate: today,
    endTime: '18:00',
    price: 0
  });

  useEffect(() => {
    if (formData.carId && formData.startDate && formData.startTime && formData.endDate && formData.endTime) {
      const car = cars.find(c => c.id === formData.carId);
      if (!car) return;

      const start = new Date(`${formData.startDate}T${formData.startTime}`);
      const end = new Date(`${formData.endDate}T${formData.endTime}`);

      const diffMs = end.getTime() - start.getTime();
      if (diffMs > 0) {
        const totalHours = diffMs / (1000 * 60 * 60);
        const days = Math.floor(totalHours / 24);
        const remainingHours = Math.ceil(totalHours % 24);

        const hourPrice = car.pricePerHour || Math.round(car.pricePerDay / 24);
        const calculatedPrice = (days * car.pricePerDay) + (remainingHours * hourPrice);

        setFormData(prev => ({ ...prev, price: Math.round(calculatedPrice) }));
      } else {
        setFormData(prev => ({ ...prev, price: 0 }));
      }
    }
  }, [formData.carId, formData.startDate, formData.startTime, formData.endDate, formData.endTime, cars]);

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    return clients.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
    );
  }, [clients, searchQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.carId || !formData.clientId) {
      alert('Пожалуйста, выберите автомобиль и клиента');
      return;
    }
    if (formData.price <= 0) {
      alert('Сумма аренды должна быть больше нуля');
      return;
    }

    const rental: Rental = {
      id: `mrent-${Date.now()}`,
      ownerId: '',
      carId: formData.carId,
      clientId: formData.clientId,
      startDate: formData.startDate,
      startTime: formData.startTime,
      endDate: formData.endDate,
      endTime: formData.endTime,
      totalAmount: formData.price,
      status: 'ACTIVE',
      contractNumber: `дог-${Math.floor(Math.random() * 9000) + 1000}`,
      paymentStatus: paymentMode === 'DEBT' ? 'DEBT' : 'PAID'
    };

    onCreate(rental, paymentMode === 'DEBT');

    setFormData({
      carId: '',
      clientId: '',
      clientName: '',
      startDate: today,
      startTime: nowTime,
      endDate: today,
      endTime: '18:00',
      price: 0
    });
  };

  const handleQuickAddClient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newId = await onQuickAddClient({
      name: fd.get('name') as string,
      phone: fd.get('phone') as string,
      email: fd.get('email') as string,
      passport: fd.get('passport') as string,
      driverLicense: fd.get('license') as string,
    });
    setFormData({ ...formData, clientId: newId, clientName: fd.get('name') as string });
    setShowQuickAdd(false);
  };

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn pb-24 md:pb-0">
      <div className="bg-white p-6 md:p-12 rounded-[2.5rem] shadow-xl border border-slate-100">
        <h2 className="text-3xl font-black text-slate-900 mb-8">Оформление аренды</h2>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Автомобиль</label>
                <select
                  required
                  className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 transition-all appearance-none cursor-pointer"
                  value={formData.carId}
                  onChange={e => setFormData({...formData, carId: e.target.value})}
                >
                  <option value="">-- Выберите машину --</option>
                  {cars.map(c => (
                    <option key={c.id} value={c.id} disabled={c.status !== 'Свободен'}>
                      {c.brand} {c.model} ({c.plate}) — {c.status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Клиент</label>
                <div
                  onClick={() => setShowClientSearch(true)}
                  className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-2 border-transparent cursor-pointer flex justify-between items-center hover:bg-slate-100 transition-all"
                >
                  <span className={formData.clientName ? 'text-slate-900' : 'text-slate-400'}>
                    {formData.clientName || 'Нажмите для выбора'}
                  </span>
                  <i className="fas fa-search text-slate-300"></i>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Способ оплаты</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('PAID')}
                    className={`py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center space-x-2 ${paymentMode === 'PAID' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                  >
                    <i className="fas fa-money-bill-wave"></i>
                    <span>Оплачено</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('DEBT')}
                    className={`py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center space-x-2 ${paymentMode === 'DEBT' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400'}`}
                  >
                    <i className="fas fa-clock"></i>
                    <span>В долг</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 text-xs font-black text-slate-400 uppercase tracking-widest">Начало аренды</div>
                <input
                  type="date" required className="p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500"
                  value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})}
                />
                <input
                  type="time" required className="p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500"
                  value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})}
                />

                <div className="col-span-2 text-xs font-black text-slate-400 uppercase tracking-widest mt-2">Конец аренды</div>
                <input
                  type="date" required className="p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500"
                  value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})}
                />
                <input
                  type="time" required className="p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500"
                  value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Итоговая сумма (₽)</label>
                <div className="relative">
                  <input
                    type="number" required
                    className="w-full p-4 bg-blue-50 rounded-2xl font-black text-2xl text-blue-600 outline-none border-2 border-blue-100"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-300 uppercase">Авторасчет</div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              type="submit"
              className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-xl hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center space-x-3"
            >
              <i className="fas fa-file-contract"></i>
              <span>Подтвердить и выдать авто</span>
            </button>
          </div>
        </form>
      </div>

      {showClientSearch && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6 px-2">
              <h3 className="text-2xl font-black uppercase tracking-tight">Выбор клиента</h3>
              <button onClick={() => setShowClientSearch(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-50 rounded-full transition-all">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <input 
              autoFocus
              placeholder="Поиск по имени или телефону..."
              className="w-full p-4 bg-slate-50 rounded-2xl mb-4 font-bold outline-none border-2 border-transparent focus:border-blue-500"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />

            <div className="flex-1 overflow-y-auto space-y-2 mb-6 pr-2 custom-scrollbar">
              {filteredClients.map(c => (
                <div 
                  key={c.id}
                  onClick={() => {
                    setFormData({...formData, clientId: c.id, clientName: c.name});
                    setShowClientSearch(false);
                  }}
                  className="p-4 rounded-2xl bg-slate-50 hover:bg-blue-600 hover:text-white cursor-pointer border border-transparent transition-all group"
                >
                  <div className="font-bold">{c.name}</div>
                  <div className="text-xs opacity-60 group-hover:opacity-100">{c.phone}</div>
                </div>
              ))}
              {filteredClients.length === 0 && (
                <div className="text-center py-10 text-slate-400 italic">Клиент не найден</div>
              )}
            </div>

            <button 
              onClick={() => { setShowClientSearch(false); setShowQuickAdd(true); }}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              <i className="fas fa-user-plus mr-2"></i> Быстрая регистрация
            </button>
          </div>
        </div>
      )}

      {showQuickAdd && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <form onSubmit={handleQuickAddClient} className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl overflow-y-auto max-h-[90vh] animate-scaleIn">
            <h3 className="text-2xl font-black mb-8">Новый клиент</h3>
            <div className="space-y-4 mb-8">
              <input name="name" placeholder="ФИО" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              <input name="phone" placeholder="Телефон" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              <input name="email" placeholder="Email (необязательно)" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              <input name="passport" placeholder="Паспорт" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              <input name="license" placeholder="Вод. удостоверение" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setShowQuickAdd(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold">Отмена</button>
              <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold">Зарегистрировать</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ManualBooking;
