import { useState } from 'react';
import { MedicalRecord, typeLabels } from '@/lib/mockData';
import { FileText, Pill, Image, Receipt, ClipboardList, Trash2, Eye, FilePenLine } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMotionPreset } from '@/lib/motion';
import FileViewer from './FileViewer';

const typeIcons: Record<string, React.ElementType> = {
  blood_test: FileText,
  prescription: Pill,
  imaging: Image,
  bill: Receipt,
  discharge_summary: ClipboardList,
};

const statusStyles = {
  normal: 'bg-success/10 text-success',
  attention: 'bg-warning/10 text-warning',
  critical: 'bg-destructive/10 text-destructive',
};

interface RecordCardProps {
  record: MedicalRecord;
  onDelete?: (id: string) => void;
  onEdit?: (record: MedicalRecord) => void;
  showDetails?: boolean;
}

export default function RecordCard({ record, onDelete, onEdit, showDetails = false }: RecordCardProps) {
  const Icon = typeIcons[record.type] || FileText;
  const [viewFile, setViewFile] = useState(false);
  const { fadeInUp } = useMotionPreset();

  return (
    <>
      <motion.div
        layout
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow group"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-heading font-semibold text-sm truncate">{record.title}</h3>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusStyles[record.status]}`}>
                {record.status}
              </span>
              {record.processingStatus && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {record.processingStatus.replace('_', ' ')}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {record.patientName ? `${record.patientName} | ` : ''}{record.doctor} | {record.hospital}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                {typeLabels[record.type]}
              </span>
              <span className="text-[10px] text-muted-foreground">{record.date}</span>
              {record.amount && (
                <span className="text-[10px] font-medium text-foreground">Rs. {record.amount.toLocaleString()}</span>
              )}
            </div>

            {record.summary && (
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{record.summary}</p>
            )}

            {showDetails && record.extractedData && (
              <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2">
                {Object.entries(record.extractedData).map(([key, data]) => (
                  <div key={key} className="text-xs">
                    <span className="text-muted-foreground">{key}:</span>{' '}
                    <span className={`font-medium ${data.status === 'normal' ? 'text-success' : data.status === 'high' ? 'text-destructive' : 'text-warning'}`}>
                      {data.value} {data.unit}
                    </span>
                    <span className="text-muted-foreground text-[10px] ml-1">({data.normalRange})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onEdit && (
              <button
                onClick={() => onEdit(record)}
                className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                title="Edit record"
                aria-label="Edit record"
              >
                <FilePenLine className="w-3.5 h-3.5" />
              </button>
            )}
            {record.filePath && (
              <button
                onClick={() => setViewFile(true)}
                className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                title="View file"
                aria-label="View file"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(record.id)}
                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                title="Delete record"
                aria-label="Delete record"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {viewFile && record.filePath && (
        <FileViewer filePath={record.filePath} fileName={record.fileName} onClose={() => setViewFile(false)} />
      )}
    </>
  );
}
