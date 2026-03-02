import React, { useRef, useState, useEffect } from "react";
import { X, RotateCcw, Check, PenTool, Type, MousePointer2 } from "lucide-react";
import { motion } from "motion/react";

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

export function SignaturePad({ onSave, onCancel }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeTab, setActiveTab] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    }
  }, [activeTab]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.beginPath();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.moveTo(x, y);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setTypedName("");
  };

  const handleSave = () => {
    if (activeTab === 'draw') {
      const canvas = canvasRef.current;
      if (canvas) {
        onSave(canvas.toDataURL());
      }
    } else {
      // Create a canvas for the typed signature
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = '48px "Cormorant Garamond", serif';
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(typedName || "Your Signature", canvas.width / 2, canvas.height / 2);
        onSave(canvas.toDataURL());
      }
    }
  };

  return (
    <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-100">
      <div className="p-8 border-b border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h2 className="text-2xl font-serif font-bold text-slate-900">Create Signature</h2>
          <div className="flex bg-slate-50 p-1 rounded-full">
            <button 
              onClick={() => setActiveTab('draw')}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeTab === 'draw' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <PenTool className="w-3 h-3" />
              Draw
            </button>
            <button 
              onClick={() => setActiveTab('type')}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeTab === 'type' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Type className="w-3 h-3" />
              Type
            </button>
          </div>
        </div>
        <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-900 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-10">
        {activeTab === 'draw' ? (
          <div className="relative group">
            <canvas
              ref={canvasRef}
              width={500}
              height={200}
              onMouseDown={startDrawing}
              onMouseUp={stopDrawing}
              onMouseMove={draw}
              onTouchStart={startDrawing}
              onTouchEnd={stopDrawing}
              onTouchMove={draw}
              className="w-full h-[200px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] cursor-crosshair transition-colors group-hover:border-slate-300"
            />
            <div className="absolute bottom-6 right-6 flex items-center gap-3">
              <button 
                onClick={clear}
                className="p-3 bg-white text-slate-400 hover:text-red-500 rounded-2xl shadow-lg border border-slate-100 transition-all active:scale-95"
                title="Clear signature"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20 group-hover:opacity-10 transition-opacity">
              <MousePointer2 className="w-12 h-12 text-slate-900" />
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="relative">
              <input 
                type="text" 
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Type your full name..."
                className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[32px] focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none text-lg transition-all placeholder:text-slate-300"
              />
            </div>
            <div className="h-[120px] bg-slate-50 rounded-[32px] flex items-center justify-center border border-slate-100">
              <p className="text-5xl font-serif italic text-slate-900 opacity-80">
                {typedName || "Your Signature"}
              </p>
            </div>
          </div>
        )}
        
        <div className="mt-10 flex items-center gap-4 text-slate-400">
          <Check className="w-4 h-4 text-emerald-500" />
          <p className="text-[10px] font-medium leading-relaxed">
            By clicking "Adopt & Sign", I agree that this signature will be as legally binding as a handwritten signature.
          </p>
        </div>
      </div>

      <div className="p-10 bg-slate-50 flex justify-end gap-4">
        <button 
          onClick={onCancel}
          className="px-8 py-4 text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors"
        >
          Cancel
        </button>
        <button 
          onClick={handleSave}
          className="px-10 py-4 bg-slate-900 text-white font-bold rounded-full hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
        >
          Adopt & Sign
        </button>
      </div>
    </div>
  );
}
