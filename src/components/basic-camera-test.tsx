import QrScanner from 'react-qr-scanner';

export default function BasicCameraTest() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Basic Camera Test</h2>
      <div className="border rounded-lg overflow-hidden">
        <QrScanner
          onDecode={data => {
            console.log('Scanned data:', data);
            alert('Scanned: ' + (data?.text || data));
          }}
          onError={err => {
            console.error('Scanner error:', err);
            alert('Error: ' + (err?.message || err));
          }}
          constraints={{ facingMode: 'environment' }}
          containerStyle={{ width: '300px', height: '300px' }}
          videoStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
      <p className="text-sm text-muted-foreground mt-2">
        Point your camera at a QR code or barcode to test scanning
      </p>
    </div>
  );
}