
import React, { useState } from 'react';
import { User } from '../types';

interface TariffsProps {
  user: User;
  onUpdate: (u: Partial<User>) => void;
  onBack: () => void;
}

const PLANS = [
  {
    id: 'START',
    name: 'Старт',
    price: 990,
    features: ['До 5 автомобилей', 'Базовый календарь', 'Печать договоров', 'Учет клиентов'],
    color: 'bg-slate-100 text-slate-900',
    limit: 5
  },
  {
    id: 'BUSINESS',
    name: 'Бизнес',
    price: 1500,
    features: ['До 20 автомобилей', 'Учет инвесторов и выплат', 'Финансовые отчеты', 'WhatsApp уведомления'],
    color: 'bg-blue-600 text-white',
    popular: true,
    limit: 20
  },
  {
    id: 'PREMIUM',
    name: 'Премиум',
    price: 2500,
    features: ['Безлимит автомобилей', 'Брендирование (White Label)', 'Приоритетная поддержка', 'Экспорт данных в Excel'],
    color: 'bg-indigo-900 text-white',
    limit: 9999
  },
];

const Tariffs: React.FC<TariffsProps> = ({ user, onUpdate, onBack }) => {
  const [months, setMonths] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[0] | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  const getDiscount = (m: number) => {
    if (m === 12) return 0.2;
    if (m === 6) return 0.1;
    return 0;
  };

  const calculatePrice = (basePrice: number) => {
    const total = basePrice * months;
    const discount = getDiscount(months);
    return Math.round(total * (1 - discount));
  };

  const handlePay = () => {
    if (!selectedPlan) return;
    setIsPaying(true);

    // Simulate payment process
    setTimeout(() => {
      // Calculate new date. If currently active, add to existing date. Else add to today.
      const now = new Date();
      const currentExpiry = user.subscriptionUntil ? new Date(user.subscriptionUntil) : new Date();
      // If expired, start from today. If active, extend.
      const baseDate = currentExpiry > now ? currentExpiry : now;

      const newExpiry = new Date(baseDate);
      newExpiry.setMonth(newExpiry.getMonth() + months);

      onUpdate({
        subscriptionUntil: newExpiry.toISOString(),
        isTrial: false,
        activePlan: selectedPlan.name
      });

      setIsPaying(false);
      setSelectedPlan(null);
      alert(`Тариф "${selectedPlan.name}" на ${months} мес. успешно оплачен!`);
    }, 2000);
  };

  return (
    <div className="space-y-12 animate-fadeIn max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <button onClick={onBack} className="text-slate-400 font-bold hover:text-blue-600 mb-2 flex items-center space-x-2">
            <i className="fas fa-arrow-left"></i> <span>Назад</span>
          </button>
          <h2 className="text-4xl font-semibold text-slate-900 tracking-tight">Тарифные планы</h2>
          <p className="text-slate-500 font-medium">Выберите подходящий уровень контроля для вашего бизнеса</p>
        </div>
        <div className="bg-blue-50 px-6 py-4 rounded-xl border border-blue-100 hidden md:block">
           <div className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide mb-1">Ваша подписка до</div>
           <div className={`text-lg font-semibold ${user.subscriptionUntil && new Date(user.subscriptionUntil) < new Date() ? 'text-rose-600' : 'text-blue-700'}`}>
             {user.subscriptionUntil ? new Date(user.subscriptionUntil).toLocaleDateString() : 'Не активна'}
           </div>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex justify-center">
        <div className="bg-slate-100 p-2 rounded-2xl flex items-center space-x-2">
          {[1, 6, 12].map(m => (
            <button
              key={m}
              onClick={() => setMonths(m)}
              className={`px-8 py-4 rounded-2xl font-semibold text-sm uppercase tracking-wide transition-all ${months === m ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {m === 1 ? '1 месяц' : m === 6 ? '6 месяцев (-10%)' : '1 год (-20%)'}
            </button>
          ))}
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        {PLANS.map(plan => (
          <div
            key={plan.id}
            className={`rounded-2xl p-6 flex flex-col justify-between border-2 transition-all hover:-translate-y-2 relative overflow-hidden ${
              plan.popular ? 'border-blue-600 shadow-md' : 'border-slate-100 bg-white'
            }`}
          >
            {plan.popular && (
              <div className="absolute top-8 -right-12 bg-blue-600 text-white py-2 px-12 rotate-45 text-[10px] font-semibold uppercase tracking-wide shadow-lg">
                Выбор профи
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-6">
                 <h3 className={`text-2xl font-semibold ${plan.id === 'BUSINESS' || plan.id === 'PREMIUM' ? 'text-slate-900' : 'text-slate-900'}`}>{plan.name}</h3>
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${plan.color.includes('bg-white') ? 'bg-slate-100' : plan.color}`}>
                   <i className={`fas ${plan.id === 'START' ? 'fa-car' : plan.id === 'BUSINESS' ? 'fa-chart-pie' : 'fa-crown'}`}></i>
                 </div>
              </div>

              <div className="flex items-baseline mb-8">
                <span className="text-5xl font-bold tracking-tighter">{calculatePrice(plan.price).toLocaleString()} ₽</span>
                <span className="text-slate-400 font-bold text-sm ml-2">/ период</span>
              </div>

              <div className="space-y-4 mb-10">
                {plan.features.map(f => (
                  <div key={f} className="flex items-center space-x-3 text-sm font-medium text-slate-600">
                    <i className="fas fa-check-circle text-blue-500"></i>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setSelectedPlan(plan)}
              className={`w-full py-5 rounded-xl font-semibold uppercase tracking-wide text-xs transition-all ${
                plan.popular ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-900 text-white'
              } hover:scale-105 active:scale-95`}
            >
              {user.activePlan === plan.name ? 'Продлить тариф' : 'Выбрать план'}
            </button>
          </div>
        ))}
      </div>

      {/* Payment Modal Simulation */}
      {selectedPlan && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-2xl w-full max-w-lg p-8 shadow-md animate-scaleIn relative overflow-hidden">
            {isPaying ? (
              <div className="py-20 text-center space-y-4">
                 <div className="w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                 <h3 className="text-2xl font-semibold">Обработка транзакции...</h3>
                 <p className="text-slate-400 font-medium">Безопасное соединение с банком-эквайером</p>
              </div>
            ) : (
              <>
                <button onClick={() => setSelectedPlan(null)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900">
                  <i className="fas fa-times"></i>
                </button>
                <h2 className="text-3xl font-semibold mb-2 tracking-tight">Оплата</h2>
                <p className="text-slate-400 font-medium mb-8">Итого к оплате за тариф "{selectedPlan.name}":</p>
                
                <div className="bg-blue-50 p-5 rounded-2xl border-2 border-blue-100 mb-8 flex justify-between items-center">
                  <div>
                    <div className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide mb-1">К оплате</div>
                    <div className="text-4xl font-bold text-blue-700">{calculatePrice(selectedPlan.price).toLocaleString()} ₽</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Период</div>
                    <div className="text-lg font-bold">{months} мес.</div>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                   <button onClick={handlePay} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-semibold uppercase tracking-wide text-xs flex items-center justify-center space-x-3 hover:bg-slate-800 transition-all">
                      <i className="fas fa-credit-card"></i>
                      <span>Банковская карта</span>
                   </button>
                   <button onClick={handlePay} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-semibold uppercase tracking-wide text-xs flex items-center justify-center space-x-3 hover:bg-blue-700 transition-all shadow-md">
                      <i className="fas fa-qrcode"></i>
                      <span>Оплата через СБП</span>
                   </button>
                </div>
                
                <p className="text-[10px] text-slate-400 text-center leading-relaxed">Нажимая на кнопку оплаты, вы соглашаетесь с условиями оферты и политикой конфиденциальности.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Tariffs;
