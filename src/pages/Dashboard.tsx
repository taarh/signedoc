import { useState, useEffect } from "react";
import { 
  Plus, FileText, Clock, CheckCircle, 
  MoreVertical, Upload, X, ExternalLink, 
  ArrowUpRight, Filter, Download, Trash2,
  Calendar as CalendarIcon, Activity
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useDropzone } from "react-dropzone";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { format, formatDistanceToNow } from "date-fns";
import { io } from "socket.io-client";

interface Document {
  id: string;
  name: string;
  status: 'draft' | 'sent' | 'completed' | 'declined';
  created_at: string;
  signers?: any[];
}

interface ActivityEvent {
  id: string;
  document_id: string;
  event: string;
  timestamp: string;
  details?: string;
  user_name?: string;
  doc_name?: string;
}

export function Dashboard() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchDocuments();
    fetchActivity();

    if (location.pathname === "/documents/new") {
      setIsUploadOpen(true);
    }

    const socket = io();
    socket.on("document_updated", () => {
      fetchDocuments();
      fetchActivity();
      toast.success("Document status updated");
    });

    return () => {
      socket.disconnect();
    };
  }, [location.pathname]);

  const fetchActivity = async () => {
    try {
      const res = await fetch("/api/activity?limit=10");
      const data = await res.json();
      setActivity(Array.isArray(data) ? data : []);
    } catch {
      setActivity([]);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      
      const docsWithSigners = await Promise.all(data.map(async (doc: any) => {
        const sRes = await fetch(`/api/documents/${doc.id}`);
        const sData = await sRes.json();
        return { ...doc, signers: sData.signers };
      }));
      
      setDocuments(docsWithSigners);
    } catch (error) {
      toast.error("Failed to fetch documents");
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      toast.success("Document uploaded");
      navigate(`/editor/${data.id}`);
    } catch (error) {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
      setIsUploadOpen(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
  } as any);

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'sent': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'declined': return 'bg-red-50 text-red-700 border-red-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="p-10">
      {/* Hero Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-16">
        <div className="max-w-2xl">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl font-serif font-bold text-slate-900 leading-tight mb-4"
          >
            Your documents, <br />
            <span className="italic text-slate-400">perfectly orchestrated.</span>
          </motion.h1>
          <p className="text-lg text-slate-500 font-medium">
            Manage your signature workflows with precision and elegance. 
            Track every interaction in real-time.
          </p>
        </div>
        
        <div className="flex gap-4">
          <button className="btn-secondary flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button 
            onClick={() => setIsUploadOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Document
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
        {[
          { label: "Pending", value: documents.filter(d => d.status === 'sent').length, icon: Clock, color: "text-blue-600" },
          { label: "Completed", value: documents.filter(d => d.status === 'completed').length, icon: CheckCircle, color: "text-emerald-600" },
          { label: "Drafts", value: documents.filter(d => d.status === 'draft').length, icon: FileText, color: "text-slate-400" },
          { label: "Activity", value: activity.length > 0 ? activity.length : "—", icon: Activity, color: "text-slate-900" },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="premium-card p-8"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-slate-50 rounded-lg">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-3xl font-serif font-bold text-slate-900">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        {/* Document List */}
        <div className="xl:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-serif font-bold text-slate-900">Recent Documents</h2>
            <button className="text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors">View All</button>
          </div>
          
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Document</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Timeline</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center">
                      <div className="max-w-xs mx-auto">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <FileText className="w-8 h-8 text-slate-200" />
                        </div>
                        <p className="text-slate-900 font-bold mb-1">No documents yet</p>
                        <p className="text-slate-400 text-sm">Upload your first PDF to start your workflow.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr 
                      key={doc.id} 
                      className="group hover:bg-slate-50/50 transition-all cursor-pointer"
                      onClick={() => navigate(`/editor/${doc.id}`)}
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-white transition-colors border border-transparent group-hover:border-slate-100">
                            <FileText className="w-6 h-6 text-slate-400" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 mb-1">{doc.name}</p>
                            <div className="flex items-center gap-2">
                              {doc.signers?.slice(0, 2).map((s, idx) => (
                                <div key={idx} className="w-5 h-5 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[8px] font-bold text-slate-500">
                                  {s.name.charAt(0)}
                                </div>
                              ))}
                              {doc.signers && doc.signers.length > 2 && (
                                <span className="text-[10px] text-slate-400">+{doc.signers.length - 2} more</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getStatusStyles(doc.status)}`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-slate-400">
                          <CalendarIcon className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">{format(new Date(doc.created_at), "MMM d, yyyy")}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 text-slate-400 hover:text-slate-900 transition-all">
                            <Download className="w-4 h-4" />
                          </button>
                          <button className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 text-slate-400 hover:text-red-600 transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="space-y-8">
          <h2 className="text-2xl font-serif font-bold text-slate-900">Live Activity</h2>
          <div className="space-y-6">
            {activity.length === 0 ? (
              <p className="text-sm text-slate-400">No activity yet. Upload a document and send it for signing to see events here.</p>
            ) : (
              activity.map((ev) => {
                const label = ev.user_name
                  ? `${ev.user_name} ${ev.event} ${ev.doc_name || ""}`
                  : ev.doc_name
                    ? `Document "${ev.doc_name}" ${ev.event}`
                    : ev.details || `${ev.event}`;
                const time = ev.timestamp
                  ? formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })
                  : "";
                return (
                  <div key={ev.id} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                      <Activity className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-900">
                        {label}
                      </p>
                      {time && <p className="text-xs text-slate-400 mt-1">{time}</p>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden group">
            <div className="relative z-10">
              <h3 className="text-xl font-serif font-bold mb-2">Upgrade to Enterprise</h3>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Get advanced audit trails, custom branding, and unlimited templates.
              </p>
              <button className="w-full py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-100 transition-colors">
                Learn More
              </button>
            </div>
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all" />
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsUploadOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-xl overflow-hidden"
            >
              <div className="p-10 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Upload className="w-10 h-10 text-slate-900" />
                </div>
                <h2 className="text-3xl font-serif font-bold text-slate-900 mb-2">Upload Document</h2>
                <p className="text-slate-500 mb-10">Drag and drop your PDF file to start the signature process.</p>
                
                <div 
                  {...getRootProps()} 
                  className={`border-2 border-dashed rounded-[24px] p-16 transition-all cursor-pointer ${
                    isDragActive ? "border-slate-900 bg-slate-50" : "border-slate-100 hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <input {...getInputProps()} />
                  <p className="text-slate-900 font-bold text-lg">
                    {isUploading ? "Processing..." : "Drop your PDF here"}
                  </p>
                  <p className="text-slate-400 text-sm mt-2">Maximum file size: 25MB</p>
                </div>
              </div>
              
              <div className="p-8 bg-slate-50 flex justify-center gap-4">
                <button 
                  onClick={() => setIsUploadOpen(false)}
                  className="px-8 py-3 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
