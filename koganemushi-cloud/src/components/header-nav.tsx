"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function HeaderNav() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <Link
      href="/"
      className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-700 font-medium"
    >
      <ArrowLeft className="size-4" />
      Top
    </Link>
  );
}
