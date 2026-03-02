import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Viewer, Worker } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { SignaturePad } from "../components/SignaturePad";
import { 
  CheckCircle, AlertCircle, FileText, 
  ShieldCheck, PenTool, Lock, Info,
  ChevronDown, Download, Printer
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import toast from "react-hot-toast";

export function Sign() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  useEffect(() => {
    fetchSignData();
  }, [token]);

  const fetchSignData = async () => {
    try {
      const res = await fetch(`/api/sign/${token}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setData(data);
    } catch (error) {
      toast.error("Invalid or expired signature link");
    }
  };

  const handleFieldClick = (fieldId: string) => {
    setActiveFieldId(fieldId);
    setIsSigning(true);
  };

  const handleSaveSignature = (dataUrl: string) => {
    if (activeFieldId) {
      setSignatures({ ...signatures, [activeFieldId]: dataUrl });
    }
    setIsSigning(false);
    setActiveFieldId(null);
  };

  const handleSubmit = async () => {
    const requiredFields = data.fields.filter((f: any) => f.type === 'signature');
    const signedCount = Object.keys(signatures).length;

    if (signedCount < requiredFields.length) {
      toast.error("Please sign all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatures: Object.entries(signatures).map(([fieldId, value]) => ({ fieldId, value }))
        }),
      });

      if (res.ok) {
        setIsCompleted(true);
        toast.success("Document signed successfully!");
      }
    } catch (error) {
      toast.error("Failed to submit signature");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!data) return <div className="flex items-center justify-center h-screen bg-[#FDFDFD]">Loading...</div>;

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg w-full bg-white rounded-[40px] shadow-2xl p-12 text-center border border-slate-50"
        >
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle className="w-12 h-12 text-emerald-500" />
          </div>
          <h1 className="text-4xl font-serif font-bold text-slate-900 mb-4">Signature Recorded</h1>
          <p className="text-slate-500 mb-10 leading-relaxed">
            Thank you, <span className="font-bold text-slate-900">{data.signer.name}</span>. 
            Your signature has been securely encrypted and added to the audit trail. 
            A final copy will be delivered to your inbox shortly.
          </p>
          <div className="space-y-4">
            <button className="btn-primary w-full py-4 text-lg">
              Download Final Document
            </button>
            <button 
              onClick={() => window.close()}
              className="w-full py-4 text-slate-400 font-bold hover:text-slate-900 transition-colors"
            >
              Close Secure Session
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col">
      {/* Immersive Header */}
      <header className="h-20 bg-slate-900 text-white flex items-center justify-between px-10 sticky top-0 z-30 shadow-2xl shadow-slate-900/20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/10">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <div>
            <span className="font-serif font-bold text-lg block leading-none">SignFlow Secure</span>
            <div className="flex items-center gap-2 mt-1">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">End-to-End Encrypted</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="text-right hidden md:block">
            <p className="text-xs font-bold text-white">{data.signer.name}</p>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{data.signer.email}</p>
          </div>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-10 py-3 bg-white text-slate-900 font-bold rounded-full hover:bg-slate-100 transition-all shadow-xl shadow-white/5 active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? "Finalizing..." : "Complete Signing"}
          </button>
        </div>
      </header>

      {/* Secondary Info Bar */}
      <div className="bg-white border-b border-slate-200 px-10 py-3 flex items-center justify-between z-20 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-slate-400">
            <FileText className="w-4 h-4" />
            <span className="text-xs font-bold text-slate-900">{data.doc.name}</span>
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2 text-slate-400">
            <Info className="w-4 h-4" />
            <span className="text-xs font-medium">Please review all pages before signing.</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><Download className="w-4 h-4" /></button>
          <button className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><Printer className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Immersive Signing Area */}
      <div className="flex-1 flex flex-col items-center p-12 overflow-auto relative">
        <div className="max-w-5xl w-full bg-white shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] relative mb-20">
          <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
            <Viewer 
              fileUrl={`/${data.doc.file_path}`}
              plugins={[defaultLayoutPluginInstance]}
            />
          </Worker>

          {/* Fields Overlay */}
          {data.fields.map((field: any) => (
            <div
              key={field.id}
              onClick={() => handleFieldClick(field.id)}
              style={{ 
                left: field.x, 
                top: field.y, 
                width: field.width, 
                height: field.height 
              }}
              className={`absolute border-2 flex items-center justify-center cursor-pointer transition-all duration-300 group ${
                signatures[field.id] 
                  ? 'border-emerald-500 bg-emerald-50/20' 
                  : 'border-slate-900 bg-white shadow-lg hover:bg-slate-50'
              }`}
            >
              {signatures[field.id] ? (
                <img src={signatures[field.id]} alt="Signature" className="max-h-[80%] max-w-[80%] object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <PenTool className="w-5 h-5 text-slate-900" />
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Sign Here</span>
                </div>
              )}
              
              {!signatures[field.id] && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-slate-900"></span>
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Signature Modal */}
      <AnimatePresence>
        {isSigning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSigning(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-xl"
            >
              <SignaturePad 
                onSave={handleSaveSignature}
                onCancel={() => setIsSigning(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Progress Hub */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 glass-panel px-10 py-5 rounded-[32px] flex items-center gap-10 z-30 shadow-2xl border-white/40">
        <div className="flex items-center gap-5">
          <div className="relative w-12 h-12">
            <svg className="w-full h-full" viewBox="0 0 36 36">
              <path
                className="text-slate-100 stroke-current"
                strokeWidth="3"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-slate-900 stroke-current transition-all duration-1000"
                strokeWidth="3"
                strokeDasharray={`${(Object.keys(signatures).length / data.fields.length) * 100}, 100`}
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-900">
              {Math.round((Object.keys(signatures).length / data.fields.length) * 100)}%
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">
              {Object.keys(signatures).length} of {data.fields.length} fields signed
            </p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5 uppercase tracking-widest">Required actions remaining</p>
          </div>
        </div>
        <div className="h-10 w-px bg-slate-100" />
        <button 
          onClick={handleSubmit}
          className="flex items-center gap-2 text-xs font-bold text-slate-900 hover:text-slate-600 transition-colors group"
        >
          Next Action
          <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
}
