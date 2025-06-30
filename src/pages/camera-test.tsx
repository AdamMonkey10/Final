import BasicCameraTest from '@/components/basic-camera-test';

export default function CameraTestPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Camera Test</h1>
      </div>
      
      <div className="max-w-md mx-auto">
        <BasicCameraTest />
      </div>
    </div>
  );
}