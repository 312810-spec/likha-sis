const tones = {
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  primary: 'bg-primary/10 text-primary dark:text-primary-light',
  success: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
};

export default function Badge({ children, tone = 'neutral', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone] || tones.neutral} ${className}`}>
      {children}
    </span>
  );
}
