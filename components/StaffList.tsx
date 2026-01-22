
import React, { useState } from 'react';
import { Staff, UserRole } from '../types.ts';

interface StaffListProps {
  staff: Staff[];
  onAdd: (s: Staff) => void;
  onUpdate: (s: Staff) => void;
  onDelete: (id: string) => void;
  // Fix: Add onSelectStaff to interface to resolve TS error in App.tsx
  onSelectStaff: (id: string) => void;
}

const StaffList: React.FC<StaffListProps> = ({ staff, onAdd, onUpdate, onDelete, onSelectStaff }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Staff | null>(null);
  const [viewingMember, setViewingMember] = useState<Staff | null>(null);
  const [showActions, setShowActions] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: Staff = {
      id: editingMember?.id || `staff-${Date.now()}`,
      ownerId: editingMember?.ownerId || '',
      name: fd.get('name') as string,
      login: fd.get('login') as string,
      password: fd.get('password') as string || editingMember?.password || '',
      role: (fd.get('role') as UserRole) || UserRole.STAFF,
      createdAt: editingMember?.createdAt || new Date().toISOString()
    };
    
    if (editingMember) onUpdate(data);
    else onAdd(data);
    
    setIsModalOpen(false);
    setEditingMember(null);
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-24 md:pb-0">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-3xl font-black text-slate-900">Команда</h2>
        <button 
          onClick={() => { setEditingMember(null); setIsModalOpen(true); }} 
          className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all text-sm"
        >
          <i className="fas fa-user-plus mr-2"></i> Добавить
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-2">
        {staff.map(member => (
          <div key={member.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all relative group">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-slate-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner">
                  {member.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">{member.name}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{member.login}</span>
                    <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{member.role}</span>
                  </div>
                </div>
              </div>

              <div className="relative">
                <button 
                  onClick={() => setShowActions(showActions === member.id ? null : member.id)}
                  className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
                >
                  <i className="fas fa-ellipsis-v"></i>
                </button>
                {showActions === member.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowActions(null)}></div>
                    <div className="absolute right-0 top-12 w-48 bg-white rounded-2xl shadow-2xl border border-slate-50 z-50 overflow-hidden animate-scaleIn">
                      {/* Fix: Call onSelectStaff for global navigation to detailed view instead of local modal */}
                      <button onClick={() => { onSelectStaff(member.id); setShowActions(null); }} className="w-full px-5 py-3 text-left text-sm font-bold hover:bg-slate-50 flex items-center space-x-3 text-slate-600 border-b border-slate-50">
                        <i className="fas fa-id-card text-blue-500"></i> <span>Инфо</span>
                      </button>
                      <button onClick={() => { setEditingMember(member); setIsModalOpen(true); setShowActions(null); }} className="w-full px-5 py-3 text-left text-sm font-bold hover:bg-slate-50 flex items-center space-x-3 text-slate-600 border-b border-slate-50">
                        <i className="fas fa-edit text-amber-500"></i> <span>Изменить</span>
                      </button>
                      <button onClick={() => { if(window.confirm('Удалить сотрудника?')) onDelete(member.id); setShowActions(null); }} className="w-full px-5 py-3 text-left text-sm font-bold hover:bg-rose-50 text-rose-500 flex items-center space-x-3">
                        <i className="fas fa-trash-alt"></i> <span>Удалить</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {staff.length === 0 && (
          <div className="col-span-full py-20 text-center text-slate-400 bg-white rounded-[2rem] border-2 border-dashed border-slate-100 italic">
            Команда еще не сформирована
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl animate-scaleIn">
            <h2 className="text-2xl font-black mb-8">{editingMember ? 'Редактировать сотрудника' : 'Новый доступ'}</h2>
            <div className="space-y-4 mb-10">
              <input name="name" defaultValue={editingMember?.name} placeholder="ФИО сотрудника" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              <input name="login" defaultValue={editingMember?.login} placeholder="Логин для входа" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              <input name="password" type="password" placeholder={editingMember ? "Оставьте пустым для сохранения" : "Пароль доступа"} required={!editingMember} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              <select name="role" defaultValue={editingMember?.role || UserRole.STAFF} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 appearance-none text-slate-900">
                <option value={UserRole.STAFF}>Сотрудник</option>
                <option value={UserRole.ADMIN}>Администратор</option>
              </select>
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold text-slate-600 transition-all">Отмена</button>
              <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 transition-all">Сохранить</button>
            </div>
          </form>
        </div>
      )}

      {viewingMember && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl animate-scaleIn relative">
            <button onClick={() => setViewingMember(null)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 transition-all">
              <i className="fas fa-times"></i>
            </button>
            <h2 className="text-2xl font-black mb-6">Профиль сотрудника</h2>
            <div className="flex items-center space-x-6 mb-8">
               <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 text-3xl font-black shadow-inner">
                 {viewingMember.name.charAt(0)}
               </div>
               <div>
                 <h3 className="text-2xl font-black text-slate-900">{viewingMember.name}</h3>
                 <p className="text-sm font-bold text-blue-600 uppercase tracking-widest">{viewingMember.role}</p>
               </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-5 rounded-2xl">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Логин</div>
                <div className="font-bold text-slate-900">{viewingMember.login}</div>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">В команде с</div>
                <div className="font-bold text-slate-900">{new Date(viewingMember.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffList;
