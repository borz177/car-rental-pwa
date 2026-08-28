
import React, { useState, useMemo } from 'react';
import { Car, CarStatus, Rental, Client } from '../types';
import { CAR_PLACEHOLDER_IMAGE } from '../constants';

interface BookingCalendarProps {
  cars: Car[];
  rentals: Rental[];
  clients: Client[];
  onSelectCar: (carId: string) => void;
  onBookCar: (carId: string) => void;
}

const dateOnly = (v: string) => String(v).split('T')[0];
const toKey = (d: Date) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD без сдвига в UTC

const getMoscowToday = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  d.setHours(0, 0, 0, 0);
  return d;
};

type Segment =
  | { kind: 'free'; span: number; startKey: string }
  | { kind: 'maintenance'; span: number }
  | { kind: 'rental'; span: number; rental: Rental; clipsLeft: boolean; clipsRight: boolean };

const BookingCalendar: React.FC<BookingCalendarProps> = ({ cars, rentals, clients, onSelectCar, onBookCar }) => {
  const today = getMoscowToday();
  const [offset, setOffset] = useState(0);      // сдвиг периода в днях
  const [rangeLength, setRangeLength] = useState(14);
  const [search, setSearch] = useState('');

  const days = useMemo(() => Array.from({ length: rangeLength }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + offset + i);
    return d;
  }), [today, offset, rangeLength]);

  const dayKeys = useMemo(() => days.map(toKey), [days]);
  const todayKey = toKey(today);

  const visibleCars = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cars;
    return cars.filter(c => `${c.brand} ${c.model} ${c.plate}`.toLowerCase().includes(q));
  }, [cars, search]);

  const clientName = (id: string) => clients.find(c => c.id === id)?.name || 'Клиент удалён';

  // Аренда, занимающая конкретный день (сравниваем строки дат — без часовых поясов).
  const rentalOnDay = (carId: string, key: string) =>
    rentals.find(r =>
      r.carId === carId &&
      r.status === 'ACTIVE' &&
      dateOnly(r.startDate) <= key &&
      key <= dateOnly(r.endDate)
    );

  // Собираем строку в отрезки: подряд идущие дни одной аренды становятся одной полосой,
  // поэтому видно имя клиента и срок, а не набор одинаковых квадратов.
  const buildRow = (car: Car): Segment[] => {
    if (car.status === CarStatus.MAINTENANCE) {
      return [{ kind: 'maintenance', span: dayKeys.length }];
    }
    const segments: Segment[] = [];
    let i = 0;
    while (i < dayKeys.length) {
      const rental = rentalOnDay(car.id, dayKeys[i]);
      if (!rental) {
        segments.push({ kind: 'free', span: 1, startKey: dayKeys[i] });
        i++;
        continue;
      }
      let span = 1;
      while (i + span < dayKeys.length && rentalOnDay(car.id, dayKeys[i + span])?.id === rental.id) span++;
      segments.push({
        kind: 'rental',
        span,
        rental,
        // Полоса обрезана, если аренда началась раньше периода или заканчивается позже.
        clipsLeft: dateOnly(rental.startDate) < dayKeys[i],
        clipsRight: dateOnly(rental.endDate) > dayKeys[i + span - 1]
      });
      i += span;
    }
    return segments;
  };

  const stats = useMemo(() => {
    const busy = new Set(
      rentals.filter(r => r.status === 'ACTIVE' && dateOnly(r.startDate) <= todayKey && todayKey <= dateOnly(r.endDate))
        .map(r => r.carId)
    );
    const maintenance = cars.filter(c => c.status === CarStatus.MAINTENANCE).length;
    const busyCount = cars.filter(c => busy.has(c.id) && c.status !== CarStatus.MAINTENANCE).length;
    return { free: cars.length - busyCount - maintenance, busy: busyCount, maintenance };
  }, [cars, rentals, todayKey]);

  const periodLabel = `${days[0].toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })} — ${days[days.length - 1].toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: '2-digit' })}`;

  const gridCols = { gridTemplateColumns: `170px repeat(${dayKeys.length}, minmax(44px, 1fr))` };

  return (
    <div className="space-y-4 animate-fadeIn pb-24 md:pb-0">
      {/* Панель управления периодом */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset(o => o - rangeLength)}
              className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Предыдущий период"
            >
              <i className="fas fa-chevron-left text-xs"></i>
            </button>
            <button
              onClick={() => setOffset(0)}
              className={`px-3 h-9 rounded-xl text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                offset === 0 ? 'bg-blue-600 text-white' : 'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              Сегодня
            </button>
            <button
              onClick={() => setOffset(o => o + rangeLength)}
              className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Следующий период"
            >
              <i className="fas fa-chevron-right text-xs"></i>
            </button>
            <span className="ml-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{periodLabel}</span>
          </div>

          <div className="flex items-center gap-2">
            {[7, 14, 30].map(n => (
              <button
                key={n}
                onClick={() => { setRangeLength(n); setOffset(0); }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  rangeLength === n ? 'bg-slate-800 text-white' : 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                {n} дн.
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 text-xs"></i>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Марка, модель или госномер"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-xl text-sm font-medium outline-none border-2 border-transparent focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold">
            <span className="text-emerald-600 dark:text-emerald-400">Свободно сегодня: {stats.free}</span>
            <span className="text-blue-600 dark:text-blue-400">Занято: {stats.busy}</span>
            {stats.maintenance > 0 && <span className="text-slate-500 dark:text-slate-400">Ремонт: {stats.maintenance}</span>}
          </div>
        </div>
      </div>

      {/* Шахматка */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Заголовок с датами */}
            <div className="grid border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-700" style={gridCols}>
              <div className="p-3 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide border-r border-slate-100 dark:border-slate-700 sticky left-0 bg-slate-50 dark:bg-slate-700 z-20">
                Автомобиль
              </div>
              {days.map((day, i) => {
                const key = dayKeys[i];
                const isToday = key === todayKey;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <div key={key} className={`py-2 text-center border-r border-slate-100 dark:border-slate-700 last:border-r-0 ${isToday ? 'bg-blue-50 dark:bg-blue-500/10' : isWeekend ? 'bg-slate-100/60 dark:bg-slate-700' : ''}`}>
                    <div className={`text-[9px] uppercase font-semibold ${isToday ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                      {day.toLocaleDateString('ru-RU', { weekday: 'short' })}
                    </div>
                    <div className={`text-sm font-bold ${isToday ? 'text-blue-600 dark:text-blue-400' : isWeekend ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                      {day.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Строки автомобилей */}
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {visibleCars.map(car => (
                <div key={car.id} className="grid items-stretch hover:bg-slate-50/40 dark:hover:bg-slate-700 transition-colors" style={gridCols}>
                  <button
                    onClick={() => onSelectCar(car.id)}
                    className="p-2.5 border-r border-slate-100 dark:border-slate-700 flex items-center gap-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 sticky left-0 z-10 text-left transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 flex-shrink-0">
                      <img
                        src={car.images?.[0] || CAR_PLACEHOLDER_IMAGE}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white text-xs truncate">{car.brand} {car.model}</div>
                      <div className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide">{car.plate}</div>
                    </div>
                  </button>

                  {buildRow(car).map((seg, idx) => {
                    if (seg.kind === 'maintenance') {
                      return (
                        <div key={idx} style={{ gridColumn: `span ${seg.span}` }} className="p-1.5 flex items-center">
                          <div className="w-full h-9 rounded-lg bg-slate-200 dark:bg-slate-600 flex items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400">
                            <i className="fas fa-screwdriver-wrench text-[10px]"></i>
                            <span className="text-[10px] font-semibold uppercase tracking-wide">В ремонте</span>
                          </div>
                        </div>
                      );
                    }

                    if (seg.kind === 'free') {
                      const isPast = seg.startKey < todayKey;
                      return (
                        <div key={idx} className="p-1.5 border-r border-slate-50 dark:border-slate-800 last:border-r-0">
                          <button
                            onClick={() => !isPast && onBookCar(car.id)}
                            disabled={isPast}
                            title={isPast ? '' : 'Оформить на этот автомобиль'}
                            className={`w-full h-9 rounded-lg transition-colors ${
                              isPast ? 'bg-slate-50 dark:bg-slate-700' : 'bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 cursor-pointer'
                            }`}
                          ></button>
                        </div>
                      );
                    }

                    const { rental } = seg;
                    const isReservation = rental.isReservation;
                    return (
                      <div key={idx} style={{ gridColumn: `span ${seg.span}` }} className="p-1.5">
                        <button
                          onClick={() => onSelectCar(car.id)}
                          title={`${isReservation ? 'Бронь' : 'Аренда'} № ${rental.contractNumber || '—'} · ${clientName(rental.clientId)} · ${new Date(rental.startDate).toLocaleDateString('ru-RU')} — ${new Date(rental.endDate).toLocaleDateString('ru-RU')}`}
                          className={`w-full h-9 flex items-center gap-1.5 px-2 overflow-hidden transition-opacity hover:opacity-90 ${
                            isReservation ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'
                          } ${seg.clipsLeft ? 'rounded-l-none' : 'rounded-l-lg'} ${seg.clipsRight ? 'rounded-r-none' : 'rounded-r-lg'}`}
                        >
                          {seg.clipsLeft && <i className="fas fa-chevron-left text-[8px] opacity-70 flex-shrink-0"></i>}
                          <span className="text-[10px] font-semibold truncate flex-1 text-left">
                            {seg.span > 1 ? clientName(rental.clientId) : ''}
                          </span>
                          {seg.clipsRight && <i className="fas fa-chevron-right text-[8px] opacity-70 flex-shrink-0"></i>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}

              {visibleCars.length === 0 && (
                <div className="p-12 text-center">
                  <i className="fas fa-car-side text-3xl text-slate-200 dark:text-slate-700 mb-3"></i>
                  <div className="font-semibold text-slate-500 dark:text-slate-400">
                    {search ? 'Ничего не найдено' : 'В автопарке нет автомобилей'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Легенда */}
      <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-wrap gap-5 items-center justify-center">
        {[
          { color: 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20', label: 'Свободен — нажмите, чтобы оформить' },
          { color: 'bg-blue-600', label: 'Аренда' },
          { color: 'bg-amber-500', label: 'Бронь' },
          { color: 'bg-slate-200 dark:bg-slate-600', label: 'Ремонт' }
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded ${item.color}`}></div>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BookingCalendar;
