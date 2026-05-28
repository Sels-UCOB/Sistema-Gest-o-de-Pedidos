"use client";

import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmOptions {
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  title: string;
  resolve: (v: boolean) => void;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((title: string, options?: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setState({ title, ...options, resolve });
    });
  }, []);

  const close = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  const dialog = (
    <Dialog open={!!state} onOpenChange={(open) => { if (!open) close(false); }}>
      <DialogContent className="bg-slate-900 border-slate-700 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">{state?.title}</DialogTitle>
          {state?.description && (
            <DialogDescription className="text-slate-400 mt-1">{state.description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="flex gap-2 justify-end mt-2">
          <Button
            variant="outline"
            onClick={() => close(false)}
            className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => close(true)}
            className={
              state?.destructive
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            }
          >
            {state?.confirmLabel ?? "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, dialog };
}
