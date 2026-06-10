"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onUpload: (file: File) => void;
  uploading: boolean;
}

export function AnexoUploader({ onUpload, uploading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) return;
    onUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
        dragOver
          ? "border-[#6C63FF] bg-[#6C63FF]/5"
          : "border-[#2A2F45] hover:border-[#6C63FF]/50 bg-[#1A1F2E]",
        uploading && "pointer-events-none opacity-60"
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {uploading ? (
        <div className="w-6 h-6 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-[#2A2F45] flex items-center justify-center">
          <Upload className="w-4 h-4 text-[#8B8FA8]" />
        </div>
      )}
      <div>
        <p className="text-white font-medium text-sm">
          {uploading ? "Enviando..." : "Clique ou arraste um arquivo XLSX"}
        </p>
        {!uploading && (
          <p className="text-xs text-[#8B8FA8] mt-1">Aceita .xlsx e .xls</p>
        )}
      </div>
    </div>
  );
}
