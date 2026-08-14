
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Car, CarStatus, FuelType, Transmission, Investor, Rental, Client, User, UserRole } from '../types';
import BackendAPI from '../services/api';

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
}

const OIL_CHANGE_WARNING_KM = 1000;

const CarCard: React.FC<{
  car: Car,
  activeRental?: Rental,
  clientPhone?: string;
  onEdit: () => void,
  onDelete: () => void,
  onIssue: () => void,
  onReserve: () => void,
  onInfo: () => void,
  onOilChange: () => void,
  onViewImages: (images: string[]) => void,
  onShowInfo: () => void,
  onComplete: (rental: Rental) => void,
  currentUser: User;
}> = ({ car, activeRental, clientPhone, onEdit, onDelete, onIssue, onReserve, onInfo, onOilChange, onViewImages, onShowInfo, onComplete, currentUser }) => {
  const [showMenu, setShowMenu] = useState(false);

  const permissions = currentUser.permissions;
  const isStaff = currentUser.role === UserRole.STAFF;
  const canEdit = !isStaff || permissions?.canEdit;
  const canDelete = !isStaff || permissions?.canDelete;
  const canCreateBooking = !isStaff || permissions?.canCreateBooking;
  const showDeleteButton = (currentUser.settings?.showDeleteCarButton ?? true) && canDelete;

  const getDisplayStatus = () => {
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
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 transition-all group hover:shadow-md relative">
      <div className="h-40 md:h-40 relative overflow-hidden bg-slate-100 cursor-pointer" onClick={handleImageClick}>
        <img src={car.images[0] || 'https://images.unsplash.com/photo-1494905998402-395d579af36f?q=80&w=400'} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="" />

        <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[9px] font-semibold uppercase tracking-wide shadow-lg z-10 text-white ${status.color}`}>
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
          <div>
            <h3 className="text-base md:text-lg font-semibold text-slate-900 tracking-tight">{car.brand} {car.model}</h3>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{car.plate} • {car.year} г.</p>
          </div>
          <div className="text-right">
            <div className="text-blue-600 font-bold text-base md:text-lg leading-none">{car.pricePerDay.toLocaleString()} ₽</div>
            <div className="text-[8px] text-slate-400 uppercase font-semibold tracking-wide">в сутки</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status.label === 'Свободен' ? (
            <div className="flex-1 flex gap-2">
              <button onClick={onIssue} disabled={!canCreateBooking} className="flex-1 bg-blue-600 text-white py-2.5 rounded-2xl font-semibold text-[10px] uppercase transition-all hover:bg-blue-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">Оформить</button>
              <button onClick={onReserve} disabled={!canCreateBooking} className="flex-1 bg-amber-500 text-white py-2.5 rounded-2xl font-semibold text-[10px] uppercase transition-all hover:bg-amber-600 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">Бронь</button>
            </div>
          ) : (
            <div className="flex-1 flex gap-2">
              <button onClick={handleWhatsAppClick} className="flex-1 bg-emerald-500 text-white py-2.5 rounded-2xl font-semibold text-[10px] uppercase transition-all hover:bg-emerald-600 shadow-lg flex items-center justify-center gap-2">
                <i className="fab fa-whatsapp"></i><span>Написать</span>
              </button>
              <button onClick={onReserve} disabled={!canCreateBooking} className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-2xl font-semibold text-[10px] uppercase hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">Бронь</button>
            </div>
          )}
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-100 border border-slate-100 transition-all">
              <i className="fas fa-ellipsis-v text-xs"></i>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)}></div>
                <div className="absolute bottom-14 right-0 w-48 bg-white rounded-2xl shadow-md border border-slate-50 z-30 py-1 animate-scaleIn">
                  <button onClick={() => { onShowInfo(); setShowMenu(false); }} className="w-full px-5 py-3 text-left text-xs font-bold hover:bg-slate-50 flex items-center space-x-3 text-slate-600"><i className="fas fa-info-circle text-blue-500 w-4"></i><span>Инфо</span></button>
                  <button onClick={() => { onInfo(); setShowMenu(false); }} className="w-full px-5 py-3 text-left text-xs font-bold hover:bg-slate-50 flex items-center space-x-3 text-slate-600"><i className="fas fa-chart-line text-indigo-500 w-4"></i><span>Отчет</span></button>
                  {canEdit && <button onClick={() => { onEdit(); setShowMenu(false); }} className="w-full px-5 py-3 text-left text-xs font-bold hover:bg-slate-50 flex items-center space-x-3 text-amber-500"><i className="fas fa-edit w-4"></i><span>Изменить</span></button>}
                  {canEdit && <button onClick={() => { onOilChange(); setShowMenu(false); }} className="w-full px-5 py-3 text-left text-xs font-bold hover:bg-slate-50 flex items-center space-x-3 text-emerald-500"><i className="fas fa-oil-can w-4"></i><span>Заменить масло</span></button>}
                  {activeRental && !activeRental.isReservation && canCreateBooking && (
                    <button onClick={() => { onComplete(activeRental); setShowMenu(false); }} className="w-full px-5 py-3 text-left text-xs font-bold hover:bg-blue-50 flex items-center space-x-3 text-blue-600"><i className="fas fa-check-circle w-4"></i><span>Завершить</span></button>
                  )}
                  {showDeleteButton && <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full px-5 py-3 text-left text-xs font-bold hover:bg-rose-50 text-rose-500 flex items-center space-x-3"><i className="fas fa-trash-alt w-4"></i><span>Удалить</span></button>}
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
  cars, investors, rentals, clients, onAdd, onUpdate, onDelete, onIssue, onReserve, onInfo, onComplete, currentUser, planLimit = 9999
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Car | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [tempImages, setTempImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewingImages, setViewingImages] = useState<string[] | null>(null);
  const [confirmingOilChange, setConfirmingOilChange] = useState<Car | null>(null);
  const [infoModalData, setInfoModalData] = useState<{car: Car, rental?: Rental, client?: Client} | null>(null);

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

  const filteredCars = cars.filter(car => {
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
      lastOilChangeMileage: Number(fd.get('lastOilChangeMileage')) || undefined,
      oilChangeInterval: Number(fd.get('oilChangeInterval')) || undefined
    };
    if (editing) onUpdate(car); else onAdd(car);
    setIsModalOpen(false); setEditing(null); setTempImages([]);
  };

  const handleConfirmOilChange = () => {
    if (!confirmingOilChange) return;
    onUpdate({ ...confirmingOilChange, lastOilChangeMileage: confirmingOilChange.mileage });
    setConfirmingOilChange(null);
  };

  return (
    <div className="space-y-4 animate-fadeIn pb-24 md:pb-0">
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
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
                  className={`px-4 py-2 rounded-xl text-[9px] font-semibold uppercase transition-all flex items-center gap-2 ${statusFilter === f.id ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}`}
                >
                  <span>{f.label}</span>
                  <span className={`px-2 py-0.5 text-[10px] rounded-md ${statusFilter === f.id ? 'bg-white/20' : 'bg-slate-200'}`}>{f.count}</span>
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
              currentUser={currentUser}
              onEdit={() => { setEditing(car); setTempImages(car.images); setIsModalOpen(true); }}
              onDelete={() => confirm('Удалить?') && onDelete(car.id)}
              onIssue={() => onIssue(car.id)}
              onReserve={() => onReserve(car.id)}
              onInfo={() => onInfo(car.id)}
              onOilChange={() => setConfirmingOilChange(car)}
              onViewImages={setViewingImages}
              onShowInfo={() => setInfoModalData({ car, rental, client })}
              onComplete={onComplete}
            />
          );
        })}
      </div>

      {viewingImages && <ImageViewerModal images={viewingImages} onClose={() => setViewingImages(null)} />}

      {infoModalData && <CarInfoModal data={infoModalData} onClose={() => setInfoModalData(null)} />}

      {confirmingOilChange && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm text-center animate-scaleIn">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-500 mx-auto rounded-2xl flex items-center justify-center text-2xl mb-4"><i className="fas fa-oil-can"></i></div>
            <h3 className="font-semibold text-lg mb-2">Зафиксировать замену масла?</h3>
            <p className="text-sm text-slate-500 mb-6">Пробег последней замены будет обновлен на текущий: <b className="text-slate-800">{confirmingOilChange.mileage.toLocaleString()} км</b>.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmingOilChange(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">Отмена</button>
              <button onClick={handleConfirmOilChange} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">Подтвердить</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl w-full max-w-2xl p-5 md:p-8 shadow-md my-auto animate-scaleIn">
            <h2 className="text-3xl font-semibold text-slate-900 uppercase mb-8">{editing ? 'Редактировать' : 'Новое'} авто</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="space-y-4">
                  <input name="brand" defaultValue={editing?.brand} required placeholder="Марка" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" />
                  <input name="model" defaultValue={editing?.model} required placeholder="Модель" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" />
                  <div className="grid grid-cols-2 gap-4">
                    <input name="year" type="number" defaultValue={editing?.year} required placeholder="Год" className="p-4 bg-slate-50 rounded-2xl font-bold outline-none" />
                    <input name="plate" defaultValue={editing?.plate} required placeholder="Гос. номер" className="p-4 bg-slate-50 rounded-2xl font-bold outline-none uppercase" />
                  </div>
                   <input name="mileage" type="number" defaultValue={editing?.mileage} placeholder="Пробег (км)" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" />
                  <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                     <div className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide ml-1">Данные инвестора</div>
                     <select name="investorId" defaultValue={editing?.investorId || ''} className="w-full p-3 bg-white rounded-xl font-bold border border-indigo-100 outline-none">
                        <option value="">Собственный автопарк</option>
                        {investors.map(inv => <option key={inv.id} value={inv.id}>{inv.name}</option>)}
                     </select>
                     <div className="relative">
                        <input name="investorShare" type="number" defaultValue={editing?.investorShare || 0} placeholder="Доля инвестора %" className="w-full p-3 bg-white rounded-xl font-bold border border-indigo-100 outline-none" />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300 font-bold">%</span>
                     </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input name="pricePerDay" type="number" defaultValue={editing?.pricePerDay} required placeholder="Цена сутки" className="p-4 bg-blue-50 rounded-2xl font-bold text-blue-600 outline-none" />
                    <input name="pricePerHour" type="number" defaultValue={editing?.pricePerHour} required placeholder="Цена час" className="p-4 bg-slate-50 rounded-2xl font-bold outline-none" />
                  </div>
                  <select name="status" defaultValue={editing?.status || CarStatus.AVAILABLE} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none">
                    {Object.values(CarStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-3">
                     <div className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide ml-1">Замена масла</div>
                     <input name="lastOilChangeMileage" type="number" defaultValue={editing?.lastOilChangeMileage} placeholder="Пробег последней замены" className="w-full p-3 bg-white rounded-xl font-bold border border-amber-100 outline-none" />
                     <input name="oilChangeInterval" type="number" defaultValue={editing?.oilChangeInterval || 10000} placeholder="Интервал замены (км)" className="w-full p-3 bg-white rounded-xl font-bold border border-amber-100 outline-none" />
                  </div>
                  <div className="aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-all" onClick={() => fileInputRef.current?.click()}>
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
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 bg-slate-100 rounded-2xl font-semibold text-slate-500 uppercase text-[10px]">Отмена</button>
              <button type="submit" className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-semibold uppercase text-[10px] shadow-md">Сохранить</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const CarInfoModal: React.FC<{data: {car: Car, rental?: Rental, client?: Client}, onClose: () => void}> = ({ data, onClose }) => {
  const { car, rental, client } = data;

  const overdueInfo = useMemo(() => {
    if (!rental || rental.isReservation) return null;

    const getMoscowCurrentTime = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
    const moscowNow = getMoscowCurrentTime();

    const rentEndDate = typeof rental.endDate === 'string' ? rental.endDate.split('T')[0] : rental.endDate;
    const rentEnd = new Date(`${rentEndDate}T${rental.endTime}`);

    const diff = moscowNow.getTime() - rentEnd.getTime();
    if (diff <= 0) return null;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    let overdueText = '';
    if (days > 0) overdueText = `${days}д ${hours}ч`;
    else if (hours > 0) overdueText = `${hours}ч ${minutes}м`;
    else overdueText = `${minutes}м`;

    const overdueHours = Math.ceil(diff / (1000 * 60 * 60));
    const pricePerHour = car.pricePerHour || Math.round(car.pricePerDay / 24);
    const overdueAmount = overdueHours * pricePerHour;

    return { text: overdueText, amount: overdueAmount };
  }, [rental, car]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-md animate-scaleIn relative">
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 transition-all">
          <i className="fas fa-times"></i>
        </button>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">{car.brand} {car.model}</h2>
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wide">{car.plate}</p>

        {rental ? (
          <div className="mt-8 space-y-4">
            <div className={`p-6 rounded-xl border-2 ${rental.isReservation ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>
              <div className={`text-[10px] font-semibold uppercase tracking-wide mb-2 ${rental.isReservation ? 'text-amber-600' : 'text-blue-600'}`}>
                {rental.isReservation ? 'Забронировано' : 'В аренде'}
              </div>
              <div className="text-xl font-semibold text-slate-900">{client?.name || 'Клиент не найден'}</div>
              <div className="text-sm font-medium text-slate-400">{client?.phone}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl">
                 <div className="text-[9px] font-bold text-slate-400 uppercase">Начало</div>
                 <div className="font-bold text-slate-800">{new Date(rental.startDate).toLocaleDateString()} {rental.startTime}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl">
                 <div className="text-[9px] font-bold text-slate-400 uppercase">Окончание</div>
                 <div className="font-bold text-slate-800">{new Date(rental.endDate).toLocaleDateString()} {rental.endTime}</div>
              </div>
            </div>
            {overdueInfo && (
              <div className="p-5 bg-rose-50 border-2 border-rose-100 rounded-xl animate-pulse">
                <div className="flex justify-between items-center">
                  <div>
                     <div className="text-xs font-semibold text-rose-600 uppercase">Просрочка</div>
                     <div className="text-lg font-bold text-rose-800">{overdueInfo.text}</div>
                  </div>
                  <div className="text-right">
                     <div className="text-xs font-semibold text-rose-600 uppercase">Долг</div>
                     <div className="text-lg font-bold text-rose-800">{overdueInfo.amount.toLocaleString()} ₽</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-8 p-8 bg-emerald-50 border-2 border-emerald-100 rounded-xl text-center">
            <i className="fas fa-check-circle text-3xl text-emerald-500 mb-3"></i>
            <p className="font-semibold text-lg text-emerald-800">Автомобиль свободен</p>
          </div>
        )}
        <button onClick={onClose} className="w-full mt-8 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold">Закрыть</button>
      </div>
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

      <button onClick={onClose} className="absolute top-5 right-5 w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all text-lg">
        <i className="fas fa-times"></i>
      </button>

      {images.length > 1 && (
        <>
          <button onClick={prevImage} className="absolute left-5 top-1/2 -translate-y-1/2 w-14 h-14 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all text-xl">
            <i className="fas fa-chevron-left"></i>
          </button>
          <button onClick={nextImage} className="absolute right-5 top-1/2 -translate-y-1/2 w-14 h-14 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all text-xl">
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