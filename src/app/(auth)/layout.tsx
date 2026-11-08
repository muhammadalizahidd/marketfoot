import type { ReactNode } from "react";

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <main aria-label="Authentication">{children}</main>;
}
