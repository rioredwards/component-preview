import React from "react";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | string;
};

const styles: Record<string, string> = {
  primary: "primaryButton",
  ghost: "ghostButton",
};

export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  const cls = `${styles[variant] || variant} ${className}`;
  return <button className={cls} {...rest} />;
}
