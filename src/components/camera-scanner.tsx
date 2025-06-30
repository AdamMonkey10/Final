import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, ArrowLeft, Check } from 'lucide-react';

// Simplified scanner component for demo
function QuickScanner({ onResult, onClose }) {
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-white p-4 flex items-center justify-between">
        <Button variant="ghost" onClick={onClose}>
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </Button>
        <h2 className="font-semibold">Scan Code</h2>
        <div></div>
      </div>
      
      {/* Scanner area */}
      <div className="flex-1 relative bg-gray-900 flex items-center justify-center">
        <div className="w-80 h-48 border-2 border-red-500 rounded-lg relative">
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-white text-sm font-bold">
            Position code in frame
          </div>
          
          {/* Simulate scanning */}
          <div className="absolute inset-4 border border-red-400 animate-pulse"></div>
          
          {/* Demo: Click to simulate scan */}
          <button 
            onClick={() => onResult('DEMO12345')}
            className="absolute inset-0 flex items-center justify-center text-white bg-black bg-opacity-50 rounded-lg"
          >
            <div className="text-center">
              <Camera className="h-8 w-8 mx-auto mb-2" />
              <div className="text-sm">Click to simulate scan</div>
            </div>
          </button>
        </div>
      </div>
      
      {/* Instructions */}
      <div className="bg-white p-4">
        <p className="text-center text-sm text-gray-600">
          Hold your device steady and position the code within the frame
        </p>
      </div>
    </div>
  );
}

function App() {
  const [showScanner, setShowScanner] = useState(false);
  const [codeValue, setCodeValue] = useState('');
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [scanSuccess, setScanSuccess] = useState(false);

  const handleScanResult = (scannedCode) => {
    console.log('📱 App: Received scanned code:', scannedCode);
    
    // 1. Store the scanned code
    setLastScannedCode(scannedCode);
    
    // 2. Fill the input field
    setCodeValue(scannedCode);
    
    // 3. Show success feedback
    setScanSuccess(true);
    
    // 4. Auto-close scanner after brief delay
    setTimeout(() => {
      setShowScanner(false);
      setScanSuccess(false);
    }, 1500);
  };

  const openScanner = () => {
    setShowScanner(true);
    setScanSuccess(false);
  };

  const closeScanner = () => {
    setShowScanner(false);
    setScanSuccess(false);
  };

  const handleSubmit = () => {
    if (codeValue.trim()) {
      alert(`Submitting code: ${codeValue}`);
      // Here you would typically send to your API
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-center mb-6">Code Entry App</h1>
        
        {/* Code input section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter or Scan Code
            </label>
            <div className="flex gap-2">
              <Input
                value={codeValue}
                onChange={(e) => setCodeValue(e.target.value)}
                placeholder="Type code or scan..."
                className="flex-1"
              />
              <Button 
                onClick={openScanner}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Camera className="h-4 w-4" />
                Scan
              </Button>
            </div>
          </div>

          {/* Success feedback */}
          {lastScannedCode && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center gap-2 text-green-800">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Last scanned: {lastScannedCode}
                </span>
              </div>
            </div>
          )}

          {/* Submit button */}
          <Button 
            onClick={handleSubmit}
            className="w-full"
            disabled={!codeValue.trim()}
          >
            Submit Code
          </Button>
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">How to use:</h3>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. Type code manually OR click "Scan" button</li>
            <li>2. If scanning: position code in the red frame</li>
            <li>3. Scanner will auto-close and fill the field</li>
            <li>4. Click "Submit Code" when ready</li>
          </ol>
        </div>
      </div>

      {/* Scanner overlay */}
      {showScanner && (
        <QuickScanner 
          onResult={handleScanResult}
          onClose={closeScanner}
        />
      )}

      {/* Scan success overlay */}
      {scanSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg text-center">
            <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-green-800 mb-2">
              Scan Successful!
            </h3>
            <p className="text-gray-600">
              Code captured: {lastScannedCode}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;