
import React, { useState, useMemo, useEffect } from 'react';
import { Car, Client, Rental, AppView, User, UserRole } from '../types';
import { getPlanFeatures, getBlockedCarIds } from '../services/planFeatures';

interface ManualBookingProps {
  cars: Car[];
  clients: Client[];
  rentals?: Rental[];
  preSelectedCarId?: string;
  preIsReservation?: boolean;
  preSelectedRentalId?: string | null;
  onCreate: (rental: Rental) => Promise<Rental | undefined>;
  onNavigate?: (view: AppView) => void;
  onQuickAddClient: (c: Partial<Client>) => Promise<string>;
  currentUser: User;
}

const ManualBooking: React.FC<ManualBookingProps> = ({
  cars, clients, rentals = [], preSelectedCarId, preIsReservation = false, preSelectedRentalId, onCreate, onNavigate, onQuickAddClient, currentUser
}) => {
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMode, setPaymentMode] = useState<'PAID' | 'DEBT'>('PAID');
  const [bookingType, setBookingType] = useState<'DAILY' | 'HOURLY'>('DAILY');
  const [isReservation, setIsReservation] = useState(preIsReservation);

  // State for success modal
  const [successData, setSuccessData] = useState<{rental: Rental, car: Car, client: Client} | null>(null);

  const isStaff = currentUser.role === UserRole.STAFF;
  const canCreateBooking = !isStaff || currentUser.permissions?.canCreateBooking;

  if (!canCreateBooking) {
    return (
      <div className="p-20 text-center text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 rounded-xl border-2 border-dashed border-rose-100 dark:border-rose-500/20">
        <i className="fas fa-lock text-4xl mb-4"></i>
        <h3 className="text-xl font-semibold">Доступ запрещен</h3>
        <p className="text-sm font-medium">У вас нет прав на оформление сделок.</p>
      </div>
    );
  }

  // Moscow Date/Time Helpers
  const getMoscowDateStr = (date = new Date()) => date.toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });
  const getMoscowTimeStr = () => new Date().toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' });

  const today = getMoscowDateStr();
  const nowTime = getMoscowTimeStr();

  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = getMoscowDateStr(tomorrowDate);

  const [formData, setFormData] = useState({
    carId: preSelectedCarId || '',
    clientId: '',
    clientName: '',
    startDate: today,
    startTime: nowTime,
    endDate: tomorrow,
    endTime: nowTime,
    price: 0,
    prepayment: 0,
    // Пусто для новой сделки — сервер сам присвоит номер по счётчику аккаунта.
    // При выдаче/редактировании существующей брони сюда попадает её реальный номер,
    // чтобы не терять его при отправке.
    contractNumber: ''
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
          price: existing.totalAmount,
          prepayment: existing.prepayment || 0,
          contractNumber: existing.contractNumber || ''
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

      let calculatedPrice = 0;
      if (diffMs > 0) {
        const totalHours = diffMs / (1000 * 60 * 60);

        if (bookingType === 'DAILY') {
          if (totalHours <= 24) {
            calculatedPrice = car.pricePerDay;
          } else {
            const fullDays = Math.floor(totalHours / 24);
            const remainingHours = Math.ceil(totalHours % 24);
            const pricePerHour = car.pricePerHour || Math.round(car.pricePerDay / 24);
            calculatedPrice = (fullDays * car.pricePerDay) + (remainingHours * pricePerHour);
          }
        } else { // HOURLY
          const totalHoursCeil = Math.ceil(totalHours);
          calculatedPrice = totalHoursCeil * (car.pricePerHour || Math.round(car.pricePerDay / 24));
        }
      }
      setFormData(prev => ({ ...prev, price: Math.max(0, Math.round(calculatedPrice)) }));
    }
  }, [formData.carId, formData.startDate, formData.startTime, formData.endDate, formData.endTime, bookingType, cars]);

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    return clients.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery));
  }, [clients, searchQuery]);

  // --- Занятость авто ---
  // Отрезки пересекаются, если начало одного строго раньше конца другого и наоборот.
  const conflictFor = (carId: string) => {
    if (!carId || !formData.startDate || !formData.endDate) return null;
    const wantStart = new Date(`${formData.startDate}T${formData.startTime || '00:00'}`).getTime();
    const wantEnd = new Date(`${formData.endDate}T${formData.endTime || '00:00'}`).getTime();
    if (!(wantEnd > wantStart)) return null;

    return rentals.find(r => {
      if (r.carId !== carId || r.status !== 'ACTIVE') return false;
      if (preSelectedRentalId && r.id === preSelectedRentalId) return false;
      const rStart = new Date(`${String(r.startDate).split('T')[0]}T${r.startTime || '00:00'}`).getTime();
      const rEnd = new Date(`${String(r.endDate).split('T')[0]}T${r.endTime || '00:00'}`).getTime();
      return rStart < wantEnd && wantStart < rEnd;
    }) || null;
  };

  const busyCarIds = useMemo(() => {
    const set = new Set<string>();
    cars.forEach(c => { if (conflictFor(c.id)) set.add(c.id); });
    return set;
  }, [cars, rentals, formData.startDate, formData.startTime, formData.endDate, formData.endTime, preSelectedRentalId]);

  // Машины сверх лимита тарифа недоступны для новой сделки (см. services/planFeatures.ts).
  const blockedCarIds = useMemo(
    () => getBlockedCarIds(cars, getPlanFeatures(currentUser).carLimit),
    [cars, currentUser]
  );

  const selectedConflict = formData.carId ? conflictFor(formData.carId) : null;
  const conflictClientName = selectedConflict
    ? clients.find(c => c.id === selectedConflict.clientId)?.name
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.carId || !formData.clientId) { alert('Выберите авто и клиента'); return; }
    // Сервер эту же проверку делает независимо — здесь она нужна, чтобы
    // сказать об этом до отправки, а не показывать ошибку после.
    if (blockedCarIds.has(formData.carId)) {
      alert('Этот автомобиль заблокирован: превышен лимит текущего тарифа. Обновите тариф или освободите место, удалив лишние автомобили.');
      return;
    }
    if (selectedConflict) {
      alert(
        `Автомобиль занят по договору № ${selectedConflict.contractNumber || '—'}`
        + (conflictClientName ? ` (${conflictClientName})` : '')
        + ` с ${new Date(selectedConflict.startDate).toLocaleDateString('ru-RU')} ${selectedConflict.startTime}`
        + ` до ${new Date(selectedConflict.endDate).toLocaleDateString('ru-RU')} ${selectedConflict.endTime}.`
      );
      return;
    }

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
      prepayment: isReservation ? formData.prepayment : 0,
      status: 'ACTIVE',
      // Пусто при создании — сервер присваивает номер атомарно по счётчику аккаунта
      // (см. App.tsx handleSaveRental и backend server.ts). При выдаче/редактировании
      // существующей брони formData.contractNumber уже несёт её реальный номер.
      contractNumber: formData.contractNumber,
      paymentStatus: isReservation ? (formData.prepayment >= formData.price ? 'PAID' : 'DEBT') : paymentMode,
      isReservation: isReservation,
      bookingType: bookingType,
      extensions: []
    };

    const saved = await onCreate(rental);
    if (!saved) return; // сохранение не удалось — App.tsx уже показал уведомление об ошибке

    // Окно успеха и текст для WhatsApp собираем из ответа сервера, а не из
    // локального rental: при создании только сервер знает настоящий номер договора.
    const car = cars.find(c => c.id === saved.carId);
    const client = clients.find(c => c.id === saved.clientId);
    if (car && client) {
      setSuccessData({ rental: saved, car, client });
    } else {
      if (onNavigate) onNavigate('CONTRACTS');
    }

    // Reset form data in background
    setFormData({ carId: '', clientId: '', clientName: '', startDate: today, startTime: nowTime, endDate: tomorrow, endTime: nowTime, price: 0, prepayment: 0, contractNumber: '' });
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

  const handleWhatsAppShare = () => {
    if (!successData) return;
    const { rental, car, client } = successData;

    let phone = client.phone.replace(/\D/g, '');
    // Если номер начинается с 8 и длина 11 цифр (РФ формат), меняем 8 на 7
    if (phone.startsWith('8') && phone.length === 11) {
      phone = '7' + phone.slice(1);
    }

    const typeText = rental.isReservation ? "Ваша бронь подтверждена" : "Ваш договор аренды оформлен";
    const emoji = rental.isReservation ? "🗓" : "🚗";

    const message = `${emoji} *Здравствуйте, ${client.name}!*
    
${typeText} в компании AutoPro.

🚘 *Автомобиль:* ${car.brand} ${car.model}
🔢 *Госномер:* ${car.plate}

📅 *Начало:* ${new Date(rental.startDate).toLocaleDateString()} в ${rental.startTime}
🏁 *Окончание:* ${new Date(rental.endDate).toLocaleDateString()} в ${rental.endTime}

💰 *Сумма:* ${rental.totalAmount.toLocaleString()} ₽
${rental.prepayment ? `💸 *Предоплата:* ${rental.prepayment.toLocaleString()} ₽` : ''}

📍 Ждем вас по адресу: г. Москва, ул. Примерная, 1.
📞 Если возникнут вопросы, звоните нам.`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleCloseSuccess = () => {
    setSuccessData(null);
    if (onNavigate) onNavigate('CONTRACTS');
  };

  const remainingToPay = Math.max(0, formData.price - (formData.prepayment || 0));

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn pb-24 md:pb-0">
      <div className="bg-white dark:bg-slate-800 p-4 md:p-8 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700">
        <h2 className="text-3xl font-semibold text-slate-900 dark:text-white mb-8">{isReservation ? 'Бронирование' : 'Выдача автомобиля'}</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2 ml-2">Режим</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-2xl">
                    <button type="button" onClick={() => setIsReservation(false)} className={`py-3 rounded-xl font-semibold text-[9px] uppercase transition-all ${!isReservation ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>Выдача</button>
                    <button type="button" onClick={() => setIsReservation(true)} className={`py-3 rounded-xl font-semibold text-[9px] uppercase transition-all ${isReservation ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>Бронь</button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2 ml-2">Тип аренды</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-2xl">
                    <button type="button" onClick={() => setBookingType('DAILY')} className={`py-3 rounded-xl font-semibold text-[9px] uppercase transition-all ${bookingType === 'DAILY' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>Сутки</button>
                    <button type="button" onClick={() => setBookingType('HOURLY')} className={`py-3 rounded-xl font-semibold text-[9px] uppercase transition-all ${bookingType === 'HOURLY' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>Часы</button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2 ml-2">
                  Автомобиль
                  {busyCarIds.size > 0 && (
                    <span className="ml-2 text-rose-400 normal-case tracking-normal">
                      занято на эти даты: {busyCarIds.size}
                    </span>
                  )}
                </label>
                <select
                  required
                  className={`w-full p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold outline-none border-2 transition-colors ${
                    selectedConflict ? 'border-rose-400' : 'border-transparent focus:border-blue-500'
                  }`}
                  value={formData.carId}
                  onChange={e => setFormData({...formData, carId: e.target.value})}
                >
                  <option value="">-- Выберите машину --</option>
                  {cars.map(c => (
                    <option key={c.id} value={c.id} disabled={busyCarIds.has(c.id) || blockedCarIds.has(c.id)}>
                      {blockedCarIds.has(c.id) ? '🔒 заблокировано (лимит тарифа) — ' : busyCarIds.has(c.id) ? '● занято — ' : ''}{c.brand} {c.model} — {c.plate}
                    </option>
                  ))}
                </select>

                {selectedConflict && (
                  <div className="mt-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-start gap-2">
                    <i className="fas fa-triangle-exclamation text-rose-500 dark:text-rose-400 mt-0.5"></i>
                    <div className="text-xs font-semibold text-rose-700 dark:text-rose-400 leading-relaxed">
                      Автомобиль занят по договору № {selectedConflict.contractNumber || '—'}
                      {conflictClientName ? ` (${conflictClientName})` : ''}
                      <br />
                      с {new Date(selectedConflict.startDate).toLocaleDateString('ru-RU')} {selectedConflict.startTime}
                      {' '}до {new Date(selectedConflict.endDate).toLocaleDateString('ru-RU')} {selectedConflict.endTime}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2 ml-2">Клиент</label>
                <div onClick={() => setShowClientSearch(true)} className="w-full p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold cursor-pointer flex justify-between items-center hover:bg-slate-100 border-2 border-transparent">
                  <span className={formData.clientName ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}>{formData.clientName || 'Выбрать клиента'}</span>
                  <i className="fas fa-search text-slate-300 dark:text-slate-600"></i>
                </div>
              </div>

              {!isReservation ? (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2 ml-2">Оплата</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-2xl">
                    <button type="button" onClick={() => setPaymentMode('PAID')} className={`py-3 rounded-xl font-semibold text-[10px] uppercase transition-all ${paymentMode === 'PAID' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>Оплачено</button>
                    <button type="button" onClick={() => setPaymentMode('DEBT')} className={`py-3 rounded-xl font-semibold text-[10px] uppercase transition-all ${paymentMode === 'DEBT' ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>Не оплачено</button>
                  </div>
                  {formData.prepayment > 0 && (
                     <div className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400 pl-2">
                        Учтена предоплата: {formData.prepayment.toLocaleString()} ₽. Остаток: {remainingToPay.toLocaleString()} ₽
                     </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2 ml-2">Предоплата (₽)</label>
                  <input type="number" placeholder="0" className="w-full p-4 bg-amber-50 dark:bg-amber-500/10 rounded-2xl font-semibold text-amber-700 dark:text-amber-400 outline-none border-2 border-amber-100 dark:border-amber-500/20" value={formData.prepayment || ''} onChange={e => setFormData({...formData, prepayment: Number(e.target.value)})} />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-2">Начало (МСК)</div>
                <input type="date" required className="p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                <input type="time" required className="p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
                <div className="col-span-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-2">Конец (МСК)</div>
                <input type="date" required className="p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                <input type="time" required className="p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-2 ml-2">Итоговая сумма (₽)</label>
                <div className="relative">
                  <input type="number" required className="w-full p-5 bg-blue-50 dark:bg-blue-500/10 rounded-2xl font-bold text-2xl text-blue-700 dark:text-blue-400 outline-none border-2 border-blue-100 dark:border-blue-500/20" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[8px] font-semibold text-blue-400 uppercase">Авторасчет</div>
                </div>
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={!!selectedConflict}
            className={`w-full py-5 rounded-xl font-semibold text-lg transition-all active:scale-95 shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${isReservation ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'}`}
          >
            {selectedConflict ? 'Автомобиль занят' : isReservation ? 'Забронировать' : 'Оформить выдачу'}
          </button>
        </form>
      </div>

      {showClientSearch && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg p-8 shadow-md flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold uppercase">Выбор клиента</h3>
              <button onClick={() => setShowClientSearch(false)} className="text-slate-400 dark:text-slate-500"><i className="fas fa-times"></i></button>
            </div>
            <input autoFocus placeholder="Поиск..." className="w-full p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl mb-4 font-bold outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <div className="flex-1 overflow-y-auto space-y-2 mb-6 pr-2 custom-scrollbar">
              {filteredClients.map(c => (
                <div key={c.id} onClick={() => { setFormData({...formData, clientId: c.id, clientName: c.name}); setShowClientSearch(false); }} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-700 hover:bg-blue-600 hover:text-white cursor-pointer transition-all">
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
          <form onSubmit={handleQuickAddClient} className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-md animate-scaleIn">
            <h3 className="text-2xl font-semibold mb-8">Быстрое добавление</h3>
            <div className="space-y-4 mb-8">
              <input name="name" placeholder="ФИО" required className="w-full p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold border-none" />
              <input name="phone" placeholder="Телефон" required className="w-full p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold border-none" />
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setShowQuickAdd(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 rounded-2xl font-bold">Отмена</button>
              <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold">Добавить</button>
            </div>
          </form>
        </div>
      )}

      {/* SUCCESS MODAL with WhatsApp */}
      {successData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-md animate-scaleIn text-center">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-lg">
              <i className="fas fa-check"></i>
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Успешно!</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">
              {successData.rental.isReservation ? 'Бронь успешно создана.' : 'Договор аренды оформлен.'}
            </p>

            <div className="space-y-4">
              <button
                onClick={handleWhatsAppShare}
                className="w-full py-5 bg-[#25D366] text-white rounded-2xl font-semibold uppercase tracking-wide text-xs flex items-center justify-center space-x-3 shadow-md hover:bg-[#20b858] transition-all"
              >
                <i className="fab fa-whatsapp text-lg"></i>
                <span>Отправить клиенту</span>
              </button>

              <button
                onClick={handleCloseSuccess}
                className="w-full py-5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-semibold uppercase tracking-wide text-xs hover:bg-slate-200 transition-all"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualBooking;