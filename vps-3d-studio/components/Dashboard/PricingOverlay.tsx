import React from 'react';
import { SignConfig } from '../../types';
import { DollarSign, TrendingUp } from 'lucide-react';

interface PricingOverlayProps {
  config: SignConfig;
  onViewDetails: () => void;
  quoteData: any;
  isCalculating: boolean;
}

export const PricingOverlay: React.FC<PricingOverlayProps> = ({ config, onViewDetails, quoteData, isCalculating }) => {
  const price = quoteData || { grandTotal: 0, items: [] };

  return (
    <div 
      className="absolute top-6 left-6 z-30 p-6 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl w-72 cursor-pointer hover:border-slate-700 transition-colors group"
      onClick={onViewDetails}
    >
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800 group-hover:border-slate-700 transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <DollarSign size={12} className="text-emerald-500" />
          </div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Retail Estimate</span>
        </div>
        <TrendingUp size={14} className="text-slate-600 group-hover:text-emerald-500 transition-colors" />
      </div>

      {isCalculating ? (
        <div className="text-center text-emerald-500 font-bold animate-pulse text-[10px] uppercase tracking-widest py-2">
          Calculating via SignOS...
        </div>
      ) : !quoteData ? (
        <div className="text-center text-slate-500 font-bold text-[10px] uppercase tracking-widest py-2 leading-relaxed">
          Click 'Process Cartridge'<br/>to generate live pricing.
        </div>
      ) : (
        <div className="flex flex-col items-end">
          <div className="text-4xl font-bold text-white tracking-tighter tabular-nums font-sans drop-shadow-lg">
            ${(price.grandTotal || price.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      )}
    </div>
  );
};