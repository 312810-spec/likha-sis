export default function Card({ children, className = '', padded = true }) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-800 ${padded ? 'p-4 sm:p-5' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
