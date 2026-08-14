
import React, { useState, useEffect } from 'react';
import { Staff, UserRole, StaffPermissions } from '../types';

interface StaffListProps {
  staff: Staff[];
  onAdd: (s: Staff) => void;
  onUpdate: (s: Staff) => void;
  onDelete: (id: string) => void;
  onSelectStaff: (id: string) => void;
}

const DEFAULT_PERMISSIONS: StaffPermissions = {
  canCreateBooking: true,
  canAddCar: false,
  canEdit: false,
  canDelete: false,
  canViewDocs: false,
  fullAccess: false,
};

interface ToggleItemProps {
  label: string;
  checked: boolean;
  onChange: () => void;
  color: string;
  description?: string;
}

const ToggleItem: React.FC<ToggleItemProps> = ({ label, checked, onChange, color, description }) => (
  <div onClick={onChange} className="flex items-center justify-between p-3 hover:bg-white rounded-xl cursor-pointer transition-all group">
    <div>
      <div className="font-bold text-slate-700 text-sm group-hover:text-slate-900">{label}</div>
      {description && <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{description}</div>}
    </div>
    <div className={`w-10 h-6 rounded-full p-1 transition-colors ${checked ? color : 'bg-slate-200'}`}>
      <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-4' : ''}`}></div>
    </div>
  </div>
);

const StaffList: React.FC<StaffListProps> = ({ staff, onAdd, onUpdate, onDelete, onSelectStaff }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Staff | null>(null);
  const [viewingMember, setViewingMember] = useState<Staff | null>(null);
  const [showActions, setShowActions] = useState<string | null>(null);

  // Permissions State
  const [permissions, setPermissions] = useState<StaffPermissions>(DEFAULT_PERMISSIONS);

  useEffect(() => {
    if (editingMember && editingMember.permissions) {
      setPermissions(editingMember.permissions);
    } else {
      setPermissions(DEFAULT_PERMISSIONS);
    }
  }, [editingMember]);

  const handlePermissionChange = (key: keyof StaffPermissions) => {
    setPermissions(prev => {
      if (key === 'fullAccess') {
        const newVal = !prev.fullAccess;
        return {
          fullAccess: newVal,
          canCreateBooking: newVal,
          canAddCar: newVal,
          canEdit: newVal,
          canDelete: newVal,
          canViewDocs: newVal,
        };
      }
      const newPerms = { ...prev, [key]: !prev[key] };
      // If any specific permission is unchecked, fullAccess must be false
      if (!newPerms[key]) newPerms.fullAccess = false;
      return newPerms;
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    // For Staff, 'login' is used as 'email' in the backend User model mostly,
    // but the form asks for Email now. We map Email input to 'email' and 'login' fields.
    const emailVal = fd.get('email') as string;

    const data: Staff = {
      id: editingMember?.id || '',
      ownerId: editingMember?.ownerId || '',
      name: fd.get('name') as string,
      login: emailVal, // Use email as login
      email: emailVal,
      password: (fd.get('password') as string) || undefined, // undefined if empty to not overwrite on edit
      role: UserRole.STAFF, // Force staff role
      createdAt: editingMember?.createdAt || new Date().toISOString(),
      permissions: permissions
    };

    if (editingMember) onUpdate(data);
    else onAdd(data);

    setIsModalOpen(false);
    setEditingMember(null);
  };

  return (
    <div className="space-y-5 animate-fadeIn pb-24 md:pb-0">
      <div className="flex justify-between items-center px-2">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900">Команда</h2>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wide mt-1">Управление сотрудниками и доступом</p>
        </div>
        <button
          onClick={() => { setEditingMember(null); setPermissions(DEFAULT_PERMISSIONS); setIsModalOpen(true); }}
          className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-semibold hover:bg-blue-700 shadow-md transition-all text-sm flex items-center gap-2"
        >
          <i className="fas fa-user-plus"></i> <span>Добавить</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-2">
        {staff.map(member => (
          <div key={member.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative group">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-slate-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl font-semibold shadow-inner">
                  {member.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">{member.name}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide truncate max-w-[120px]">{member.email || member.login}</span>
                    <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${member.permissions?.fullAccess ? 'text-emerald-500' : 'text-blue-500'}`}>
                      {member.permissions?.fullAccess ? 'Полный доступ' : 'Сотрудник'}
                    </span>
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
                    <div className="absolute right-0 top-12 w-48 bg-white rounded-2xl shadow-md border border-slate-50 z-50 overflow-hidden animate-scaleIn">
                      <button onClick={() => { onSelectStaff(member.id); setShowActions(null); }} className="w-full px-5 py-3 text-left text-sm font-bold hover:bg-slate-50 flex items-center space-x-3 text-slate-600 border-b border-slate-50">
                        <i className="fas fa-id-card text-blue-500"></i> <span>Профиль</span>
                      </button>
                      <button onClick={() => { setEditingMember(member); setIsModalOpen(true); setShowActions(null); }} className="w-full px-5 py-3 text-left text-sm font-bold hover:bg-slate-50 flex items-center space-x-3 text-slate-600 border-b border-slate-50">
                        <i className="fas fa-edit text-amber-500"></i> <span>Права доступа</span>
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
          <div className="col-span-full py-20 text-center text-slate-400 bg-white rounded-2xl border-2 border-dashed border-slate-100 italic">
            Команда еще не сформирована
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-md animate-scaleIn my-auto">
            <h2 className="text-2xl font-semibold mb-8">{editingMember ? 'Редактировать сотрудника' : 'Новый сотрудник'}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Основные данные</h3>
                <input name="name" defaultValue={editingMember?.name} placeholder="ФИО сотрудника" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
                <input name="email" type="email" defaultValue={editingMember?.email || editingMember?.login} placeholder="Email (для входа)" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
                <input name="password" type="password" placeholder={editingMember ? "Новый пароль (необязательно)" : "Пароль"} required={!editingMember} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-xs text-blue-800 font-medium leading-relaxed">
                  <i className="fas fa-info-circle mr-2"></i>
                  Сотрудник сможет входить в систему, используя указанный Email и пароль.
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Права доступа</h3>

                <div className="bg-slate-50 p-1 rounded-2xl space-y-1">
                  <ToggleItem
                    label="Полный доступ"
                    checked={permissions.fullAccess}
                    onChange={() => handlePermissionChange('fullAccess')}
                    color="bg-purple-500"
                    description="Включает все функции"
                  />
                  <div className="h-px bg-slate-200 mx-4 my-2"></div>
                  <ToggleItem
                    label="Оформление сделок"
                    checked={permissions.canCreateBooking}
                    onChange={() => handlePermissionChange('canCreateBooking')}
                    color="bg-blue-500"
                  />
                  <ToggleItem
                    label="Добавление авто"
                    checked={permissions.canAddCar}
                    onChange={() => handlePermissionChange('canAddCar')}
                    color="bg-indigo-500"
                  />
                  <ToggleItem
                    label="Редактирование"
                    checked={permissions.canEdit}
                    onChange={() => handlePermissionChange('canEdit')}
                    color="bg-amber-500"
                  />
                  <ToggleItem
                    label="Удаление"
                    checked={permissions.canDelete}
                    onChange={() => handlePermissionChange('canDelete')}
                    color="bg-rose-500"
                  />
                  <ToggleItem
                    label="Касса и отчеты"
                    checked={permissions.canViewDocs}
                    onChange={() => handlePermissionChange('canViewDocs')}
                    color="bg-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold text-slate-600 transition-all hover:bg-slate-200">Отмена</button>
              <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-md transition-all hover:bg-blue-700">Сохранить</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default StaffList;
