
import React, { useState, useEffect } from 'react';
import { Car, Rental } from '../backend/src/types.ts';
import { getFleetInsights } from '../services/geminiService';

interface AiAdvisorProps {
  cars: Car[];
  rentals: Rental[];
}

const AiAdvisor: React.FC<AiAdvisorProps> = ({ cars, rentals }) => {
  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    const result = await getFleetInsights(cars, rentals);
    setInsight(result || 'Unable to generate analysis.');
    setLoading(false);
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white mb-8 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-white/20 rounded-2xl backdrop-blur-md flex items-center justify-center text-3xl">
              <i className="fas fa-robot animate-pulse"></i>
            </div>
            <div>
              <h2 className="text-3xl font-bold">AutoPro AI Advisor</h2>
              <p className="text-blue-100">Deep analysis of your car rental business metrics</p>
            </div>
          </div>
          <button 
            onClick={fetchInsights}
            disabled={loading}
            className="bg-white text-blue-700 px-6 py-3 rounded-xl font-bold hover:bg-blue-50 transition-all flex items-center space-x-2"
          >
            {loading ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-sync-alt"></i>}
            <span>{loading ? 'Analyzing Fleet...' : 'Refresh AI Analysis'}</span>
          </button>
        </div>
        <i className="fas fa-brain absolute -right-10 -bottom-10 text-9xl text-white/10 rotate-12"></i>
      </div>

      <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <div className="flex space-x-2">
              <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce delay-100"></div>
              <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce delay-200"></div>
            </div>
            <p className="text-gray-500 font-medium">Gemini is processing your business data...</p>
          </div>
        ) : (
          <div className="prose prose-blue max-w-none">
            <div className="flex items-center space-x-2 text-blue-600 mb-6">
              <i className="fas fa-lightbulb"></i>
              <span className="font-bold uppercase tracking-widest text-sm">Actionable Insights</span>
            </div>
            <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {insight.split('\n').map((line, i) => (
                <p key={i} className="mb-4">{line}</p>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <InsightCard icon="fa-chart-line" title="Predictive Demand" desc="AI identifies upcoming peak seasons and high-demand models." />
        <InsightCard icon="fa-tags" title="Dynamic Pricing" desc="Smart suggestions for increasing ROI based on utilization." />
        <InsightCard icon="fa-tools" title="Maintenance Alerts" desc="Early warnings for potential mechanical issues across the fleet." />
      </div>
    </div>
  );
};

const InsightCard: React.FC<{icon: string, title: string, desc: string}> = ({icon, title, desc}) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start space-x-3">
    <div className="text-blue-600 mt-1">
      <i className={`fas ${icon}`}></i>
    </div>
    <div>
      <h4 className="font-bold text-gray-900 text-sm">{title}</h4>
      <p className="text-xs text-gray-500 mt-1">{desc}</p>
    </div>
  </div>
);

export default AiAdvisor;
