import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Users, FileText, Send, ChevronLeft, X,
  Type, Calendar, PenTool, Trash2, AlertCircle,
  MousePointer2, Hand, ZoomIn, ZoomOut, Download, Share2, CheckSquare, Paperclip
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Viewer, Worker } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import toast from "react-hot-toast";

interface Signer {
  id: string;
  name: string;
  email: string;
  status: string;
}

interface Field {
  id?: string;
  signer_id: string;
  type: 'signature' | 'initial' | 'date' | 'text' | 'checkbox';
  x: number;
  y: number;
  page: number;
  width: number;
  height: number;
}

function DraggableField({
  field,
  index,
  signerName,
  isSelected,
  onRemove,
}: {
  field: Field;
  index: number;
  signerName: string;
  isSelected: boolean;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `field-${index}`,
    data: { index, field },
  });
  const style = {
    left: field.x,
    top: field.y,
    width: field.width,
    height: field.height,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`field-box group absolute ${isSelected ? "active" : ""} ${isDragging ? "z-50 opacity-90" : ""}`}
    >
      <div className="field-badge">{signerName}</div>
      <span className="uppercase text-[10px] font-black tracking-widest text-slate-900">
        {field.type}
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all shadow-lg"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

export function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState<any>(null);
  const [signers, setSigners] = useState<Signer[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [requestedAttachments, setRequestedAttachments] = useState<{ id: string; label: string }[]>([]);
  const [selectedSignerId, setSelectedSignerId] = useState<string>("");
  const [isAddingSigner, setIsAddingSigner] = useState(false);
  const [newSigner, setNewSigner] = useState({ name: "", email: "" });
  const [isSending, setIsSending] = useState(false);
  const [zoom, setZoom] = useState(1);
  
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    const index = active.data?.current?.index as number | undefined;
    if (index == null || index < 0 || index >= fields.length) return;
    const f = fields[index];
    setFields((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], x: f.x + delta.x, y: f.y + delta.y };
      return next;
    });
  };

  useEffect(() => {
    fetchDocument();
  }, [id]);

  const fetchDocument = async () => {
    try {
      const res = await fetch(`/api/documents/${id}`);
      const data = await res.json();
      setDocument(data);
      setSigners(data.signers || []);
      setFields(data.fields || []);
      setRequestedAttachments(data.requested_attachments || []);
      if (data.signers?.length > 0) {
        setSelectedSignerId(data.signers[0].id);
      }
    } catch (error) {
      toast.error("Failed to load document");
    }
  };

  const handleAddSigner = async () => {
    if (!newSigner.name || !newSigner.email) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const res = await fetch(`/api/documents/${id}/signers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signers: [newSigner] }),
      });
      const data = await res.json();
      const addedSigner = { ...newSigner, id: data[0].id, status: 'pending' };
      setSigners([...signers, addedSigner]);
      setSelectedSignerId(addedSigner.id);
      setNewSigner({ name: "", email: "" });
      setIsAddingSigner(false);
      toast.success("Signer added");
    } catch (error) {
      toast.error("Failed to add signer");
    }
  };

  const addField = (type: Field['type']) => {
    if (!selectedSignerId) {
      toast.error("Please select or add a signer first");
      return;
    }

    const newField: Field = {
      signer_id: selectedSignerId,
      type,
      x: 100,
      y: 100,
      page: 1,
      width: type === 'signature' ? 180 : type === 'checkbox' ? 24 : 120,
      height: type === 'signature' ? 60 : type === 'checkbox' ? 24 : 40,
    };

    setFields([...fields, newField]);
  };

  const updateFieldPosition = (index: number, x: number, y: number) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], x, y };
    setFields(newFields);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleSaveAndSend = async () => {
    if (signers.length === 0) {
      toast.error("Please add at least one signer");
      return;
    }
    if (fields.length === 0) {
      toast.error("Please add at least one signature field");
      return;
    }

    setIsSending(true);
    try {
      await fetch(`/api/documents/${id}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, requested_attachments: requestedAttachments }),
      });

      await fetch(`/api/documents/${id}/send`, {
        method: "POST",
      });

      toast.success("Workflow initiated!");
      navigate("/");
    } catch (error) {
      toast.error("Failed to send document");
    } finally {
      setIsSending(false);
    }
  };

  if (!document) return <div className="flex items-center justify-center h-full">Loading...</div>;

  return (
    <div className="h-full flex flex-col -m-8 bg-[#F3F4F6]">
      {/* Top Navigation Bar */}
      <div className="h-20 bg-slate-900 border-b border-white/5 flex items-center justify-between px-8 shrink-0 z-30">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate("/")} className="text-white/60 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-white/40" />
            <h1 className="text-sm font-bold text-white truncate max-w-[200px]">{document.name}</h1>
            <span className="text-[10px] font-bold bg-white/10 text-white/60 px-2 py-0.5 rounded uppercase tracking-widest">Draft</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white/5 rounded-lg p-1">
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-1.5 text-white/60 hover:text-white hover:bg-white/5 rounded transition-all">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-bold text-white/40 px-2 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1.5 text-white/60 hover:text-white hover:bg-white/5 rounded transition-all">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          <div className="h-6 w-px bg-white/10" />
          <button className="text-white/60 hover:text-white transition-colors">
            <Download className="w-4 h-4" />
          </button>
          <button className="text-white/60 hover:text-white transition-colors">
            <Share2 className="w-4 h-4" />
          </button>
          <button 
            onClick={handleSaveAndSend}
            disabled={isSending}
            className="flex items-center gap-2 px-6 py-2 bg-white text-slate-900 text-xs font-bold rounded-full hover:bg-slate-100 transition-all disabled:opacity-50 active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            {isSending ? "Sending..." : "Send Workflow"}
          </button>
        </div>
      </div>

      {/* Secondary Toolbar */}
      <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-center gap-2 px-6 shrink-0 z-20 shadow-sm">
        <button className="p-2 bg-slate-100 text-slate-900 rounded-lg"><MousePointer2 className="w-4 h-4" /></button>
        <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg"><Hand className="w-4 h-4" /></button>
        <div className="h-6 w-px bg-slate-200 mx-2" />
        {[
          { type: 'signature', icon: PenTool, label: 'Signature' },
          { type: 'initial', icon: Type, label: 'Initials' },
          { type: 'date', icon: Calendar, label: 'Date' },
          { type: 'text', icon: Type, label: 'Text' },
          { type: 'checkbox', icon: CheckSquare, label: 'Checkbox' },
        ].map((tool) => (
          <button
            key={tool.type}
            onClick={() => addField(tool.type as any)}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg transition-all"
          >
            <tool.icon className="w-3.5 h-3.5" />
            {tool.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Signers */}
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col z-10">
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Workflow Signers</h3>
              <button 
                onClick={() => setIsAddingSigner(true)}
                className="p-1.5 bg-slate-50 text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              {signers.map((signer) => (
                <button
                  key={signer.id}
                  onClick={() => setSelectedSignerId(signer.id)}
                  className={`w-full group p-4 rounded-2xl text-left transition-all border ${
                    selectedSignerId === signer.id 
                      ? "bg-slate-900 border-slate-900 shadow-lg shadow-slate-200" 
                      : "bg-white border-slate-100 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      selectedSignerId === signer.id ? "bg-white text-slate-900" : "bg-slate-100 text-slate-500"
                    }`}>
                      {signer.name.charAt(0)}
                    </div>
                    <div className="overflow-hidden">
                      <p className={`text-xs font-bold truncate ${selectedSignerId === signer.id ? "text-white" : "text-slate-900"}`}>
                        {signer.name}
                      </p>
                      <p className={`text-[10px] truncate ${selectedSignerId === signer.id ? "text-white/60" : "text-slate-400"}`}>
                        {signer.email}
                      </p>
                    </div>
                  </div>
                  <div className={`h-1.5 w-full rounded-full overflow-hidden ${selectedSignerId === signer.id ? "bg-white/10" : "bg-slate-50"}`}>
                    <div className={`h-full w-1/3 rounded-full ${selectedSignerId === signer.id ? "bg-white" : "bg-slate-200"}`} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-200">
            <div className="flex items-center gap-3 text-slate-400 mb-4">
              <AlertCircle className="w-4 h-4" />
              <p className="text-[10px] font-medium leading-relaxed">
                Assign fields to each signer by selecting them from the list above first.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-200">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Pièces jointes requises</h3>
              <p className="text-[10px] text-slate-500 mb-3">Documents à fournir par le signataire (ex. carte d&apos;identité)</p>
              {requestedAttachments.map((item) => (
                <div key={item.id} className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => setRequestedAttachments((prev) => prev.map((p) => p.id === item.id ? { ...p, label: e.target.value } : p))}
                    placeholder="Ex. Carte d'identité"
                    className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setRequestedAttachments((prev) => prev.filter((p) => p.id !== item.id))}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRequestedAttachments((prev) => [...prev, { id: crypto.randomUUID(), label: "" }])}
                className="flex items-center gap-2 mt-2 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                <Paperclip className="w-3.5 h-3.5" />
                Ajouter une pièce jointe
              </button>
            </div>
          </div>
        </aside>

        {/* PDF Viewer Area */}
        <div className="flex-1 bg-slate-100 overflow-auto p-16 relative" ref={pdfContainerRef}>
          <div 
            className="max-w-4xl mx-auto relative transition-transform duration-300 origin-top"
            style={{ transform: `scale(${zoom})` }}
          >
            <div className="pdf-page-shadow">
              <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                <Viewer 
                  fileUrl={`/api/documents/${document.id}/file`}
                  plugins={[defaultLayoutPluginInstance]}
                />
              </Worker>
            </div>

            {/* Fields Overlay - Dnd Kit for drag & drop */}
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              {fields.map((field, index) => {
                const signer = signers.find((s) => s.id === field.signer_id);
                return (
                  <DraggableField
                    key={field.id ?? index}
                    field={field}
                    index={index}
                    signerName={signer?.name ?? "Unknown"}
                    isSelected={selectedSignerId === field.signer_id}
                    onRemove={() => removeField(index)}
                  />
                );
              })}
            </DndContext>
          </div>
        </div>
      </div>

      {/* Add Signer Modal */}
      <AnimatePresence>
        {isAddingSigner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingSigner(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <h2 className="text-2xl font-serif font-bold text-slate-900">Add Signer</h2>
                <button onClick={() => setIsAddingSigner(false)} className="p-2 text-slate-400 hover:text-slate-900 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Full Name</label>
                  <input 
                    type="text" 
                    value={newSigner.name}
                    onChange={(e) => setNewSigner({ ...newSigner, name: e.target.value })}
                    placeholder="e.g. John Wick"
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 outline-none text-sm transition-all placeholder:text-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Email Address</label>
                  <input 
                    type="email" 
                    value={newSigner.email}
                    onChange={(e) => setNewSigner({ ...newSigner, email: e.target.value })}
                    placeholder="e.g. john@continental.com"
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 outline-none text-sm transition-all placeholder:text-slate-300"
                  />
                </div>
              </div>
              <div className="p-8 bg-slate-50 flex justify-end gap-3">
                <button 
                  onClick={() => setIsAddingSigner(false)}
                  className="px-6 py-3 text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddSigner}
                  className="btn-primary"
                >
                  Add to Workflow
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
