
import React, { useMemo } from 'react';
import { SignConfig } from '../../types';
import { calculateRetailPrice } from '../../services/pricing';
import { DollarSign, ArrowRight, TrendingUp } from 'lucide-react';

interface PricingOverlayProps {
  config: SignConfig;
  onViewDetails: () => void;
}

export const PricingOverlay: React.FC<PricingOverlayProps> = ({ config, onViewDetails }) => {
  const price = useMemo(() => calculateRetailPrice(config), [config]);

  // Determine if we should show a specific breakdown hint
  const itemCount = price.items.length;
  const isRaceway = price.items.some(i => i.id === 'RACEWAY');

  return (
    <div className="absolute bottom-6 right-6 z-40 animate-in slide-in-from-bottom-4 fade-in duration-700">
        <button 
            onClick={onViewDetails}
            className="group text-left bg-slate-900/95 backdrop-blur-xl border border-slate-700 hover:border-emerald-500/50 rounded-2xl shadow-2xl p-5 min-w-[240px] transition-all duration-300 hover:-translate-y-1 hover:shadow-emerald-900/20"
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
            
            <div className="flex flex-col items-end">
                <div className="text-4xl font-bold text-white tracking-tighter tabular-nums font-sans drop-shadow-lg">
                    ${price.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="flex items-center justify-between w-full mt-2">
                    <span className="text-[10px] text-slate-500 font-medium">
                        {itemCount} Item{itemCount !== 1 ? 's' : ''} {isRaceway ? '+ Raceway' : ''}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-blue-400 font-semibold opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                        <span>View Quote</span>
                        <ArrowRight size={10} />
                    </div>
                </div>
            </div>
        </button>
    </div>
  );
};
