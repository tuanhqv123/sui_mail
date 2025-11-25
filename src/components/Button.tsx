import type { ButtonHTMLAttributes, ReactNode } from "react";
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline";
  className?: string;
}

const Button = ({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) => {
  const baseStyles =
    "flex items-center justify-center gap-2 px-6 py-3 md:px-6 md:py-3 px-4 py-2 text-base md:text-base text-sm rounded-full transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-black text-white hover:bg-black/80 shadow-lg hover:shadow-xl",
    secondary:
      "bg-white text-black hover:bg-gray-50 shadow-sm border border-gray-200",
    outline:
      "bg-white text-black border-[2px] border-black hover:bg-black hover:text-white hover:border-black"
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
