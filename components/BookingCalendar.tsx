
import React from 'react';
import { Car, Rental, CarStatus } from '../types.ts';

interface BookingCalendarProps {
  cars: Car[];
  rentals: Rental[];
}

const BookingCalendar: React.FC<BookingCalendarProps> = ({ cars, rentals }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const getStatusForCarOnDay = (car: Car, date: Date) => {
    // 1. Проверка на ремонт (глобальный статус)
    if (car.status === CarStatus.MAINTENANCE) {
      return { type: 'MAINTENANCE', label: 'Ремонт' };
    }

    // 2. Проверка активных аренд на этот день
    const activeRental = rentals.find(r => {
      if (r.carId !== car.id || r.status === 'CANCELLED') return false;
      
      const startDate = new Date(r.startDate);
      const endDate = new Date(r.endDate);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);

      return targetDate >= startDate && targetDate <= endDate;
    });

    if (activeRental) {
      return { type: 'RENTED', label: `Аренда: ${activeRental.contractNumber}` };
    }

    return { type: 'AVAILABLE', label: 'Свободен' };
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="px-2">
        <h2 className="text-3xl font-black text-slate-900">Календарь занятости</h2>
        <p className="text-slate-400 font-bold mt-1 uppercase text-[10px] tracking-widest">Планирование и контроль на 14 дней</p>
      </div>
      
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <div className="min-w-[1000px]">
            <div className="grid grid-cols-[250px_repeat(14,1fr)] border-b border-slate-50 bg-slate-50/50">
              <div className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest border-r border-slate-100">Автомобиль</div>
              {days.map(day => (
                <div key={day.toString()} className="p-4 text-center border-r border-slate-100 last:border-r-0">
                  <div className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">{day.toLocaleDateString('ru-RU', { weekday: 'short' })}</div>
                  <div className={`text-sm font-black mt-1 ${day.getTime() === today.getTime() ? 'text-blue-600' : 'text-slate-700'}`}>
                    {day.getDate()}
                  </div>
                </div>
              ))}
            </div>

            <div className="divide-y divide-slate-50">
              {cars.map(car => (
                <div key={car.id} className="grid grid-cols-[250px_repeat(14,1fr)] items-stretch group hover:bg-slate-50/30 transition-all">
                  <div className="p-6 border-r border-slate-100 flex items-center space-x-4 bg-white sticky left-0 z-10 group-hover:bg-slate-50/50">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                       <img src={car.images[0]} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="overflow-hidden">
                      <div className="font-bold text-slate-900 text-sm truncate">{car.brand} {car.model}</div>
                      <div className="text-[10px] text-slate-400 font-black tracking-widest uppercase truncate">{car.plate}</div>
                    </div>
                  </div>
                  {days.map(day => {
                    const status = getStatusForCarOnDay(car, day);
                    return (
                      <div key={day.toString()} className="p-2 border-r border-slate-100 last:border-r-0 flex items-center justify-center">
                        <div 
                          title={`${car.brand} ${car.model} - ${status.label}`}
                          className={`w-full h-10 rounded-xl transition-all active:scale-95 cursor-default ${
                            status.type === 'RENTED' ? 'bg-rose-500 shadow-lg shadow-rose-200 ring-2 ring-white ring-inset' : 
                            status.type === 'MAINTENANCE' ? 'bg-slate-300' : 'bg-emerald-100/50 hover:bg-emerald-100'
                          }`}
                        ></div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 flex flex-wrap gap-8 items-center justify-center shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 rounded-lg bg-emerald-100 shadow-inner"></div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Свободен</span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 rounded-lg bg-rose-500 shadow-lg shadow-rose-200"></div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">В аренде / Занят</span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 rounded-lg bg-slate-300"></div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Сервис / Ремонт</span>
        </div>
      </div>
    </div>
  );
};

export default BookingCalendar;
