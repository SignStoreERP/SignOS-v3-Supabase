
import React, { useState } from 'react';
import { ManufacturingPacket, SiteSurveyData } from '../../types';
import { generateInstallationTicket } from '../../services/geminiService';
import { generateBlueprintHTML } from '../../services/blueprintExporter';
import { Hammer, ClipboardList, Bot, FileText, Printer } from 'lucide-react';

interface Props {
  packet: ManufacturingPacket;
  survey: SiteSurveyData;
}

export const ManufacturingView: React.FC<Props> = ({ packet, survey }) => {
  const [installTicket, setInstallTicket] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const handleGenerateTicket = async () => {
    setLoadingAi(true);
    const result = await generateInstallationTicket(packet.config, survey);
    setInstallTicket(result);
    setLoadingAi(false);
  };

  const generateBomHtml = (blueprintHtml: string) => {
    const rows = packet.bom.map(item => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px; font-family: monospace; color: #64748b; font-size: 11px;">${item.department}</td>
        <td style="padding: 8px;">
            <div style="font-weight: 600; color: #0f172a;">${item.name}</div>
            <div style="font-size: 10px; color: #64748b;">${item.sku}</div>
        </td>
        <td style="padding: 8px; text-align: right; font-weight: 600;">${item.quantity}</td>
        <td style="padding: 8px; color: #64748b; font-size: 11px;">${item.unit}</td>
      </tr>
    `).join('');

    return `
      <div style="margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden;">
         <div style="background: #f8fafc; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; font-size: 11px; color: #64748b; letter-spacing: 0.05em; text-transform: uppercase;">Reference Drawing</div>
         <div style="position: relative; width: 100%; height: 550px; overflow: hidden; background: white;">
           <div style="transform: scale(0.66); transform-origin: top left; width: 1056px;">
             ${blueprintHtml}
           </div>
         </div>
      </div>

      <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 20px; margin-bottom: 10px; border-bottom: 2px solid #0f172a; padding-bottom: 6px;">Bill of Materials</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
            <th style="padding: 8px; text-align: left; font-weight: 600; color: #475569;">Dept</th>
            <th style="padding: 8px; text-align: left; font-weight: 600; color: #475569;">Item Details</th>
            <th style="padding: 8px; text-align: right; font-weight: 600; color: #475569;">Qty</th>
            <th style="padding: 8px; text-align: left; font-weight: 600; color: #475569;">Unit</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  };

  const generateTicketHtml = (blueprintHtml: string) => {
    return `
      <div style="margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden;">
         <div style="background: #f8fafc; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; font-size: 11px; color: #64748b; letter-spacing: 0.05em; text-transform: uppercase;">Reference Drawing</div>
         <div style="position: relative; width: 100%; height: 550px; overflow: hidden; background: white;">
           <div style="transform: scale(0.66); transform-origin: top left; width: 1056px;">
             ${blueprintHtml}
           </div>
         </div>
      </div>

      <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 20px; margin-bottom: 15px; border-bottom: 2px solid #0f172a; padding-bottom: 6px;">Installation & Production Ticket</h2>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; font-size: 12px;">
        <div style="background: #f8fafc; padding: 12px; border: 1px solid #e2e8f0; border-radius: 4px;">
          <h3 style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Sign Configuration</h3>
          <p style="margin: 4px 0;"><strong>Type:</strong> ${packet.config.type}</p>
          <p style="margin: 4px 0;"><strong>Size:</strong> ${Math.round(packet.config.dimensions.calculatedWidth)}" W x ${packet.config.dimensions.height}" H</p>
          <p style="margin: 4px 0;"><strong>Mount:</strong> ${packet.config.mount}</p>
          <p style="margin: 4px 0;"><strong>Face:</strong> ${packet.config.colors.face}</p>
        </div>
        <div style="background: #f8fafc; padding: 12px; border: 1px solid #e2e8f0; border-radius: 4px;">
          <h3 style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Site Conditions</h3>
          <p style="margin: 4px 0;"><strong>Wall:</strong> ${survey.wallType}</p>
          <p style="margin: 4px 0;"><strong>Install Height:</strong> ${survey.installHeight} ft</p>
          <p style="margin: 4px 0;"><strong>Access:</strong> ${survey.accessType}</p>
          <p style="margin: 4px 0;"><strong>Power:</strong> ${survey.powerAccess}</p>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #1e293b;">AI Safety & Logistics Analysis</h3>
        <div style="background: #f1f5f9; padding: 15px; border-left: 3px solid #6366f1; white-space: pre-wrap; font-family: monospace; font-size: 11px; line-height: 1.4; color: #334155;">
          ${installTicket || 'No AI analysis generated yet.'}
        </div>
      </div>

      ${packet.warnings.length > 0 ? `
        <div style="border: 1px solid #fca5a5; background: #fef2f2; padding: 12px; border-radius: 4px;">
          <h3 style="margin: 0 0 8px 0; color: #991b1b; font-size: 12px; font-weight: 700;">Production Warnings</h3>
          <ul style="margin: 0; padding-left: 16px; color: #7f1d1d; font-size: 11px;">
            ${packet.warnings.map(w => `<li style="margin-bottom: 2px;">${w}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    `;
  };

  const handleExport = (type: 'bom' | 'ticket') => {
    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) return;
    
    const blueprintHtml = generateBlueprintHTML(packet.config);
    const title = type === 'bom' ? 'Bill of Materials' : 'Production Ticket';
    const content = type === 'bom' ? generateBomHtml(blueprintHtml) : generateTicketHtml(blueprintHtml);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - ${packet.id}</title>
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
                  <p style="margin: 2px 0 0 0; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">Enterprise Manufacturing Output</p>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 14px; font-weight: 700; font-family: monospace;">Order #${packet.id}</div>
                  <div style="font-size: 10px; color: #64748b;">${new Date().toLocaleDateString()}</div>
                </div>
            </div>
            
            ${content}
            
            <!-- Footer -->
            <div style="position: absolute; bottom: 0.5in; left: 0.5in; right: 0.5in; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between;">
                <span>Generated by SignFabricator OS</span>
                <span>Page 1 of 1</span>
            </div>
          </div>
          
          <script>
            window.onload = () => { setTimeout(() => window.print(), 800); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6 bg-slate-900/50">
      
      {/* Action Bar */}
      <div className="flex gap-2 justify-end">
        <button onClick={() => handleExport('bom')} className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-2 rounded flex items-center gap-2 transition-colors">
           <FileText size={14}/> Print BoM (PDF)
        </button>
        <button onClick={() => handleExport('ticket')} className="bg-blue-700 hover:bg-blue-600 text-white text-xs px-3 py-2 rounded flex items-center gap-2 transition-colors">
           <Printer size={14}/> Print Ticket (PDF)
        </button>
      </div>

      {/* Warnings Header */}
      {packet.warnings.length > 0 && (
        <div className="bg-orange-900/20 border border-orange-700/50 rounded-md p-4">
          <h4 className="flex items-center gap-2 text-orange-400 font-semibold mb-2">
            Production Notices
          </h4>
          <ul className="list-disc list-inside text-orange-200/80 text-sm space-y-1">
            {packet.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Bill of Materials */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        <div className="p-4 bg-slate-800/80 border-b border-slate-700">
           <h3 className="text-lg font-medium text-slate-200 flex items-center gap-2">
             <ClipboardList className="text-emerald-400" size={18}/> Bill of Materials
           </h3>
        </div>
        <table className="w-full text-sm text-left text-slate-400">
          <thead className="text-xs text-slate-500 uppercase bg-slate-900/50">
            <tr>
              <th className="px-4 py-3">Dept</th>
              <th className="px-4 py-3">SKU / Item</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3">Unit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {packet.bom.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-blue-300">{item.department}</td>
                <td className="px-4 py-3 text-slate-200 font-medium">{item.name}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-400">{item.quantity}</td>
                <td className="px-4 py-3 text-slate-500">{item.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Workflow Tasks */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
          <Hammer className="text-blue-400" size={18}/> Fabrication Workflow
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {packet.tasks.map((task, idx) => (
            <div key={idx} className="flex flex-col p-3 bg-slate-900/40 rounded border border-slate-700 hover:border-slate-500 transition-colors">
              <div className="flex justify-between items-start mb-2">
                 <span className="text-xs font-bold text-slate-500 uppercase">{task.department}</span>
                 {task.status === 'Pending' && <span className="w-2 h-2 rounded-full bg-yellow-500"></span>}
              </div>
              <div className="text-sm text-slate-200 font-medium mb-1">{task.description}</div>
              <div className="mt-auto pt-2 text-xs text-slate-500 border-t border-slate-700/50 flex justify-between">
                <span>Est. Time:</span>
                <span className="text-slate-300">{task.estimatedHours} hrs</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Manager */}
      <div className="bg-gradient-to-br from-indigo-950 to-slate-900 rounded-lg p-5 border border-indigo-500/20 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-indigo-100 flex items-center gap-2">
            <Bot className="text-indigo-400" size={20}/> 
            <span>Installation Manager AI</span>
          </h3>
          <button 
            onClick={handleGenerateTicket}
            disabled={loadingAi}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded font-medium transition-all disabled:opacity-50 shadow-lg shadow-indigo-900/50"
          >
            {loadingAi ? 'Analysing Site Data...' : 'Generate Safety Ticket'}
          </button>
        </div>
        
        {installTicket ? (
          <div className="prose prose-invert prose-sm max-w-none bg-slate-950 p-4 rounded-md border border-indigo-900/50 shadow-inner">
            <pre className="whitespace-pre-wrap font-sans text-indigo-100/90 leading-relaxed">{installTicket}</pre>
          </div>
        ) : (
          <div className="text-center py-6 text-slate-500 border-2 border-dashed border-slate-700 rounded-md">
             <p className="mb-1">Ready to analyze installation conditions.</p>
             <p className="text-xs">Wall: {survey.wallType} • Height: {survey.installHeight}ft</p>
          </div>
        )}
      </div>

    </div>
  );
};
