import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-slate-950 hover:opacity-90 focus-visible:ring-accent",
  secondary: "bg-slate-700 text-slate-100 hover:bg-slate-600 focus-visible:ring-slate-400",
  danger: "bg-accent-danger text-slate-950 hover:opacity-90 focus-visible:ring-accent-danger",
  ghost: "text-slate-300 hover:bg-slate-800 hover:text-slate-100 focus-visible:ring-slate-500"
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base"
};

/**
 * Compose the shared button classes. Exposed separately so anchor/link elements
 * (which can't be a <button>) can adopt the same look without duplicating the
 * Tailwind soup.
 */
function buttonClasses({
  variant = "primary",
  size = "md",
  className = ""
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return `${BASE} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** The app's standard button: consistent radius, sizing, and focus ring. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, className, type = "button", ...props },
  ref
) {
  return <button ref={ref} type={type} className={buttonClasses({ variant, size, className })} {...props} />;
});
