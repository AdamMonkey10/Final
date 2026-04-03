import { useEffect } from 'react';
import { useGame } from '@/contexts/GameContext';

const TYPE_STYLES = {
  info:    'bg-blue-950/80 border-blue-700/60 text-blue-200',
  success: 'bg-green-950/80 border-green-700/60 text-green-200',
  warning: 'bg-yellow-950/80 border-yellow-700/60 text-yellow-200',
  danger:  'bg-red-950/80 border-red-700/60 text-red-200',
};

const TYPE_ICONS = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  danger: '🚨',
};

export function GameNotifications() {
  const { state, dismissNotification } = useGame();
  const { notifications } = state;

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    if (notifications.length === 0) return;
    const oldest = notifications[0];
    const age = Date.now() - oldest.timestamp;
    const remaining = Math.max(0, 4000 - age);
    const timer = setTimeout(() => {
      dismissNotification(oldest.id);
    }, remaining);
    return () => clearTimeout(timer);
  }, [notifications, dismissNotification]);

  if (notifications.length === 0) return null;

  return (
    <div className="absolute top-0 left-0 right-0 z-50 flex flex-col gap-1 p-2 pointer-events-none">
      {notifications.slice(-3).map(note => (
        <div
          key={note.id}
          onClick={() => dismissNotification(note.id)}
          className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium pointer-events-auto cursor-pointer backdrop-blur-sm ${TYPE_STYLES[note.type]}`}
        >
          <span className="shrink-0 text-sm">{TYPE_ICONS[note.type]}</span>
          <span className="leading-relaxed">{note.message}</span>
        </div>
      ))}
    </div>
  );
}
