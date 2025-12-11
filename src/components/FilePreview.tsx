import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, FileSpreadsheet, Presentation } from "lucide-react";

interface FilePreviewProps {
  fileUrl: string;
  fileType: string | null;
  maxHeight?: string;
  showDownloadButton?: boolean;
}

export const FilePreview = ({ 
  fileUrl, 
  fileType, 
  maxHeight = "600px",
  showDownloadButton = false 
}: FilePreviewProps) => {
  // Determine the actual file type category
  const getFileCategory = (type: string | null): 'image' | 'pdf' | 'document' | 'presentation' | 'spreadsheet' | 'unknown' => {
    if (!type) return 'unknown';
    if (type.startsWith('image') || type === 'image') return 'image';
    if (type === 'pdf' || type === 'application/pdf') return 'pdf';
    if (type === 'document' || type.includes('word') || type === 'text/plain') return 'document';
    if (type === 'presentation' || type.includes('powerpoint')) return 'presentation';
    if (type === 'spreadsheet' || type.includes('excel') || type.includes('sheet')) return 'spreadsheet';
    return 'unknown';
  };

  const category = getFileCategory(fileType);

  // For Office documents, use Microsoft Office Online viewer
  const getOfficeViewerUrl = (url: string) => {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
  };

  // Image preview
  if (category === 'image') {
    return (
      <div className="space-y-2">
        <img 
          src={fileUrl} 
          alt="Assignment reference" 
          className="w-full rounded-lg border shadow-md object-contain"
          style={{ maxHeight }}
        />
        {showDownloadButton && (
          <Button 
            variant="outline" 
            size="sm"
            className="w-full"
            onClick={() => window.open(fileUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            새 탭에서 열기
          </Button>
        )}
      </div>
    );
  }

  // PDF preview - direct iframe
  if (category === 'pdf') {
    return (
      <div className="space-y-2">
        <div className="w-full border rounded-lg overflow-hidden" style={{ height: maxHeight }}>
          <iframe
            src={fileUrl}
            className="w-full h-full"
            title="PDF Reference Material"
          />
        </div>
        {showDownloadButton && (
          <Button 
            variant="outline" 
            size="sm"
            className="w-full"
            onClick={() => window.open(fileUrl, '_blank')}
          >
            <FileText className="h-4 w-4 mr-2" />
            새 탭에서 열기
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    );
  }

  // Word documents
  if (category === 'document') {
    return (
      <div className="space-y-2">
        <div className="w-full border rounded-lg overflow-hidden" style={{ height: maxHeight }}>
          <iframe
            src={getOfficeViewerUrl(fileUrl)}
            className="w-full h-full"
            title="Document Reference Material"
          />
        </div>
        <Button 
          variant="outline" 
          size="sm"
          className="w-full"
          onClick={() => window.open(fileUrl, '_blank')}
        >
          <FileText className="h-4 w-4 mr-2" />
          원본 파일 다운로드
          <ExternalLink className="h-4 w-4 ml-2" />
        </Button>
      </div>
    );
  }

  // PowerPoint presentations
  if (category === 'presentation') {
    return (
      <div className="space-y-2">
        <div className="w-full border rounded-lg overflow-hidden" style={{ height: maxHeight }}>
          <iframe
            src={getOfficeViewerUrl(fileUrl)}
            className="w-full h-full"
            title="Presentation Reference Material"
          />
        </div>
        <Button 
          variant="outline" 
          size="sm"
          className="w-full"
          onClick={() => window.open(fileUrl, '_blank')}
        >
          <Presentation className="h-4 w-4 mr-2" />
          원본 파일 다운로드
          <ExternalLink className="h-4 w-4 ml-2" />
        </Button>
      </div>
    );
  }

  // Excel spreadsheets
  if (category === 'spreadsheet') {
    return (
      <div className="space-y-2">
        <div className="w-full border rounded-lg overflow-hidden" style={{ height: maxHeight }}>
          <iframe
            src={getOfficeViewerUrl(fileUrl)}
            className="w-full h-full"
            title="Spreadsheet Reference Material"
          />
        </div>
        <Button 
          variant="outline" 
          size="sm"
          className="w-full"
          onClick={() => window.open(fileUrl, '_blank')}
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          원본 파일 다운로드
          <ExternalLink className="h-4 w-4 ml-2" />
        </Button>
      </div>
    );
  }

  // Unknown file type - show download button only
  return (
    <Button 
      variant="outline" 
      className="w-full"
      onClick={() => window.open(fileUrl, '_blank')}
    >
      <FileText className="h-4 w-4 mr-2" />
      파일 다운로드
      <ExternalLink className="h-4 w-4 ml-2" />
    </Button>
  );
};
