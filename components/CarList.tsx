
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Car, CarStatus, FuelType, Transmission, Investor, Rental, Client, User, UserRole } from '../types';
import BackendAPI from '../services/api';
import { getBlockedCarIds } from '../services/planFeatures';
import { CAR_PLACEHOLDER_IMAGE } from '../constants';

interface CarListProps {
  cars: Car[];
  investors: Investor[];
  rentals: Rental[];
  clients: Client[];
  onAdd: (c: Car) => void;
  onUpdate: (c: Car) => void;
  onDelete: (id: string) => void;
  onIssue: (carId: string) => void;
  onReserve: (carId: string) => void;
  onInfo: (carId: string) => void;
  onComplete: (rental: Rental) => void;
  currentUser: User;
  planLimit?: number;
  onUpgrade?: () => void;
  autoEditCarId?: string | null;
  onAutoEditHandled?: () => void;
}

const OIL_CHANGE_WARNING_KM = 1000;

const parseOptionalNumber = (value: FormDataEntryValue | null): number | undefined => {
  const raw = ((value as string) ?? '').trim();
  if (raw === '') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const CarCard: React.FC<{
  car: Car,
  activeRental?: Rental,
  clientPhone?: string;
  isBlocked?: boolean;
  onEdit: () => void,
  onDelete: () => void,
  onIssue: () => void,
  onReserve: () => void,
  onInfo: () => void,
  onViewImages: (images: string[]) => void,
  onComplete: (rental: Rental) => void,
  currentUser: User;
}> = ({ car, activeRental, clientPhone, isBlocked, onEdit, onDelete, onIssue, onReserve, onInfo, onViewImages, onComplete, currentUser }) => {
  const [showMenu, setShowMenu] = useState(false);

  const permissions = currentUser.permissions;
  const isStaff = currentUser.role === UserRole.STAFF;
  const canEdit = !isStaff || permissions?.canEdit;
  const canDelete = !isStaff || permissions?.canDelete;
  const canCreateBooking = !isStaff || permissions?.canCreateBooking;
  // Оформление НОВОЙ сделки на заблокированную (сверх лимита тарифа) машину запрещено,
  // но завершить уже идущую аренду на ней по-прежнему можно — блокировка не должна
  // мешать закрыть то, что уже было оформлено до понижения тарифа.
  const canBookNew = canCreateBooking && !isBlocked;
  const showDeleteButton = (currentUser.settings?.showDeleteCarButton ?? true) && canDelete;

  const getDisplayStatus = () => {
    if (isBlocked) return { label: 'Заблокировано', color: 'bg-rose-600' };
    if (car.status === CarStatus.MAINTENANCE) return { label: 'В ремонте', color: 'bg-slate-800' };
    if (activeRental && !activeRental.isReservation) return { label: 'В аренде', color: 'bg-blue-600' };
    if (activeRental && activeRental.isReservation) return { label: 'Забронирован', color: 'bg-amber-500' };
    return { label: 'Свободен', color: 'bg-emerald-500' };
  };
  const status = getDisplayStatus();

  const handleWhatsAppClick = () => {
    if (!clientPhone) return;
    let phone = clientPhone.replace(/\D/g, '');
    if (phone.startsWith('8') && phone.length === 11) {
      phone = '7' + phone.slice(1);
    }
    const url = `https://wa.me/${phone}`;
    window.open(url, '_blank');
  };

  const kmUntilChange = useMemo(() => {
    if (car.oilChangeInterval && typeof car.lastOilChangeMileage === 'number' && typeof car.mileage === 'number') {
      return (car.lastOilChangeMileage + car.oilChangeInterval) - car.mileage;
    }
    return null;
  }, [car.mileage, car.lastOilChangeMileage, car.oilChangeInterval]);

  const oilChangeStatus = useMemo(() => {
    if (kmUntilChange === null) return null;
    if (kmUntilChange <= 0) return 'OVERDUE';
    if (kmUntilChange <= OIL_CHANGE_WARNING_KM) return 'SOON';
    return null;
  }, [kmUntilChange]);

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card actions when clicking image
    onViewImages(car.images);
  };

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm border transition-all group hover:shadow-md relative ${isBlocked ? 'border-rose-200 dark:border-rose-500/20' : 'border-slate-100 dark:border-slate-700'}`}>
      <div className={`h-40 md:h-40 relative overflow-hidden bg-slate-100 dark:bg-slate-700 cursor-pointer ${isBlocked ? 'grayscale opacity-70' : ''}`} onClick={handleImageClick}>
        <img src={car.images[0] || CAR_PLACEHOLDER_IMAGE} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="" />

        <div
          title={isBlocked ? 'Превышен лимит текущего тарифа — обновите тариф, чтобы разблокировать' : undefined}
          className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[9px] font-semibold uppercase tracking-wide shadow-lg z-10 text-white flex items-center gap-1.5 ${status.color}`}
        >
          {isBlocked && <i className="fas fa-lock text-[8px]"></i>}
          {status.label}
        </div>

        {oilChangeStatus && (
          <div
            title={oilChangeStatus === 'OVERDUE' ? `Замена масла просрочена на ${-kmUntilChange!} км` : `Замена масла через ${kmUntilChange!} км`}
            className={`absolute top-4 left-4 w-8 h-8 rounded-full flex items-center justify-center shadow-lg z-10 ${oilChangeStatus === 'OVERDUE' ? 'bg-rose-500 text-white animate-pulse' : 'bg-amber-400 text-white'}`}
          >
            <i className="fas fa-oil-can"></i>
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex justify-between items-start mb-3">
          <div onClick={onInfo} className="cursor-pointer min-w-0 pr-2 group/title">
            <h3 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white tracking-tight truncate group-hover/title:text-blue-600 transition-colors">{car.brand} {car.model}</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide">{car.plate} • {car.year} г.</p>
          </div>
          <div className="text-right">
            <div className="text-blue-600 dark:text-blue-400 font-bold text-base md:text-lg leading-none">{car.pricePerDay.toLocaleString()} ₽</div>
            <div className="text-[8px] text-slate-400 dark:text-slate-500 uppercase font-semibold tracking-wide">в сутки</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status.label === 'Свободен' ? (
            <div className="flex-1 flex gap-2">
              <button onClick={onIssue} disabled={!canBookNew} title={isBlocked ? 'Превышен лимит тарифа' : undefined} className="flex-1 bg-blue-600 text-white py-2.5 rounded-2xl font-semibold text-[10px] uppercase transition-all hover:bg-blue-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">Оформить</button>
              <button onClick={onReserve} disabled={!canBookNew} title={isBlocked ? 'Превышен лимит тарифа' : undefined} className="flex-1 bg-amber-500 text-white py-2.5 rounded-2xl font-semibold text-[10px] uppercase transition-all hover:bg-amber-600 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">Бронь</button>
            </div>
          ) : (
            <div className="flex-1 flex gap-2">
              <button onClick={handleWhatsAppClick} className="flex-1 bg-emerald-500 text-white py-2.5 rounded-2xl font-semibold text-[10px] uppercase transition-all hover:bg-emerald-600 shadow-lg flex items-center justify-center gap-2">
                <i className="fab fa-whatsapp"></i><span>Написать</span>
              </button>
              <button onClick={onReserve} disabled={!canBookNew} title={isBlocked ? 'Превышен лимит тарифа' : undefined} className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-2.5 rounded-2xl font-semibold text-[10px] uppercase hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed">Бронь</button>
            </div>
          )}
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="w-10 h-10 bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 rounded-2xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700 transition-all">
              <i className="fas fa-ellipsis-v text-xs"></i>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)}></div>
                <div className="absolute bottom-14 right-0 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-50 dark:border-slate-800 z-30 py-1 animate-scaleIn">
                  <button onClick={() => { onInfo(); setShowMenu(false); }} className="w-full px-5 py-3 text-left text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-3 text-slate-600 dark:text-slate-300"><i className="fas fa-circle-info text-blue-500 dark:text-blue-400 w-4"></i><span>Подробнее</span></button>
                  {canEdit && <button onClick={() => { onEdit(); setShowMenu(false); }} className="w-full px-5 py-3 text-left text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-3 text-amber-500 dark:text-amber-400"><i className="fas fa-edit w-4"></i><span>Изменить</span></button>}
                  {activeRental && !activeRental.isReservation && canCreateBooking && (
                    <button onClick={() => { onComplete(activeRental); setShowMenu(false); }} className="w-full px-5 py-3 text-left text-xs font-bold hover:bg-blue-50 dark:hover:bg-blue-500/10 flex items-center space-x-3 text-blue-600 dark:text-blue-400"><i className="fas fa-check-circle w-4"></i><span>Завершить</span></button>
                  )}
                  {showDeleteButton && <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full px-5 py-3 text-left text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-500 dark:text-rose-400 flex items-center space-x-3"><i className="fas fa-trash-alt w-4"></i><span>Удалить</span></button>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CarList: React.FC<CarListProps> = ({
  cars, investors, rentals, clients, onAdd, onUpdate, onDelete, onIssue, onReserve, onInfo, onComplete, currentUser,
  planLimit = 9999, onUpgrade, autoEditCarId, onAutoEditHandled
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Car | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [tempImages, setTempImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewingImages, setViewingImages] = useState<string[] | null>(null);

  const blockedCarIds = useMemo(() => getBlockedCarIds(cars, planLimit), [cars, planLimit]);

  // Возврат из карточки автомобиля по кнопке «Изменить» — сразу открываем форму.
  useEffect(() => {
    if (!autoEditCarId) return;
    const target = cars.find(c => c.id === autoEditCarId);
    if (target) {
      setEditing(target);
      setTempImages(target.images || []);
      setIsModalOpen(true);
    }
    onAutoEditHandled?.();
  }, [autoEditCarId, cars]);

  const permissions = currentUser.permissions;
  const isStaff = currentUser.role === UserRole.STAFF;
  const canAddCar = (!isStaff || permissions?.canAddCar) && (currentUser.settings?.showAddCarButton ?? true);

  const getActiveRental = (carId: string) => rentals.find(r => r.carId === carId && r.status === 'ACTIVE');
  const getClientData = (clientId?: string) => clients.find(c => c.id === clientId);

  const counts = useMemo(() => {
    const rentedIds = new Set(rentals.filter(r => r.status === 'ACTIVE' && !r.isReservation).map(r => r.carId));
    const reservedIds = new Set(rentals.filter(r => r.status === 'ACTIVE' && r.isReservation).map(r => r.carId));
    const maintenanceCount = cars.filter(c => c.status === CarStatus.MAINTENANCE).length;

    const rentedCount = rentedIds.size;
    const reservedCount = reservedIds.size;

    const availableCount = cars.filter(c =>
        c.status !== CarStatus.MAINTENANCE &&
        !rentedIds.has(c.id) &&
        !reservedIds.has(c.id)
    ).length;

    return {
        ALL: cars.length,
        AVAILABLE: availableCount,
        RENTED: rentedCount,
        RESERVED: reservedCount,
        MAINTENANCE: maintenanceCount
    };
  }, [cars, rentals]);

  const query = search.trim().toLowerCase();
  const filteredCars = cars.filter(car => {
    if (query) {
      const haystack = `${car.brand} ${car.model} ${car.plate} ${car.category || ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'MAINTENANCE') return car.status === CarStatus.MAINTENANCE;
    const rent = getActiveRental(car.id);
    if (statusFilter === 'AVAILABLE') return !rent && car.status !== CarStatus.MAINTENANCE;
    if (statusFilter === 'RENTED') return rent && !rent.isReservation;
    if (statusFilter === 'RESERVED') return rent && rent.isReservation;
    return true;
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const car: Car = {
      id: editing?.id || '',
      ownerId: editing?.ownerId || currentUser.id,
      brand: fd.get('brand') as string,
      model: fd.get('model') as string,
      year: Number(fd.get('year')),
      plate: fd.get('plate') as string,
      status: fd.get('status') as CarStatus,
      pricePerDay: Number(fd.get('pricePerDay')),
      pricePerHour: Number(fd.get('pricePerHour')),
      category: fd.get('category') as string,
      mileage: Number(fd.get('mileage')),
      fuel: fd.get('fuel') as FuelType,
      transmission: fd.get('transmission') as Transmission,
      images: tempImages.length > 0 ? tempImages : (editing?.images || []),
      investorId: (fd.get('investorId') as string) || undefined,
      investorShare: Number(fd.get('investorShare')) || 0,
      // Пустое поле -> undefined, но 0 — валидное значение (новое авто с нулевого пробега),
      // поэтому `|| undefined` здесь использовать нельзя: он глушил учёт замены масла.
      lastOilChangeMileage: parseOptionalNumber(fd.get('lastOilChangeMileage')),
      oilChangeInterval: parseOptionalNumber(fd.get('oilChangeInterval'))
    };
    if (editing) onUpdate(car); else onAdd(car);
    setIsModalOpen(false); setEditing(null); setTempImages([]);
  };

  return (
    <div className="space-y-4 animate-fadeIn pb-24 md:pb-0">
      {blockedCarIds.size > 0 && (
        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <i className="fas fa-lock"></i>
            </div>
            <div>
              <div className="font-semibold text-sm text-rose-700 dark:text-rose-400">Превышен лимит тарифа: заблокировано {blockedCarIds.size} {blockedCarIds.size === 1 ? 'автомобиль' : 'автомобиля'}</div>
              <div className="text-xs text-rose-500 dark:text-rose-400 mt-0.5">Текущий тариф позволяет использовать до {planLimit} автомобилей. Заблокированные недоступны для новых сделок.</div>
            </div>
          </div>
          {onUpgrade && (
            <button onClick={onUpgrade} className="shrink-0 px-5 py-2.5 bg-rose-600 text-white rounded-xl font-semibold text-xs uppercase tracking-wide hover:bg-rose-700 transition-all">
              Обновить тариф
            </button>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-4">
        <div className="relative">
          <i className="fas fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 text-xs"></i>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по марке, модели или гос. номеру"
            className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-700 rounded-xl font-semibold text-sm outline-none border-2 border-transparent focus:border-blue-500 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <i className="fas fa-xmark text-xs"></i>
            </button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'ALL', label: 'Все', count: counts.ALL },
                { id: 'AVAILABLE', label: 'Свободны', count: counts.AVAILABLE },
                { id: 'RENTED', label: 'В аренде', count: counts.RENTED },
                { id: 'RESERVED', label: 'В брони', count: counts.RESERVED },
                { id: 'MAINTENANCE', label: 'В ремонте', count: counts.MAINTENANCE },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-4 py-2 rounded-xl text-[9px] font-semibold uppercase transition-all flex items-center gap-2 ${statusFilter === f.id ? 'bg-blue-600 text-white' : 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}
                >
                  <span>{f.label}</span>
                  <span className={`px-2 py-0.5 text-[10px] rounded-md ${statusFilter === f.id ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-600'}`}>{f.count}</span>
                </button>
              ))}
            </div>
          </div>

          {canAddCar && (
            <button
              onClick={() => {
                setEditing(null); setTempImages([]); setIsModalOpen(true);
              }}
              className="w-full lg:w-auto px-8 py-5 rounded-xl font-semibold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
            >
              <i className="fas fa-plus"></i>
              <span>Добавить авто</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCars.map((car) => {
          const rental = getActiveRental(car.id);
          const client = getClientData(rental?.clientId);
          return (
            <CarCard
              key={car.id}
              car={car}
              activeRental={rental}
              clientPhone={client?.phone}
              isBlocked={blockedCarIds.has(car.id)}
              currentUser={currentUser}
              onEdit={() => { setEditing(car); setTempImages(car.images); setIsModalOpen(true); }}
              onDelete={() => confirm('Удалить?') && onDelete(car.id)}
              onIssue={() => onIssue(car.id)}
              onReserve={() => onReserve(car.id)}
              onInfo={() => onInfo(car.id)}
              onViewImages={setViewingImages}
              onComplete={onComplete}
            />
          );
        })}
      </div>

      {filteredCars.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-12 text-center">
          <i className="fas fa-car-side text-3xl text-slate-200 dark:text-slate-700 mb-3"></i>
          <div className="font-semibold text-slate-500 dark:text-slate-400">
            {query ? 'Ничего не найдено' : 'В этой категории нет автомобилей'}
          </div>
          {query && (
            <button onClick={() => setSearch('')} className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
              Сбросить поиск
            </button>
          )}
        </div>
      )}

      {viewingImages && <ImageViewerModal images={viewingImages} onClose={() => setViewingImages(null)} />}

      {isModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl p-5 md:p-8 shadow-md my-auto animate-scaleIn">
            <h2 className="text-3xl font-semibold text-slate-900 dark:text-white uppercase mb-8">{editing ? 'Редактировать' : 'Новое'} авто</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="space-y-4">
                  <input name="brand" defaultValue={editing?.brand} required placeholder="Марка" className="w-full p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold outline-none" />
                  <input name="model" defaultValue={editing?.model} required placeholder="Модель" className="w-full p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold outline-none" />
                  <div className="grid grid-cols-2 gap-4">
                    <input name="year" type="number" defaultValue={editing?.year} required placeholder="Год" className="p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold outline-none" />
                    <input name="plate" defaultValue={editing?.plate} required placeholder="Гос. номер" className="p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold outline-none uppercase" />
                  </div>
                   <input name="mileage" type="number" defaultValue={editing?.mileage} placeholder="Пробег (км)" className="w-full p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold outline-none" />
                  <div className="p-4 bg-indigo-50/50 dark:bg-indigo-500/10 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 space-y-3">
                     <div className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide ml-1">Данные инвестора</div>
                     <select name="investorId" defaultValue={editing?.investorId || ''} className="w-full p-3 bg-white dark:bg-slate-800 rounded-xl font-bold border border-indigo-100 dark:border-indigo-500/20 outline-none">
                        <option value="">Собственный автопарк</option>
                        {investors.map(inv => <option key={inv.id} value={inv.id}>{inv.name}</option>)}
                     </select>
                     <div className="relative">
                        <input name="investorShare" type="number" defaultValue={editing?.investorShare || 0} placeholder="Доля инвестора %" className="w-full p-3 bg-white dark:bg-slate-800 rounded-xl font-bold border border-indigo-100 dark:border-indigo-500/20 outline-none" />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300 font-bold">%</span>
                     </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input name="pricePerDay" type="number" defaultValue={editing?.pricePerDay} required placeholder="Цена сутки" className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-2xl font-bold text-blue-600 dark:text-blue-400 outline-none" />
                    <input name="pricePerHour" type="number" defaultValue={editing?.pricePerHour} required placeholder="Цена час" className="p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold outline-none" />
                  </div>
                  <select name="status" defaultValue={editing?.status || CarStatus.AVAILABLE} className="w-full p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold outline-none">
                    {Object.values(CarStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <div className="p-4 bg-amber-50/50 dark:bg-amber-500/10 rounded-2xl border border-amber-100 dark:border-amber-500/20 space-y-3">
                     <div className="text-[10px] font-semibold text-amber-500 dark:text-amber-400 uppercase tracking-wide ml-1">Замена масла</div>
                     <input name="lastOilChangeMileage" type="number" defaultValue={editing?.lastOilChangeMileage} placeholder="Пробег последней замены" className="w-full p-3 bg-white dark:bg-slate-800 rounded-xl font-bold border border-amber-100 dark:border-amber-500/20 outline-none" />
                     <input name="oilChangeInterval" type="number" defaultValue={editing?.oilChangeInterval || 10000} placeholder="Интервал замены (км)" className="w-full p-3 bg-white dark:bg-slate-800 rounded-xl font-bold border border-amber-100 dark:border-amber-500/20 outline-none" />
                  </div>
                  <div className="aspect-video bg-slate-50 dark:bg-slate-700 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-600 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 cursor-pointer hover:border-blue-400 hover:text-blue-500 dark:hover:text-blue-400 transition-all" onClick={() => fileInputRef.current?.click()}>
                     <i className="fas fa-camera text-2xl"></i>
                     <span className="text-[10px] font-semibold uppercase mt-2">{tempImages.length > 0 ? `${tempImages.length} фото` : 'Добавить фото'}</span>
                  </div>
                  <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={async (e) => {
                    const files = e.target.files; if (!files) return;
                    const imgs = []; for (let i=0; i<files.length; i++) imgs.push(await BackendAPI.compressImage(files[i]));
                    setTempImages(imgs);
                  }} />
                </div>
              </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 bg-slate-100 dark:bg-slate-700 rounded-2xl font-semibold text-slate-500 dark:text-slate-400 uppercase text-[10px]">Отмена</button>
              <button type="submit" className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-semibold uppercase text-[10px] shadow-md">Сохранить</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const ImageViewerModal: React.FC<{images: string[], onClose: () => void}> = ({ images, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextImage(e as any);
      if (e.key === 'ArrowLeft') prevImage(e as any);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images.length]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fadeIn" onClick={onClose}>
      <img src={images[currentIndex]} alt="Car view" className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-md" onClick={e => e.stopPropagation()} />

      <button onClick={onClose} className="absolute top-5 right-5 w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 dark:hover:bg-slate-800 transition-all text-lg">
        <i className="fas fa-times"></i>
      </button>

      {images.length > 1 && (
        <>
          <button onClick={prevImage} className="absolute left-5 top-1/2 -translate-y-1/2 w-14 h-14 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 dark:hover:bg-slate-800 transition-all text-xl">
            <i className="fas fa-chevron-left"></i>
          </button>
          <button onClick={nextImage} className="absolute right-5 top-1/2 -translate-y-1/2 w-14 h-14 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 dark:hover:bg-slate-800 transition-all text-xl">
            <i className="fas fa-chevron-right"></i>
          </button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, i) => (
              <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i === currentIndex ? 'bg-white w-6' : 'bg-white/40 w-2'}`}></div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default CarList;