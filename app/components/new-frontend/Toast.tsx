import { CheckCircle2 } from 'lucide-react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}

export function Toast({ message, isVisible, onClose }: ToastProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2">
      <button
        type="button"
        onClick={onClose}
        className="bg-[#10a37f] text-white px-4 py-3 rounded-md shadow-lg flex items-center gap-3 min-w-[280px] border-none appearance-none"
      >
        <CheckCircle2 size={20} />
        <span className="font-medium text-sm text-left">{message}</span>
      </button>
    </div>
  );
}
