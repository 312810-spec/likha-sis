import { CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const variants = {
  success: {
    icon: CheckCircle2,
    classes: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-900/60 dark:text-green-300',
  },
  error: {
    icon: AlertCircle,
    classes: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-900/60 dark:text-red-300',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/60 dark:text-amber-300',
  },
  info: {
    icon: Info,
    classes: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-900/60 dark:text-blue-300',
  },
};

export default function Alert({ variant = 'info', children, className = '' }) {
  const { icon: Icon, classes } = variants[variant] || variants.info;
  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm ${classes} ${className}`} role={variant === 'error' ? 'alert' : 'status'}>
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
