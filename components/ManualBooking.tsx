
import React, { useState, useMemo, useEffect } from 'react';
import { Car, Client, Rental } from '../types';

interface ManualBookingProps {
  cars: Car[];
  clients: Client[];
  rentals?: Rental[];
  preSelectedCarId?: string;
  preIsReservation?: boolean;
  preSelectedRentalId?: string | null;
  onCreate: (rental: Rental) => void;
  onQuickAddClient: (c: Partial<Client>) => Promise<string>;
}

const ManualBooking: React.FC<ManualBookingProps> = ({
  cars, clients, rentals = [], preSelectedCarId, preIsReservation = false, preSelectedRentalId, onCreate, onQuickAddClient
}) => {
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMode, setPaymentMode] = useState<'PAID' | 'DEBT'>('PAID');
  const [bookingType, setBookingType] = useState<'DAILY' | 'HOURLY'>('DAILY');
  const [isReservation, setIsReservation] = useState(preIsReservation);

  const today = new Date().toISOString().split('T')[0];
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [formData, setFormData] = useState({
    carId: preSelectedCarId || '',
    clientId: '',
    clientName: '',
    startDate: today,
    startTime: nowTime,
    endDate: today,
    endTime: '18:00',
    price: 0
  });

  useEffect(() => {
    if (preSelectedRentalId) {
      const existing = rentals.find(r => r.id === preSelectedRentalId);
      if (existing) {
        const client = clients.find(c => c.id === existing.clientId);
        setFormData({
          carId: existing.carId,
          clientId: existing.clientId,
          clientName: client?.name || '',
          startDate: existing.startDate,
          startTime: existing.startTime,
          endDate: existing.endDate,
          endTime: existing.endTime,
          price: existing.totalAmount
        });
        setBookingType(existing.bookingType || 'DAILY');
        setIsReservation(false);
        setPaymentMode('PAID');
      }
    } else if (preSelectedCarId) {
      setFormData(prev => ({ ...prev, carId: preSelectedCarId }));
      setIsReservation(preIsReservation);
    }
  }, [preSelectedRentalId, preSelectedCarId, preIsReservation, rentals, clients]);

  useEffect(() => {
    if (formData.carId && formData.startDate && formData.startTime && formData.endDate && formData.endTime) {
      const car = cars.find(c => c.id === formData.carId);
      if (!car) return;

      const start = new Date(`${formData.startDate}T${formData.startTime}`);
      const end = new Date(`${formData.endDate}T${formData.endTime}`);
      const diffMs = end.getTime() - start.getTime();

      if (diffMs > 0) {
        const totalHours = diffMs / (1000 * 60 * 60);
        let calculatedPrice = 0;

        if (bookingType === 'DAILY') {
          const days = Math.ceil(totalHours / 24);
          calculatedPrice = days * car.pricePerDay;
        } else {
          calculatedPrice = Math.ceil(totalHours) * (car.pricePerHour || Math.round(car.pricePerDay / 24));
        }
        setFormData(prev => ({ ...prev, price: Math.round(calculatedPrice) }));
      }
    }
  }, [formData.carId, formData.startDate, formData.startTime, formData.endDate, formData.endTime, bookingType, cars]);

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    return clients.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery));
  }, [clients, searchQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.carId || !formData.clientId) { alert('Выберите авто и клиента'); return; }

    const rental: Rental = {
      id: preSelectedRentalId || '',
      ownerId: '',
      carId: formData.carId,
      clientId: formData.clientId,
      startDate: formData.startDate,
      startTime: formData.startTime,
      endDate: formData.endDate,
      endTime: formData.endTime,
      totalAmount: formData.price,
      status: 'ACTIVE',
      contractNumber: `${isReservation ? 'Б' : 'Д'}-${Math.floor(Math.random() * 9000) + 1000}`,
      paymentStatus: isReservation ? 'PAID' : paymentMode,
      isReservation: isReservation,
      bookingType: bookingType,
      extensions: []
    };

    onCreate(rental);
    setFormData({ carId: '', clientId: '', clientName: '', startDate: today, startTime: nowTime, endDate: today, endTime: '18:00', price: 0 });
  };

  const handleQuickAddClient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const newId = await onQuickAddClient({
        name: fd.get('name') as string,
        phone: fd.get('phone') as string,
      });
      setFormData({ ...formData, clientId: newId, clientName: fd.get('name') as string });
      setShowQuickAdd(false);
    } catch (error) { alert('Ошибка'); }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn pb-24 md:pb-0">
      <div className="bg-white p-6 md:p-12 rounded-[2.5rem] shadow-xl border border-slate-100">
        <h2 className="text-3xl font-black text-slate-900 mb-8">{isReservation ? 'Бронирование' : 'Выдача автомобиля'}</h2>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Режим</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                    <button type="button" onClick={() => setIsReservation(false)} className={`py-3 rounded-xl font-black text-[9px] uppercase transition-all ${!isReservation ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Выдача</button>
                    <button type="button" onClick={() => setIsReservation(true)} className={`py-3 rounded-xl font-black text-[9px] uppercase transition-all ${isReservation ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400'}`}>Бронь</button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Тип аренды</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                    <button type="button" onClick={() => setBookingType('DAILY')} className={`py-3 rounded-xl font-black text-[9px] uppercase transition-all ${bookingType === 'DAILY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Сутки</button>
                    <button type="button" onClick={() => setBookingType('HOURLY')} className={`py-3 rounded-xl font-black text-[9px] uppercase transition-all ${bookingType === 'HOURLY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Часы</button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Автомобиль</label>
                <select required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" value={formData.carId} onChange={e => setFormData({...formData, carId: e.target.value})}>
                  <option value="">-- Выберите машину --</option>
                  {cars.map(c => <option key={c.id} value={c.id}>{c.brand} {c.model} — {c.plate}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Клиент</label>
                <div onClick={() => setShowClientSearch(true)} className="w-full p-4 bg-slate-50 rounded-2xl font-bold cursor-pointer flex justify-between items-center hover:bg-slate-100 border-2 border-transparent">
                  <span className={formData.clientName ? 'text-slate-900' : 'text-slate-400'}>{formData.clientName || 'Выбрать клиента'}</span>
                  <i className="fas fa-search text-slate-300"></i>
                </div>
              </div>

              {!isReservation && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Оплата</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                    <button type="button" onClick={() => setPaymentMode('PAID')} className={`py-3 rounded-xl font-black text-[10px] uppercase transition-all ${paymentMode === 'PAID' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Оплачено</button>
                    <button type="button" onClick={() => setPaymentMode('DEBT')} className={`py-3 rounded-xl font-black text-[10px] uppercase transition-all ${paymentMode === 'DEBT' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>Не оплачено</button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Начало</div>
                <input type="date" required className="p-4 bg-slate-50 rounded-2xl font-bold" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                <input type="time" required className="p-4 bg-slate-50 rounded-2xl font-bold" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
                <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Конец</div>
                <input type="date" required className="p-4 bg-slate-50 rounded-2xl font-bold" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                <input type="time" required className="p-4 bg-slate-50 rounded-2xl font-bold" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Итоговая сумма (₽)</label>
                <div className="relative">
                  <input type="number" required className="w-full p-5 bg-blue-50 rounded-2xl font-black text-2xl text-blue-700 outline-none border-2 border-blue-100" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[8px] font-black text-blue-400 uppercase">Авторасчет</div>
                </div>
              </div>
            </div>
          </div>
          <button type="submit" className={`w-full py-5 rounded-3xl font-black text-lg transition-all active:scale-95 shadow-xl ${isReservation ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'}`}>
            {isReservation ? 'Забронировать' : 'Оформить выдачу'}
          </button>
        </form>
      </div>

      {showClientSearch && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black uppercase">Выбор клиента</h3>
              <button onClick={() => setShowClientSearch(false)} className="text-slate-400"><i className="fas fa-times"></i></button>
            </div>
            <input autoFocus placeholder="Поиск..." className="w-full p-4 bg-slate-50 rounded-2xl mb-4 font-bold outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <div className="flex-1 overflow-y-auto space-y-2 mb-6 pr-2 custom-scrollbar">
              {filteredClients.map(c => (
                <div key={c.id} onClick={() => { setFormData({...formData, clientId: c.id, clientName: c.name}); setShowClientSearch(false); }} className="p-4 rounded-2xl bg-slate-50 hover:bg-blue-600 hover:text-white cursor-pointer transition-all">
                  <div className="font-bold">{c.name}</div>
                  <div className="text-[10px] opacity-60 uppercase">{c.phone}</div>
                </div>
              ))}
            </div>
            <button onClick={() => { setShowClientSearch(false); setShowQuickAdd(true); }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold">Новый клиент</button>
          </div>
        </div>
      )}

      {showQuickAdd && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <form onSubmit={handleQuickAddClient} className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl animate-scaleIn">
            <h3 className="text-2xl font-black mb-8">Быстрое добавление</h3>
            <div className="space-y-4 mb-8">
              <input name="name" placeholder="ФИО" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none" />
              <input name="phone" placeholder="Телефон" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none" />
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setShowQuickAdd(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold">Отмена</button>
              <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold">Добавить</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ManualBooking;
