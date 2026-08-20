// Canonical button primitive: 2 sizes x 3 variants, per
// docs/ui-ux/DESIGN-DIRECTION.md #7. Composes the same recipe as
// settingsStyles.primaryButtonClass (variant="primary" size="default").
const BASE =
  "inline-flex items-center gap-2 rounded-lg font-semibold transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed";

const SIZES = {
  default: "px-5 py-2.5 text-sm",
  small: "px-3 py-1.5 text-xs",
};

const VARIANTS = {
  primary: "bg-primary text-white shadow-sm hover:bg-primary-light",
  secondary:
    "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
};

export default function Button({
  variant = "primary",
  size = "default",
  className = "",
  type = "button",
  ...props
}) {
  const cls = `${BASE} ${SIZES[size] || SIZES.default} ${VARIANTS[variant] || VARIANTS.primary} ${className}`.trim();
  return <button type={type} className={cls} {...props} />;
}
