
import React from 'react';
import { BookingRequest, RequestStatus, Car } from '../backend/src/types.ts';

interface BookingRequestsProps {
  requests: BookingRequest[];
  cars: Car[];
  onAction: (id: string, action: 'APPROVE' | 'REJECT') => void;
}

const BookingRequests: React.FC<BookingRequestsProps> = ({ requests, cars, onAction }) => {
  const getCar = (id: string) => cars.find(c => c.id === id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Заявки на бронирование</h2>
        <span className="bg-slate-100 px-4 py-1 rounded-full text-sm font-bold text-slate-500">
          Всего: {requests.length}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {requests.length === 0 ? (
          <div className="bg-white p-20 rounded-[2rem] text-center border-2 border-dashed border-slate-100">
            <i className="fas fa-inbox text-5xl text-slate-200 mb-4"></i>
            <p className="text-slate-400 font-medium text-lg">Новых заявок пока нет</p>
          </div>
        ) : (
          requests.map(req => {
            const car = getCar(req.carId);
            return (
              <div key={req.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-md transition-all">
                <div className="flex items-center space-x-6 w-full md:w-auto">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-inner">
                    <img src={car?.images[0]} className="w-full h-full object-cover" alt="car" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{car?.brand} {car?.model}</h3>
                    <p className="text-sm text-slate-400 font-medium">Клиент: <span className="text-slate-900 font-bold">{req.clientName}</span></p>
                  </div>
                </div>

                <div className="flex-1 flex flex-col items-center md:items-start space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Период аренды</div>
                  <div className="flex items-center space-x-3 text-sm font-bold text-slate-700 bg-slate-50 px-4 py-2 rounded-xl">
                    <span>{new Date(req.startDate).toLocaleDateString()}</span>
                    <i className="fas fa-arrow-right text-[10px] text-blue-400"></i>
                    <span>{new Date(req.endDate).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 w-full md:w-auto">
                  <button 
                    onClick={() => onAction(req.id, 'REJECT')}
                    className="flex-1 md:flex-none px-6 py-3 rounded-xl border-2 border-slate-100 text-slate-400 font-bold hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-all"
                  >
                    Отклонить
                  </button>
                  <button 
                    onClick={() => onAction(req.id, 'APPROVE')}
                    className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all"
                  >
                    Подтвердить
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BookingRequests;
