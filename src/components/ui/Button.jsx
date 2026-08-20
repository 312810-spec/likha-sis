const base =
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100';

const variants = {
  primary: 'bg-primary text-white hover:bg-primary-dark',
  secondary:
    'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700',
  ghost: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
  destructive: 'border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40',
};

const sizes = {
  default: 'h-9 px-4',
  compact: 'h-8 px-3 text-xs',
  icon: 'h-9 w-9',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'default',
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.default} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
