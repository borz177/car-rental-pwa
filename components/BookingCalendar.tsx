
import React from 'react';
import { Car, Rental, CarStatus } from '../types';

interface BookingCalendarProps {
  cars: Car[];
  rentals: Rental[];
}

const BookingCalendar: React.FC<BookingCalendarProps> = ({ cars, rentals }) => {
  // Use Moscow time for "Today" calculation
  const getMoscowDate = () => {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const today = getMoscowDate();

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const getStatusForCarOnDay = (car: Car, date: Date) => {
    if (car.status === CarStatus.MAINTENANCE) return { type: 'MAINTENANCE', label: 'Ремонт' };

    const activeRental = rentals.find(r => {
      if (r.carId !== car.id || r.status !== 'ACTIVE') return false;
      const start = new Date(r.startDate); const end = new Date(r.endDate);
      start.setHours(0,0,0,0); end.setHours(0,0,0,0);
      const target = new Date(date); target.setHours(0,0,0,0);
      return target >= start && target <= end;
    });

    if (activeRental) {
      return {
        type: activeRental.isReservation ? 'RESERVED' : 'RENTED',
        label: `${activeRental.isReservation ? 'Бронь' : 'Аренда'}: ${activeRental.contractNumber}`
      };
    }

    return { type: 'AVAILABLE', label: 'Свободен' };
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="px-2">
        <h2 className="text-3xl font-black text-slate-900">Календарь занятости</h2>
        <p className="text-slate-400 font-bold mt-1 uppercase text-[10px] tracking-widest">Аренда (синий) и Бронирования (оранжевый)</p>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <div className="min-w-[1000px]">
            <div className="grid grid-cols-[250px_repeat(14,1fr)] border-b border-slate-50 bg-slate-50/50">
              <div className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest border-r border-slate-100">Автомобиль</div>
              {days.map(day => (
                <div key={day.toString()} className="p-4 text-center border-r border-slate-100 last:border-r-0">
                  <div className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">{day.toLocaleDateString('ru-RU', { weekday: 'short' })}</div>
                  <div className={`text-sm font-black mt-1 ${day.getTime() === today.getTime() ? 'text-blue-600 underline decoration-2' : 'text-slate-700'}`}>{day.getDate()}</div>
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
                      <div className="font-bold text-slate-900 text-xs truncate">{car.brand} {car.model}</div>
                      <div className="text-[9px] text-slate-400 font-black tracking-widest uppercase">{car.plate}</div>
                    </div>
                  </div>
                  {days.map(day => {
                    const status = getStatusForCarOnDay(car, day);
                    return (
                      <div key={day.toString()} className="p-2 border-r border-slate-100 last:border-r-0 flex items-center justify-center">
                        <div
                          title={status.label}
                          className={`w-full h-10 rounded-xl transition-all ${
                            status.type === 'RENTED' ? 'bg-blue-600 shadow-lg shadow-blue-100' : 
                            status.type === 'RESERVED' ? 'bg-amber-500 shadow-lg shadow-amber-100' :
                            status.type === 'MAINTENANCE' ? 'bg-slate-300' : 'bg-emerald-100/40 hover:bg-emerald-100'
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
        <div className="flex items-center space-x-3"><div className="w-5 h-5 rounded-lg bg-emerald-100 shadow-inner"></div><span className="text-[9px] font-black text-slate-500 uppercase">Свободен</span></div>
        <div className="flex items-center space-x-3"><div className="w-5 h-5 rounded-lg bg-blue-600 shadow-lg"></div><span className="text-[9px] font-black text-slate-500 uppercase">Аренда</span></div>
        <div className="flex items-center space-x-3"><div className="w-5 h-5 rounded-lg bg-amber-500 shadow-lg"></div><span className="text-[9px] font-black text-slate-500 uppercase">Бронь</span></div>
        <div className="flex items-center space-x-3"><div className="w-5 h-5 rounded-lg bg-slate-300"></div><span className="text-[9px] font-black text-slate-500 uppercase">Ремонт</span></div>
      </div>
    </div>
  );
};

export default BookingCalendar;
