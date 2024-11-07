import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface StockNotificationProps {
  newQuantity: number;
  minQuantity: number;
  emailDraft: string;
}

export function StockNotification({ newQuantity, minQuantity, emailDraft }: StockNotificationProps) {
  return (
    <div className="space-y-2">
      <p>This action will put stock ({newQuantity}) below minimum ({minQuantity})</p>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => {
          navigator.clipboard.writeText(emailDraft);
          toast.success('Email draft copied to clipboard');
        }}
      >
        Copy Email Draft
      </Button>
    </div>
  );
}