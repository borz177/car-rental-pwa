
import React, { useState, useRef } from 'react';
import { Car, CarStatus, FuelType, Transmission, Investor, Rental, Client } from '../types';
import { CAR_CATEGORIES, FUEL_TYPES, TRANSMISSIONS } from '../constants';
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
  currentOwnerId: string;
}

const CarCard: React.FC<{
  car: Car,
  onEdit: () => void,
  onDelete: () => void,
  onIssue: () => void,
  onReserve: () => void,
  onInfo: () => void,
  activeRental?: Rental,
  clientName?: string,
  clientPhone?: string
}> = ({ car, onEdit, onDelete, onIssue, onReserve, onInfo, activeRental, clientName, clientPhone }) => {
  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  const [showMenu, setShowMenu] = useState(false);

  const nextImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImgIdx((prev) => (prev + 1) % car.images.length);
  };

  const prevImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImgIdx((prev) => (prev - 1 + car.images.length) % car.images.length);
  };

  const getDisplayStatus = () => {
    if (car.status === CarStatus.MAINTENANCE) return { label: 'В ремонте', color: 'bg-slate-800' };
    if (activeRental && !activeRental.isReservation) return { label: 'В аренде', color: 'bg-blue-600' };
    if (activeRental && activeRental.isReservation) return { label: 'Забронирован', color: 'bg-amber-500' };
    return { label: 'Свободен', color: 'bg-emerald-500' };
  };

  const status = getDisplayStatus();

  const getOverdueTime = () => {
    if (!activeRental || activeRental.isReservation) return null;
    const end = new Date(`${activeRental.endDate}T${activeRental.endTime}`);
    const now = new Date();
    if (now > end) {
      const diffMs = now.getTime() - end.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`;
    }
    return null;
  };

  const overdue = getOverdueTime();

  const openWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!clientPhone) return;
    const cleanPhone = clientPhone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  return (
    <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl transition-all group relative">
      <div className="h-56 relative overflow-hidden bg-slate-100">
        <img src={car.images[currentImgIdx] || 'https://images.unsplash.com/photo-1494905998402-395d579af36f?q=80&w=400'} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="" />

        {car.images.length > 1 && (
          <>
            <button onClick={prevImg} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center z-10">
              <i className="fas fa-chevron-left text-xs"></i>
            </button>
            <button onClick={nextImg} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center z-10">
              <i className="fas fa-chevron-right text-xs"></i>
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-10">
              {car.images.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentImgIdx ? 'bg-white w-4' : 'bg-white/40'}`}></div>
              ))}
            </div>
          </>
        )}

        <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg z-10 text-white ${status.color}`}>
          {status.label}
        </div>
        {overdue && (
          <div className="absolute top-4 left-4 px-3 py-1 bg-rose-600 text-white rounded-full text-[9px] font-black uppercase animate-pulse shadow-lg z-10">
            Просрочка: {overdue}
          </div>
        )}
      </div>

      <div className="p-6">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">{car.brand} {car.model}</h3>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{car.plate} • {car.year} г.</p>
          </div>
          <div className="text-right">
            <div className="text-blue-600 font-black text-xl leading-none">{car.pricePerDay.toLocaleString()} ₽</div>
            <div className="text-[8px] text-slate-400 uppercase font-black tracking-widest">в сутки</div>
          </div>
        </div>

        {activeRental && (
          <div className="mb-4 p-3 bg-slate-50 rounded-2xl border border-slate-100/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black text-slate-400 uppercase">{activeRental.isReservation ? 'Бронь:' : 'Арендатор:'}</span>
              <span className="text-[10px] font-bold text-slate-900 truncate ml-2">{clientName || '...'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase">До:</span>
              <span className={`text-[10px] font-black ${overdue ? 'text-rose-600' : 'text-blue-600'}`}>
                {new Date(activeRental.endDate).toLocaleDateString()} {activeRental.endTime}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {status.label === 'Свободен' ? (
            <div className="flex-1 flex gap-2">
              <button onClick={onIssue} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase transition-all hover:bg-blue-700 shadow-lg">Оформить</button>
              <button onClick={onReserve} className="flex-1 bg-amber-500 text-white py-4 rounded-2xl font-black text-[10px] uppercase transition-all hover:bg-amber-600 shadow-lg">Бронь</button>
            </div>
          ) : (
            <div className="flex-1 flex gap-2">
              <button onClick={onReserve} className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-slate-200">Бронь</button>
              {activeRental && (
                <button onClick={openWhatsApp} className="flex-1 bg-emerald-500 text-white py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-emerald-600 shadow-lg flex items-center justify-center gap-2">
                  <i className="fab fa-whatsapp text-sm"></i>
                  <span>Написать</span>
                </button>
              )}
            </div>
          )}
          <button onClick={() => setShowMenu(!showMenu)} className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-100 border border-slate-100 transition-all">
            <i className="fas fa-ellipsis-v text-xs"></i>
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)}></div>
              <div className="absolute bottom-14 right-0 w-44 bg-white rounded-2xl shadow-2xl border border-slate-50 z-30 overflow-hidden py-1">
                <button onClick={() => { onInfo(); setShowMenu(false); }} className="w-full px-5 py-3 text-left text-[10px] font-black uppercase hover:bg-slate-50 flex items-center space-x-3 text-slate-600"><i className="fas fa-info-circle text-blue-500"></i> <span>Инфо</span></button>
                <button onClick={() => { onEdit(); setShowMenu(false); }} className="w-full px-5 py-3 text-left text-[10px] font-black uppercase hover:bg-slate-50 flex items-center space-x-3 text-slate-600"><i className="fas fa-edit text-amber-500"></i> <span>Изменить</span></button>
                <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full px-5 py-3 text-left text-[10px] font-black uppercase hover:bg-rose-50 flex items-center space-x-3 text-rose-500"><i className="fas fa-trash-alt"></i> <span>Удалить</span></button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const CarList: React.FC<CarListProps> = ({ cars, investors, rentals, clients, onAdd, onUpdate, onDelete, onIssue, onReserve, onInfo, currentOwnerId }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Car | null>(null);
  const [viewingInfo, setViewingInfo] = useState<Car | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [tempImages, setTempImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getActiveRental = (carId: string) => rentals.find(r => r.carId === carId && r.status === 'ACTIVE');
  const getClientData = (clientId?: string) => clients.find(c => c.id === clientId);

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
      ownerId: editing?.ownerId || currentOwnerId,
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
      investorShare: Number(fd.get('investorShare')) || 0
    };
    if (editing) onUpdate(car); else onAdd(car);
    setIsModalOpen(false); setEditing(null); setTempImages([]);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24 md:pb-0">
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Автопарк</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {[
              { id: 'ALL', label: 'Все' },
              { id: 'AVAILABLE', label: 'Свободны' },
              { id: 'RENTED', label: 'В аренде' },
              { id: 'RESERVED', label: 'В брони' },
              { id: 'MAINTENANCE', label: 'В ремонте' },
            ].map(f => (
              <button key={f.id} onClick={() => setStatusFilter(f.id)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${statusFilter === f.id ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}`}>{f.label}</button>
            ))}
          </div>
        </div>
        <button onClick={() => { setEditing(null); setTempImages([]); setIsModalOpen(true); }} className="w-full lg:w-auto bg-blue-600 text-white px-8 py-5 rounded-[1.8rem] font-black hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
          <i className="fas fa-plus mr-2"></i> Добавить авто
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCars.map(car => {
          const rental = getActiveRental(car.id);
          const client = getClientData(rental?.clientId);
          return (
            <CarCard
              key={car.id}
              car={car}
              activeRental={rental}
              clientName={client?.name}
              clientPhone={client?.phone}
              onEdit={() => { setEditing(car); setTempImages(car.images); setIsModalOpen(true); }}
              onDelete={() => confirm('Удалить?') && onDelete(car.id)}
              onIssue={() => onIssue(car.id)}
              onReserve={() => onReserve(car.id)}
              onInfo={() => onInfo(car.id)}
            />
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-[3rem] w-full max-w-2xl p-8 md:p-12 shadow-2xl my-auto animate-scaleIn">
            <h2 className="text-3xl font-black text-slate-900 uppercase mb-8">{editing ? 'Редактировать' : 'Новое'} авто</h2>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="col-span-2 md:col-span-1 space-y-4">
                <input name="brand" defaultValue={editing?.brand} required placeholder="Марка" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" />
                <input name="model" defaultValue={editing?.model} required placeholder="Модель" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" />
                <div className="grid grid-cols-2 gap-4">
                  <input name="year" type="number" defaultValue={editing?.year} required placeholder="Год" className="p-4 bg-slate-50 rounded-2xl font-bold outline-none" />
                  <input name="plate" defaultValue={editing?.plate} required placeholder="Гос. номер" className="p-4 bg-slate-50 rounded-2xl font-bold outline-none uppercase" />
                </div>
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                   <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Данные инвестора</div>
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
              <div className="col-span-2 md:col-span-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input name="pricePerDay" type="number" defaultValue={editing?.pricePerDay} required placeholder="Цена сутки" className="p-4 bg-blue-50 rounded-2xl font-black text-blue-600 outline-none" />
                  <input name="pricePerHour" type="number" defaultValue={editing?.pricePerHour} required placeholder="Цена час" className="p-4 bg-slate-50 rounded-2xl font-bold outline-none" />
                </div>
                <input name="mileage" type="number" defaultValue={editing?.mileage} placeholder="Пробег (км)" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" />
                <select name="status" defaultValue={editing?.status || CarStatus.AVAILABLE} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none">
                  {Object.values(CarStatus).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-all" onClick={() => fileInputRef.current?.click()}>
                   <i className="fas fa-camera text-2xl"></i>
                   <span className="text-[10px] font-black uppercase mt-2">{tempImages.length > 0 ? `${tempImages.length} фото` : 'Добавить фото'}</span>
                </div>
                <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={async (e) => {
                  const files = e.target.files; if (!files) return;
                  const imgs = []; for (let i=0; i<files.length; i++) imgs.push(await BackendAPI.compressImage(files[i]));
                  setTempImages(imgs);
                }} />
              </div>
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 bg-slate-100 rounded-2xl font-black text-slate-500 uppercase text-[10px]">Отмена</button>
              <button type="submit" className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl">Сохранить</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default CarList;
