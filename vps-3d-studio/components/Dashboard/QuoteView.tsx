
import React from 'react';
import { SignConfig } from '../../types';
import { PricingQuote } from '../../services/pricing';
import { generateBlueprintHTML } from '../../services/blueprintExporter';
import { Printer, Download, DollarSign, FileText, Loader2 } from 'lucide-react';

interface QuoteViewProps {
  config: SignConfig;
  quoteData: PricingQuote | null;
  isCalculating: boolean;
}

export const QuoteView: React.FC<QuoteViewProps> = ({ config, quoteData, isCalculating }) => {
  if (isCalculating || !quoteData) {
    return (
      <div className="w-full h-full p-8 pt-24 overflow-hidden flex flex-col items-center justify-center">
        <div className="bg-white text-slate-900 rounded-xl shadow-2xl p-12 flex flex-col items-center text-center max-w-md border border-slate-300">
          {isCalculating ? (
            <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
          ) : (
            <FileText className="text-slate-400 mb-4" size={48} />
          )}
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            {isCalculating ? 'Calculating Quote...' : 'No Quote Data'}
          </h2>
          <p className="text-slate-500">
            Click 'Process Cartridge' to generate live pricing via the SignOS Data Engine.
          </p>
        </div>
      </div>
    );
  }

  const handlePrint = () => {
    const blueprintHtml = generateBlueprintHTML(config);
    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) return;

    const itemsRows = quoteData.items.map(item => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px; color: #64748b; font-size: 11px;">${item.category}</td>
            <td style="padding: 8px;">
                <div style="font-weight: 600; color: #0f172a; font-size: 12px;">${item.description}</div>
                <div style="font-size: 10px; color: #94a3b8; font-family: monospace;">${item.id}</div>
            </td>
            <td style="padding: 8px; text-align: right; font-size: 12px;">${item.qty.toFixed(1)} <span style="font-size: 10px; color: #64748b;">${item.unit}</span></td>
            <td style="padding: 8px; text-align: right; font-size: 12px;">$${item.unitPrice.toFixed(2)}</td>
            <td style="padding: 8px; text-align: right; font-weight: bold; font-size: 12px;">$${item.total.toFixed(2)}</td>
        </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Quote - ${config.lines[0] || 'Signage Project'}</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @page { size: 8.5in 11in; margin: 0; }
            body { 
                font-family: 'Inter', sans-serif; 
                background-color: #e2e8f0; 
                margin: 0;
                padding: 40px;
                display: flex;
                justify-content: center;
            }
            .page {
                width: 8.5in;
                min-height: 11in;
                background-color: white;
                padding: 0.5in;
                box-sizing: border-box;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                margin-bottom: 20px;
                position: relative;
            }
            .header {
                display: flex; 
                justify-content: space-between; 
                align-items: flex-end; 
                margin-bottom: 20px; 
                border-bottom: 4px solid #0f172a; 
                padding-bottom: 15px;
            }
            @media print { 
              body { background: none; display: block; padding: 0; margin: 0; }
              .page { width: 100%; height: 100%; box-shadow: none; margin: 0; padding: 0.5in; }
              .no-print { display: none; }
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact;
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
                <div>
                  <h1 style="margin: 0; font-size: 20px; text-transform: uppercase; font-weight: 800; letter-spacing: -0.02em;">SignFabricator</h1>
                  <p style="margin: 2px 0 0 0; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">Official Estimate</p>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 14px; font-weight: 700; font-family: monospace;">Quote #${Math.floor(Math.random() * 900000)}</div>
                  <div style="font-size: 10px; color: #64748b;">${new Date().toLocaleDateString()}</div>
                </div>
            </div>
            
            <!-- Reference Drawing -->
            <div style="margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden;">
                <div style="background: #f8fafc; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; font-size: 11px; color: #64748b; letter-spacing: 0.05em; text-transform: uppercase;">Reference Configuration</div>
                <div style="position: relative; width: 100%; height: 550px; overflow: hidden; background: white;">
                    <div style="transform: scale(0.66); transform-origin: top left; width: 1056px;">
                        ${blueprintHtml}
                    </div>
                </div>
            </div>

            <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 20px; margin-bottom: 10px; border-bottom: 2px solid #0f172a; padding-bottom: 6px;">Pricing Breakdown</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
                <thead>
                <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                    <th style="padding: 8px; text-align: left; font-weight: 600; color: #475569;">Category</th>
                    <th style="padding: 8px; text-align: left; font-weight: 600; color: #475569;">Description</th>
                    <th style="padding: 8px; text-align: right; font-weight: 600; color: #475569;">Qty</th>
                    <th style="padding: 8px; text-align: right; font-weight: 600; color: #475569;">Rate</th>
                    <th style="padding: 8px; text-align: right; font-weight: 600; color: #475569;">Total</th>
                </tr>
                </thead>
                <tbody>
                    ${itemsRows}
                </tbody>
            </table>

            <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
                <table style="width: 250px; border-collapse: collapse; font-size: 12px;">
                    <tr>
                        <td style="padding: 6px; text-align: right; color: #64748b;">Subtotal</td>
                        <td style="padding: 6px; text-align: right; font-weight: 600;">$${quoteData.subtotal.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px; text-align: right; color: #64748b; border-bottom: 1px solid #e2e8f0;">Tax (8.25%)</td>
                        <td style="padding: 6px; text-align: right; color: #64748b; border-bottom: 1px solid #e2e8f0;">$${quoteData.tax.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; text-align: right; font-weight: 800; font-size: 14px; color: #0f172a;">ESTIMATED TOTAL</td>
                        <td style="padding: 8px; text-align: right; font-weight: 800; font-size: 14px; color: #2563eb;">$${quoteData.total.toFixed(2)}</td>
                    </tr>
                </table>
            </div>

            <div style="font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px;">
                This estimate is valid for 30 days. Final pricing subject to site survey verification.
            </div>

            <!-- Footer -->
            <div style="position: absolute; bottom: 0.5in; left: 0.5in; right: 0.5in; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between;">
                <span>Generated by SignFabricator OS</span>
                <span>Page 1 of 1</span>
            </div>
          </div>

          <script>window.onload = () => { setTimeout(() => window.print(), 800); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="w-full h-full p-8 pt-24 overflow-hidden flex flex-col items-center">
       <div className="w-full max-w-5xl bg-white text-slate-900 rounded-xl shadow-2xl overflow-hidden flex flex-col h-full border border-slate-300">
          
          {/* Header */}
          <div className="bg-slate-50 border-b border-slate-200 p-6 flex justify-between items-center shrink-0">
             <div>
                <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                    <FileText className="text-blue-600" /> Estimate Summary
                </h1>
                <p className="text-sm text-slate-500">Retail pricing based on current configuration</p>
             </div>
             <button 
                onClick={handlePrint}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-md transition-all active:scale-95"
             >
                <Printer size={18} /> Print / Save PDF
             </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-8">
             
             {/* Drawing Preview */}
             <div className="bg-slate-100 rounded-lg p-6 mb-8 border border-slate-200 flex flex-col items-center overflow-hidden">
                 <h3 className="text-xs font-bold text-slate-400 uppercase w-full mb-4 text-center">Reference Configuration</h3>
                 <div className="scale-75 origin-top" dangerouslySetInnerHTML={{ __html: generateBlueprintHTML(config) }} />
             </div>

             {/* Line Items */}
             <table className="w-full text-sm mb-8">
                <thead className="bg-slate-100 border-y border-slate-200 text-xs uppercase font-semibold text-slate-500">
                   <tr>
                     <th className="px-4 py-3 text-left">Category</th>
                     <th className="px-4 py-3 text-left">Description</th>
                     <th className="px-4 py-3 text-right">Qty</th>
                     <th className="px-4 py-3 text-right">Unit Price</th>
                     <th className="px-4 py-3 text-right">Total</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {quoteData.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                         <td className="px-4 py-4 text-slate-500 font-medium">{item.category}</td>
                         <td className="px-4 py-4 text-slate-800">
                            {item.description}
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.id}</div>
                         </td>
                         <td className="px-4 py-4 text-right text-slate-600">{item.qty.toFixed(1)} <span className="text-[10px] text-slate-400 uppercase">{item.unit}</span></td>
                         <td className="px-4 py-4 text-right text-slate-600">${item.unitPrice.toFixed(2)}</td>
                         <td className="px-4 py-4 text-right font-bold text-slate-900">${item.total.toFixed(2)}</td>
                      </tr>
                   ))}
                </tbody>
             </table>

             {/* Totals */}
             <div className="flex justify-end">
                <div className="w-64 space-y-3">
                   <div className="flex justify-between text-slate-500">
                      <span>Subtotal</span>
                      <span>${quoteData.subtotal.toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between text-slate-500 pb-3 border-b border-slate-200">
                      <span>Tax (8.25%)</span>
                      <span>${quoteData.tax.toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between items-center text-lg font-bold text-slate-900">
                      <span>Total</span>
                      <span className="text-blue-600">${quoteData.total.toFixed(2)}</span>
                   </div>
                </div>
             </div>

          </div>

       </div>
    </div>
  );
};
