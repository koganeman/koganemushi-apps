"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /**
   * `false` にすると body スクロールロックを解除し、ダイアログ外のページ操作を許可する。
   * 背景の数値を参照しながら入力させたいフォームで使う。 default: true
   */
  modal?: boolean;
}

export function Dialog({ open, onOpenChange, children, modal = true }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      {children}
    </DialogPrimitive.Root>
  );
}

interface DialogContentProps {
  className?: string;
  children: ReactNode;
  /** "right" は画面右端のドロワー風表示。default: "center" */
  placement?: "center" | "right";
  /** false で半透明バックドロップを描画しない（非モーダル時に背景を見せる用途）。default: true */
  showBackdrop?: boolean;
}

export function DialogContent({
  className,
  children,
  placement = "center",
  showBackdrop = true,
}: DialogContentProps) {
  const positionClass =
    placement === "right"
      ? "fixed right-0 top-0 h-screen w-[32rem] max-w-[92vw] overflow-y-auto rounded-l-lg shadow-2xl data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full transition-transform duration-200"
      : "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-md w-[90vw] max-h-[85vh] overflow-y-auto rounded-lg shadow-xl data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity duration-200";

  return (
    <DialogPrimitive.Portal>
      {showBackdrop && (
        <DialogPrimitive.Backdrop className="fixed inset-0 bg-black/40 z-50 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity duration-200" />
      )}
      <DialogPrimitive.Popup
        className={cn(
          "bg-white z-50 p-6",
          positionClass,
          className
        )}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-4", className)}>{children}</div>;
}

export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <DialogPrimitive.Title className={cn("text-lg font-bold", className)}>
      {children}
    </DialogPrimitive.Title>
  );
}
