
import React, { useState, useRef } from 'react';
import { Car, CarStatus, FuelType, Transmission, Investor } from '../types.ts';
import { CAR_CATEGORIES, FUEL_TYPES, TRANSMISSIONS } from '../constants';
import BackendAPI from '../services/api';

interface CarListProps {
  cars: Car[];
  investors: Investor[];
  onAdd: (c: Car) => void;
  onUpdate: (c: Car) => void;
  onDelete: (id: string) => void;
  currentOwnerId: string;
}

const CarList: React.FC<CarListProps> = ({ cars, investors, onAdd, onUpdate, onDelete, currentOwnerId }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Car | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [tempImages, setTempImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const compressedImages: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const base64 = await BackendAPI.compressImage(files[i]);
      compressedImages.push(base64);
    }

    setTempImages(prev => [...prev, ...compressedImages]);
    setIsUploading(false);
  };

  const removeImage = (index: number) => {
    setTempImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    const car: Car = {
      id: editing?.id || Date.now().toString(),
      ownerId: editing?.ownerId || currentOwnerId,
      brand: fd.get('brand') as string,
      model: fd.get('model') as string,
      year: Number(fd.get('year')),
      plate: fd.get('plate') as string,
      status: (fd.get('status') as CarStatus),
      pricePerDay: Number(fd.get('pricePerDay')),
      pricePerHour: Number(fd.get('pricePerHour')),
      category: fd.get('category') as string,
      mileage: Number(fd.get('mileage')),
      fuel: fd.get('fuel') as FuelType,
      transmission: fd.get('transmission') as Transmission,
      images: tempImages.length > 0 ? tempImages : ['https://images.unsplash.com/photo-1494905998402-395d579af36f?q=80&w=400'],
      investorId: fd.get('investorId') as string || undefined,
      investorShare: Number(fd.get('investorShare')) || 0
    };
    
    editing ? onUpdate(car) : onAdd(car);
    setIsModalOpen(false);
    setEditing(null);
    setTempImages([]);
  };

  const openModal = (car: Car | null) => {
    setEditing(car);
    setTempImages(car?.images || []);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Автопарк</h2>
        <button 
          onClick={() => openModal(null)} 
          className="w-full md:w-auto bg-blue-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center space-x-2"
        >
          <i className="fas fa-plus"></i>
          <span>Добавить авто</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cars.map(car => (
          <div key={car.id} className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
            <div className="h-52 relative overflow-hidden">
              <img src={car.images[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={car.model} />
              <div className={`absolute top-4 right-4 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg ${
                car.status === 'Свободен' ? 'bg-emerald-500 text-white' : 
                car.status === 'В аренде' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'
              }`}>
                {car.status}
              </div>
              <div className="absolute top-4 left-4 flex gap-2">
                {car.investorId && (
                  <div className="bg-indigo-600/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg">
                    <i className="fas fa-handshake mr-1"></i> Инвестор
                  </div>
                )}
              </div>
              {car.images.length > 1 && (
                <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-md px-2 py-1 rounded text-white text-[10px] font-bold">
                  <i className="fas fa-camera mr-1"></i> {car.images.length}
                </div>
              )}
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">{car.brand} {car.model}</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{car.plate} • {car.year} г.в.</p>
                </div>
                <div className="text-right">
                  <div className="text-blue-600 font-black text-xl">{car.pricePerDay.toLocaleString()} ₽</div>
                  <div className="text-[10px] text-slate-400 uppercase font-black">сут.</div>
                </div>
              </div>

              <div className="flex space-x-2">
                <button onClick={() => openModal(car)} className="flex-1 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-600 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all">
                  Редактировать
                </button>
                <button onClick={() => confirm('Удалить автомобиль?') && onDelete(car.id)} className="w-12 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-xl transition-all">
                  <i className="fas fa-trash-alt"></i>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-[3rem] w-full max-w-2xl p-8 md:p-12 shadow-2xl my-auto animate-scaleIn">
            <div className="flex justify-between items-center mb-8">
               <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{editing ? 'Изменить' : 'Новое'} авто</h2>
               <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-slate-900"><i className="fas fa-times text-xl"></i></button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              {/* Photo Upload Section */}
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block mb-3">Фотографии</label>
                <div className="grid grid-cols-4 gap-3">
                  {tempImages.map((img, idx) => (
                    <div key={idx} className="aspect-video relative rounded-xl overflow-hidden border border-slate-100 group">
                      <img src={img} className="w-full h-full object-cover" alt="car preview" />
                      <button 
                        type="button" 
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 w-6 h-6 bg-rose-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ))}
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-video border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all bg-slate-50"
                  >
                    {isUploading ? <i className="fas fa-circle-notch animate-spin text-xl"></i> : <i className="fas fa-plus text-xl mb-1"></i>}
                    <span className="text-[8px] font-black uppercase">{isUploading ? 'Сжатие...' : 'Добавить'}</span>
                  </button>
                </div>
                <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Марка</label>
                <input name="brand" defaultValue={editing?.brand} required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Модель</label>
                <input name="model" defaultValue={editing?.model} required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Год</label>
                <input name="year" type="number" defaultValue={editing?.year} required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Гос. номер</label>
                <input name="plate" defaultValue={editing?.plate} required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              </div>

              {/* Investor Selection Section */}
              <div className="col-span-2 grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-2 mb-1 block">Инвестор</label>
                  <select name="investorId" defaultValue={editing?.investorId || ''} className="w-full p-4 bg-indigo-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 appearance-none text-indigo-900">
                    <option value="">Без инвестора (собственный)</option>
                    {investors.map(inv => <option key={inv.id} value={inv.id}>{inv.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-2 mb-1 block">Доля инвестора (%)</label>
                  <input name="investorShare" type="number" min="0" max="100" defaultValue={editing?.investorShare || 0} className="w-full p-4 bg-indigo-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500" placeholder="50" />
                </div>
              </div>
              
              <div className="col-span-2 grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Сутки (₽)</label>
                  <input name="pricePerDay" type="number" defaultValue={editing?.pricePerDay} required className="w-full p-4 bg-slate-50 rounded-2xl font-black text-blue-600 outline-none border-2 border-transparent focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Час (₽)</label>
                  <input name="pricePerHour" type="number" defaultValue={editing?.pricePerHour} required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
                </div>
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Статус</label>
                <select name="status" defaultValue={editing?.status || CarStatus.AVAILABLE} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 appearance-none">
                  {Object.values(CarStatus).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Категория</label>
                <select name="category" defaultValue={editing?.category || 'Эконом'} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 appearance-none">
                  {CAR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 bg-slate-100 rounded-2xl font-black text-slate-500 uppercase tracking-widest text-xs">Отмена</button>
              <button type="submit" className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 active:scale-95 transition-all">Сохранить</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default CarList;
