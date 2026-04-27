
import React from 'react';
import { Staff } from '../types';

interface StaffDetailsProps {
  member: Staff;
  onBack: () => void;
}

const StaffDetails: React.FC<StaffDetailsProps> = ({ member, onBack }) => {
  const perms = member.permissions;

  return (
    <div className="space-y-8 animate-fadeIn pb-24 md:pb-0">
      <button onClick={onBack} className="flex items-center space-x-2 text-slate-500 font-bold hover:text-blue-600 transition-all">
        <i className="fas fa-arrow-left"></i> <span>Назад к списку</span>
      </button>

      <div className="bg-white rounded-[3rem] shadow-xl overflow-hidden border border-slate-100">
        <div className="p-8 md:p-12 bg-slate-900 text-white flex flex-col md:flex-row justify-between items-center gap-6 relative">
          <div className="flex items-center space-x-6 relative z-10">
            <div className="w-24 h-24 rounded-[2.5rem] bg-blue-600 flex items-center justify-center text-white text-4xl font-black shadow-2xl">
              {member.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-3xl font-black">{member.name}</h2>
              <div className="flex items-center space-x-3 mt-2">
                <span className="px-3 py-1 bg-blue-500 rounded-full text-[10px] font-black uppercase tracking-widest">{member.role}</span>
                {/* Fix: Display login for staff as email is not available */}
                <span className="text-slate-400 text-sm font-medium">{member.login}</span>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-8 py-5 rounded-[2rem] border border-white/10 text-center min-w-[200px] relative z-10">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">В команде с</div>
            <div className="text-xl font-black text-white">
              {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : 'Н/Д'}
            </div>
          </div>
          <i className="fas fa-user-tie absolute -right-10 -bottom-10 text-[12rem] text-white/5 rotate-12"></i>
        </div>

        <div className="p-8 md:p-12">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-6">Права доступа</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <PermissionCard label="Полный доступ" enabled={perms?.fullAccess} icon="fa-star" />
            <PermissionCard label="Оформление сделок" enabled={perms?.fullAccess || perms?.canCreateBooking} icon="fa-file-signature" />
            <PermissionCard label="Добавление авто" enabled={perms?.fullAccess || perms?.canAddCar} icon="fa-car" />
            <PermissionCard label="Редактирование" enabled={perms?.fullAccess || perms?.canEdit} icon="fa-edit" />
            <PermissionCard label="Удаление" enabled={perms?.fullAccess || perms?.canDelete} icon="fa-trash-alt" />
            <PermissionCard label="Просмотр документов" enabled={perms?.fullAccess || perms?.canViewDocs} icon="fa-wallet" />
          </div>
        </div>
      </div>
    </div>
  );
};

const PermissionCard = ({ label, enabled, icon }: {label: string, enabled?: boolean, icon: string}) => (
  <div className={`p-6 rounded-2xl border-2 flex items-center space-x-4 ${enabled ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200 opacity-60'}`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${enabled ? 'bg-white text-emerald-500' : 'bg-white text-rose-400'}`}>
      <i className={`fas ${icon}`}></i>
    </div>
    <div>
      <div className="font-bold text-sm text-slate-800">{label}</div>
      <div className={`text-xs font-black uppercase tracking-widest ${enabled ? 'text-emerald-600' : 'text-rose-500'}`}>{enabled ? 'Включено' : 'Отключено'}</div>
    </div>
  </div>
);

export default StaffDetails;