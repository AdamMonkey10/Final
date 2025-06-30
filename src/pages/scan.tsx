import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { QrCode, RefreshCw, Home, Loader2, CheckCircle, AlertCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { getItemBySystemCode } from '@/lib/firebase/items';
import { CameraScanner } from '@/components/camera-scanner';
import { InstructionPanel } from '@/components/instruction-panel';
import { useInstructions } from '@/contexts/InstructionsContext';
import { useFirebase } from '@/contexts/FirebaseContext';
import { useOperator } from '@/contexts/OperatorContext';
import { Badge } from '@/components/ui/badge';
import type { Item } from '@/types/warehouse';

export default function ScanPage() {
  const navigate = useNavigate();
  const { user, authLoading } = useFirebase();
  const { selectedOperator } = useOperator();
  const { showInstructions } = useInstructions();
  const [loading, setLoading] = useState(false);
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'found' | 'not-found'>('idle');
  const [lastScannedCode, setLastScannedCode] = useState<string>('');
  const manualInputRef = useRef<HTMLInputElement>(null);

  const handleScanResult = async (scannedCode: string) => {
    console.log('Scan result received:', scannedCode);
    
    if (!selectedOperator) {
      toast.error('Please select an operator before scanning');
      return;
    }

    if (!scannedCode.trim()) {
      toast.error('Invalid barcode scanned');
      return;
    }

    // Set the scanned code and process it
    setLastScannedCode(scannedCode.trim());
    setManualInput(scannedCode.trim());
    
    // Process immediately and navigate
    await processScannedCode(scannedCode.trim());
  };

  const processScannedCode = async (scannedCode: string) => {
    setSearchStatus('searching');
    setLoading(true);

    try {
      const item = await getItemBySystemCode(scannedCode);
      
      if (!item) {
        setSearchStatus('not-found');
        toast.error(`Item not found: ${scannedCode}`);
        return;
      }

      setSearchStatus('found');
      toast.success(`Found: ${item.itemCode}`);

      // Close scan dialog
      setShowScanDialog(false);

      // Navigate to process page with item data
      navigate('/process-scan', { 
        state: { scannedItem: item }
      });
      
    } catch (error) {
      console.error('Error processing scan:', error);
      setSearchStatus('not-found');
      toast.error('Failed to process scan');
    } finally {
      setLoading(false);
    }
  };

  const handleManualScan = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!manualInput.trim()) {
      toast.error('Please enter a barcode');
      return;
    }

    await processScannedCode(manualInput.trim());
  };

  const resetState = () => {
    setManualInput('');
    setSearchStatus('idle');
    setLastScannedCode('');
  };

  const getSearchStatusIcon = () => {
    switch (searchStatus) {
      case 'searching':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'found':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'not-found':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Search className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const instructionSteps = [
    {
      title: "Select Operator",
      description: "Ensure an operator is selected from the top-right corner before scanning any items.",
      type: "warning" as const
    },
    {
      title: "Scan Item",
      description: "Click 'Start Scanning' and scan or enter a barcode. The system will process it and navigate to the next step.",
      type: "info" as const
    },
    {
      title: "Automatic Navigation",
      description: "After scanning, you'll be taken to the processing page to complete the workflow.",
      type: "success" as const
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Scan</h1>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/')} variant="outline">
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <Button onClick={resetState} variant="outline" disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Instructions Panel */}
      {showInstructions && (
        <InstructionPanel
          title="Warehouse Scanner"
          description="Scan barcodes to identify items. The system will automatically navigate you through the placement or picking workflow."
          steps={instructionSteps}
          onClose={() => {}}
          className="mb-6"
        />
      )}

      {!selectedOperator && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-yellow-800">
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                Action Required
              </Badge>
              <span className="text-sm">Please select an operator from the top-right corner before scanning items.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Status Card */}
      {(lastScannedCode || searchStatus !== 'idle') && (
        <Card className={`border-2 ${
          searchStatus === 'found' ? 'border-green-200 bg-green-50' :
          searchStatus === 'not-found' ? 'border-red-200 bg-red-50' :
          searchStatus === 'searching' ? 'border-blue-200 bg-blue-50' :
          'border-gray-200'
        }`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              {getSearchStatusIcon()}
              <div className="flex-1">
                <div className="font-medium">
                  {searchStatus === 'searching' && `Searching: ${lastScannedCode}`}
                  {searchStatus === 'found' && `Found: ${lastScannedCode} - Navigating...`}
                  {searchStatus === 'not-found' && `Not found: ${lastScannedCode}`}
                  {searchStatus === 'idle' && lastScannedCode && `Last: ${lastScannedCode}`}
                </div>
                {searchStatus === 'found' && (
                  <div className="text-sm text-green-600 mt-1">
                    Item identified successfully! Taking you to the processing page...
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Scan Item Barcode
          </CardTitle>
          <CardDescription>
            Scan or enter a barcode to identify items. You'll be automatically taken to the processing workflow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <QrCode className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Ready to Scan</p>
            <p className="text-sm text-muted-foreground mb-6">
              Click below to start scanning barcodes
            </p>
            <Button 
              onClick={() => setShowScanDialog(true)}
              size="lg"
              className="w-full max-w-md"
              disabled={!selectedOperator || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <QrCode className="h-5 w-5 mr-2" />
                  Start Scanning
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scan Input Dialog */}
      <Dialog open={showScanDialog} onOpenChange={setShowScanDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Scan Item Barcode</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Manual Input Section */}
            <form onSubmit={handleManualScan} className="space-y-4">
              <div className="relative">
                <QrCode className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={manualInputRef}
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Enter barcode or scan with camera..."
                  className="pl-9 text-lg h-12"
                  autoComplete="off"
                  autoFocus
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full h-12 text-lg" disabled={loading || !selectedOperator || !manualInput.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Process Barcode'
                )}
              </Button>
            </form>
            
            {/* Camera Scanner Section */}
            <div className="border-t pt-6">
              <div className="text-sm text-muted-foreground mb-4 text-center">
                Or use camera to scan:
              </div>
              <CameraScanner
                onResult={handleScanResult}
                onError={(error) => toast.error(`Camera error: ${error}`)}
                isActive={showScanDialog}
                autoComplete={false}
                className="w-full"
              />
            </div>
            
            {selectedOperator && (
              <div className="text-xs text-center text-muted-foreground border-t pt-4">
                Operator: {selectedOperator.name}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}