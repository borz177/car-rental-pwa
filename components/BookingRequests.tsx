
import React, { useState, useMemo } from 'react';
import { BookingRequest, RequestStatus, Car } from '../types';

interface BookingRequestsProps {
  requests: BookingRequest[];
  cars: Car[];
  onAction?: (id: string, action: 'APPROVE' | 'REJECT') => void;
  isReadOnly?: boolean;
}

const BookingRequests: React.FC<BookingRequestsProps> = ({ requests, cars, onAction, isReadOnly = false }) => {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'REJECTED'>('PENDING');

  const getCar = (id: string) => cars.find(c => c.id === id);

  const getCleanPhone = (phone: string) => {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('8') && clean.length === 11) clean = '7' + clean.slice(1);
    return clean;
  };

  const getStatusLabel = (status: RequestStatus) => {
    switch (status) {
      case RequestStatus.APPROVED: return <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-lg">Одобрено</span>;
      case RequestStatus.REJECTED: return <span className="text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-500/10 px-3 py-1 rounded-lg">Отклонено</span>;
      default: return <span className="text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-500/10 px-3 py-1 rounded-lg">На рассмотрении</span>;
    }
  };

  // Filter logic
  const filteredRequests = useMemo(() => {
    if (isReadOnly) {
      // Client sees everything sorted by date
      return [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // Admin logic:
    // 1. Approved are hidden (moved to Bookings)
    // 2. Tab filtering for Pending vs Rejected
    return requests.filter(req => {
      if (req.status === RequestStatus.APPROVED) return false;
      return req.status === (activeTab === 'PENDING' ? RequestStatus.PENDING : RequestStatus.REJECTED);
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, isReadOnly, activeTab]);

  const pendingCount = requests.filter(r => r.status === RequestStatus.PENDING).length;
  const rejectedCount = requests.filter(r => r.status === RequestStatus.REJECTED).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center px-2 gap-4">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{isReadOnly ? 'Мои бронирования' : 'Заявки на бронирование'}</h2>

        {/* Admin Toggle Tabs */}
        {!isReadOnly && (
          <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('PENDING')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'PENDING' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
              }`}
            >
              Новые
              {pendingCount > 0 && <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
            </button>
            <button
              onClick={() => setActiveTab('REJECTED')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'REJECTED' ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
              }`}
            >
              Отклоненные
              {rejectedCount > 0 && <span className="bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 text-[9px] px-1.5 py-0.5 rounded-full">{rejectedCount}</span>}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredRequests.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 p-20 rounded-2xl text-center border-2 border-dashed border-slate-100 dark:border-slate-700">
            <i className={`fas ${activeTab === 'REJECTED' && !isReadOnly ? 'fa-ban' : 'fa-inbox'} text-5xl text-slate-200 dark:text-slate-700 mb-4`}></i>
            <p className="text-slate-400 dark:text-slate-500 font-medium text-lg">
              {isReadOnly ? 'Список пуст' : (activeTab === 'PENDING' ? 'Новых заявок нет' : 'Нет отклоненных заявок')}
            </p>
          </div>
        ) : (
          filteredRequests.map(req => {
            const car = getCar(req.carId);
            const cleanPhone = getCleanPhone(req.clientPhone || '');

            return (
              <div key={req.id} className={`bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col lg:flex-row items-center justify-between gap-4 hover:shadow-md transition-all ${req.status === RequestStatus.REJECTED ? 'opacity-70 grayscale-[0.5] hover:grayscale-0 hover:opacity-100' : ''}`}>
                {/* Car & Client Info */}
                <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-6 w-full lg:w-auto">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-inner flex-shrink-0 bg-slate-100 dark:bg-slate-700">
                    {car?.images?.[0] ? (
                      <img src={car.images[0]} className="w-full h-full object-cover" alt="car" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600"><i className="fas fa-car"></i></div>
                    )}
                  </div>
                  <div className="text-center md:text-left space-y-2">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{car?.brand || 'Авто удалено'} {car?.model}</h3>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide">{car?.plate}</div>
                    </div>
                    {!isReadOnly && (
                      <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                          <div className="font-bold text-slate-900 dark:text-white">{req.clientName || 'Гость'}</div>
                          <div className="flex items-center justify-center md:justify-start space-x-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                              <span><i className="fas fa-phone-alt mr-1"></i>{req.clientPhone}</span>
                              {req.clientDob && (
                                <>
                                  <span>•</span>
                                  <span>ДР: {new Date(req.clientDob).toLocaleDateString()}</span>
                                </>
                              )}
                          </div>
                      </div>
                    )}
                    {/* Show status label if Client or if Rejected (in Rejected tab) */}
                    {(isReadOnly || req.status === RequestStatus.REJECTED) && (
                       <div className="mt-2">
                         {getStatusLabel(req.status)}
                       </div>
                    )}
                  </div>
                </div>

                {/* Dates */}
                <div className="flex flex-col items-center space-y-2">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold tracking-wide">Период аренды</div>
                  <div className="flex items-center space-x-3 text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-700 px-4 py-2 rounded-xl">
                    <span>{new Date(req.startDate).toLocaleDateString()} {req.startTime}</span>
                    <i className="fas fa-arrow-right text-[10px] text-blue-400"></i>
                    <span>{new Date(req.endDate).toLocaleDateString()} {req.endTime}</span>
                  </div>
                </div>

                {/* Actions (Only for PENDING status in Admin Mode) */}
                {!isReadOnly && onAction && req.status === RequestStatus.PENDING && (
                  <div className="flex flex-col space-y-3 w-full lg:w-auto min-w-[200px]">
                    <div className="flex space-x-2">
                      <a href={`tel:${req.clientPhone}`} className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-center font-bold transition-all">
                          <i className="fas fa-phone"></i>
                      </a>
                      <a href={`https://wa.me/${cleanPhone}`} target="_blank" rel="noreferrer" className="flex-1 py-2 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 text-emerald-600 dark:text-emerald-400 rounded-xl text-center font-bold transition-all">
                          <i className="fab fa-whatsapp"></i>
                      </a>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                          onClick={() => onAction(req.id, 'REJECT')}
                          className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 font-bold hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-all text-xs uppercase tracking-wider"
                      >
                          Отклонить
                      </button>
                      <button
                          onClick={() => onAction(req.id, 'APPROVE')}
                          className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg transition-all text-xs uppercase tracking-wider"
                      >
                          Принять
                      </button>
                    </div>
                  </div>
                )}

                {/* Delete Button for Rejected (Admin Cleanup) */}
                {!isReadOnly && onAction && req.status === RequestStatus.REJECTED && (
                   <button
                      onClick={() => { if(confirm('Удалить заявку из истории?')) onAction(req.id, undefined as any); }} // Hack: passing undefined/delete action logic if handled
                      className="px-4 py-2 text-slate-300 dark:text-slate-600 hover:text-rose-500 transition-colors"
                      title="Удалить из истории"
                   >
                      <i className="fas fa-trash-alt"></i>
                   </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BookingRequests;
