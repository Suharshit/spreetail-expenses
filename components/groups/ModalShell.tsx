'use client';

import { ReactNode } from 'react';
import { X } from 'lucide-react';

type ModalShellProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export function ModalShell({ isOpen, onClose, title, children }: ModalShellProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl bg-gray-900 p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 transition hover:text-white"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="pr-8 text-lg font-semibold text-white">{title}</h2>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
