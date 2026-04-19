import { useState, useRef, useEffect } from 'react';
import { Upload, FileDown, CheckCircle, AlertCircle, Loader2, X, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

const FORMAS_PAGO_VALIDAS = [
  'Contado - Efectivo', 'Transferencia Bancaria', 'Tarjeta de Débito', 'Tarjeta de Crédito', 'Mercado Pago', 'Otro'
];

export default function BulkImportModal({ isOpen, onClose, onSave }) {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const resetState = () => {
    setFile(null);
    setParsedData([]);
    setErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (!loading) {
      resetState();
      onClose();
    }
  };

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') handleClose(); };
    if (isOpen) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { Cliente: "Juan Perez", CUIT: "20-12345678-9", Monto: 15000.50, Forma_Pago: "Transferencia Bancaria" },
      { Cliente: "Consumidor Final Ej", CUIT: "", Monto: 5000, Forma_Pago: "Mercado Pago" }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas");
    XLSX.writeFile(wb, "CMD_Plantilla_Ventas.xlsx");
  };

  const processFile = (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setErrors([]);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

        const validVentas = [];
        const foundErrors = [];

        rows.forEach((row, index) => {
          const rowNum = index + 2; // +1 de índice, +1 del header
          
          const cliente = String(row.Cliente || '').trim();
          const cuit = String(row.CUIT || '').trim();
          const montoRaw = row.Monto;
          let formaPago = String(row.Forma_Pago || '').trim();

          if (!cliente) {
             foundErrors.push(`Fila ${rowNum}: Cliente es obligatorio.`);
             return;
          }
          
          const monto = parseFloat(montoRaw);
          if (isNaN(monto) || monto <= 0) {
             foundErrors.push(`Fila ${rowNum}: Monto inválido para ${cliente}.`);
             return;
          }

          if (!formaPago || !FORMAS_PAGO_VALIDAS.includes(formaPago)) {
            formaPago = 'Contado - Efectivo';
          }

          validVentas.push({
            fecha: new Date().toISOString(),
            cliente: cliente,
            monto: monto,
            status: 'pendiente',
            datos_fiscales: {
              cuit: cuit || null,
              forma_pago: formaPago,
            }
          });
        });

        setParsedData(validVentas);
        setErrors(foundErrors);
      } catch (err) {
        setErrors(["Error al leer el archivo. Verificá que sea un archivo válido (.xlsx, .csv)."]);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirm = async () => {
    if (parsedData.length === 0) return;
    setLoading(true);
    try {
      await onSave(parsedData);
      handleClose();
    } catch (err) {
      setErrors([err.message || 'Error al guardar ventas en la base de datos']);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/20 backdrop-blur-sm flex items-center justify-center p-3 animate-fade-in transition-all" onClick={handleClose}>
      <div 
        className="bg-[#F9F7F2] rounded-2xl shadow-xl border border-white/50 w-full max-w-[420px] flex flex-col relative animate-slide-down overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white/60 backdrop-blur-sm px-6 py-4 flex items-center justify-between border-b border-border/40 shrink-0">
          <div>
            <span className="text-[10px] font-medium text-[#3460A8] mb-0.5 block" style={{ fontFamily: 'Inter' }}>
              Importación Masiva
            </span>
            <h2 className="text-base font-semibold text-[#000000] leading-none" style={{ fontFamily: 'Montserrat' }}>
              Cargar Ventas
            </h2>
          </div>
          <button onClick={handleClose} disabled={loading} className="w-8 h-8 rounded-full bg-white border border-border flex items-center justify-center text-text-muted hover:text-[#C0443C] hover:border-[#C0443C] transition-all cursor-pointer">
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 bg-[#F9F7F2]">
          
          {/* Default State: Upload Box */}
          {!file && (
            <div className="flex flex-col gap-3">
              <div className="bg-white border border-border/50 rounded-xl px-4 py-3 flex items-center justify-between shadow-sm">
                <div>
                  <h4 className="text-sm font-medium text-[#000000]" style={{ fontFamily: 'Inter' }}>Plantilla requerida</h4>
                  <p className="text-[10px] text-text-muted mt-0.5">Descargá el formato oficial</p>
                </div>
                <button 
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3460A8] text-white rounded-lg text-[11px] font-medium transition-all cursor-pointer hover:bg-[#2F528F]"
                  style={{ fontFamily: 'Inter' }}
                >
                  <FileDown size={14} className="text-white/70" /> Descargar
                </button>
              </div>

              <div 
                className="border border-dashed border-[#3460A8]/20 bg-[#3460A8]/5 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#3460A8]/10 transition-colors"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-10 h-10 bg-white rounded-full shadow-sm border border-[#3460A8]/10 flex items-center justify-center mb-3 text-[#3460A8]">
                  <Upload size={18} />
                </div>
                <h3 className="text-sm font-medium text-[#000000] mb-1" style={{ fontFamily: 'Inter' }}>Subir archivo (.xlsx o .csv)</h3>
                <p className="text-[11px] text-text-muted max-w-[200px]">Arrastrá acá o hacé clic para explorar tus carpetas.</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={(e) => processFile(e.target.files[0])}
                />
              </div>
            </div>
          )}

          {/* Loading or Processing State */}
          {(file || parsedData.length > 0 || errors.length > 0) && (
            <div className="flex flex-col gap-3 animate-fade-in">
              <div className="bg-white border border-border/50 rounded-xl px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3 w-full">
                  <div className="w-8 h-8 bg-[#2D8F5E]/10 rounded-lg flex items-center justify-center shrink-0">
                    <FileSpreadsheet size={16} className="text-[#2D8F5E]" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h4 className="text-xs font-medium text-[#000000] truncate" style={{ fontFamily: 'Inter' }}>{file.name}</h4>
                    <p className="text-[10px] text-text-muted mt-0.5">
                       {loading ? 'Procesando...' : `${parsedData.length} filas leídas`}
                    </p>
                  </div>
                </div>
                {!loading && (
                   <button onClick={resetState} className="text-[11px] text-[#C0443C] shrink-0 ml-3 hover:underline cursor-pointer" style={{ fontFamily: 'Inter' }}>Cancelar</button>
                )}
              </div>

              {errors.length > 0 && (
                <div className="bg-[#C0443C]/5 border border-[#C0443C]/20 rounded-xl p-3 max-h-28 overflow-y-auto">
                  <h4 className="text-[11px] font-medium text-[#C0443C] flex items-center gap-1 mb-1.5"><AlertCircle size={12} /> Alertas ({errors.length})</h4>
                  <ul className="text-[11px] text-[#C0443C]/80 list-disc list-inside space-y-0.5">
                    {errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}

              {parsedData.length > 0 && !loading && (
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="bg-white border border-border/50 rounded-xl p-4 shadow-sm flex flex-col justify-center">
                    <span className="text-[10px] text-text-muted mb-0.5" style={{ fontFamily: 'Inter' }}>Ventas válidas</span>
                    <span className="text-lg font-medium text-[#000000]" style={{ fontFamily: 'Inter' }}>{parsedData.length}</span>
                  </div>
                  <div className="bg-white border border-border/50 rounded-xl p-4 shadow-sm flex flex-col justify-center">
                    <span className="text-[10px] text-text-muted mb-0.5" style={{ fontFamily: 'Inter' }}>Suma de importes</span>
                    <span className="text-lg font-medium text-[#2D8F5E]" style={{ fontFamily: 'Inter' }}>
                       $ {parsedData.reduce((acc, curr) => acc + curr.monto, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        {file && !loading && parsedData.length > 0 && (
          <div className="bg-white/80 backdrop-blur-md px-5 py-4 border-t border-border/40 shrink-0">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="w-full h-10 rounded-xl bg-[#3460A8] text-white flex items-center justify-center gap-2 font-medium text-xs hover:shadow-md hover:bg-[#2F528F] transition-all duration-300 disabled:opacity-50 cursor-pointer"
              style={{ fontFamily: 'Inter' }}
            >
              <CheckCircle size={16} className="text-white/60" />
              Importar {parsedData.length} ventas ahora
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
