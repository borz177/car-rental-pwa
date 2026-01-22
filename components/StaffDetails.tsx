import React from 'react';
import { Staff } from '../types.ts';

interface StaffDetailsProps {
  member: Staff;
  onBack: () => void;
}

const StaffDetails: React.FC<StaffDetailsProps> = ({ member, onBack }) => {
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
                <span className="text-slate-400 text-sm font-medium">@{member.login}</span>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-8 py-5 rounded-[2rem] border border-white/10 text-center min-w-[200px] relative z-10">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">В команде с</div>
            <div className="text-xl font-black text-white">
              {new Date(member.createdAt).toLocaleDateString()}
            </div>
          </div>
          <i className="fas fa-user-tie absolute -right-10 -bottom-10 text-[12rem] text-white/5 rotate-12"></i>
        </div>

        <div className="p-8 md:p-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Персональные данные</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoTile label="Логин" value={member.login} icon="fa-at" />
              <InfoTile label="Роль" value={member.role} icon="fa-shield-alt" />
              <InfoTile label="ID Сотрудника" value={member.id} icon="fa-fingerprint" />
              <InfoTile label="Дата регистрации" value={new Date(member.createdAt).toLocaleDateString()} icon="fa-calendar-check" />
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Статистика</h3>
            <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-2xl mb-4">
                <i className="fas fa-tasks"></i>
              </div>
              <div className="text-3xl font-black text-slate-900">0</div>
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Оформлено сделок</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoTile = ({ label, value, icon }: { label: string, value: string, icon: string }) => (
  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center space-x-4">
    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm">
      <i className={`fas ${icon}`}></i>
    </div>
    <div>
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</div>
      <div className="text-sm font-bold text-slate-800">{value}</div>
    </div>
  </div>
);

export default StaffDetails;