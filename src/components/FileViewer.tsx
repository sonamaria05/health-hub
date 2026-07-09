import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, ExternalLink, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errorUtils';

interface FileViewerProps {
  filePath: string;
  fileName: string;
  onClose: () => void;
}

export default function FileViewer({ filePath, fileName, onClose }: FileViewerProps) {
  const [loading, setLoading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    const loadSignedUrl = async () => {
      setUrlLoading(true);
      // Short TTL: this is regenerated fresh each time the viewer opens, so
      // there's no need for the link to remain valid for long after that.
      const { data, error } = await supabase.storage
        .from('medical-reports')
        .createSignedUrl(filePath, 5 * 60);

      if (ignore) return;

      if (error) {
        console.error('Error creating signed URL:', error);
        setFileUrl(null);
      } else {
        setFileUrl(data.signedUrl);
      }

      setUrlLoading(false);
    };

    void loadSignedUrl();

    return () => {
      ignore = true;
    };
  }, [filePath]);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage.from('medical-reports').download(filePath);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      console.error('Download error:', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(fileName);
  const isPdf = /\.pdf$/i.test(fileName);

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="font-heading font-semibold text-sm truncate">{fileName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download
            </Button>
            {fileUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" /> Open
                </a>
              </Button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[400px]">
          {urlLoading ? (
            <div className="text-center text-muted-foreground">
              <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin" />
              <p className="text-sm">Preparing secure preview...</p>
            </div>
          ) : isImage && fileUrl ? (
            <img src={fileUrl} alt={fileName} className="max-w-full max-h-full object-contain rounded-lg" />
          ) : isPdf && fileUrl ? (
            <iframe src={fileUrl} className="w-full h-full min-h-[500px] rounded-lg" title={fileName} />
          ) : (
            <div className="text-center text-muted-foreground">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="font-heading font-semibold">Preview not available</p>
              <p className="text-sm mt-1">Use the download button to view this file.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
