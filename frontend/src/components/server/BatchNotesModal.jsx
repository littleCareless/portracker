import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, Trash2 } from "lucide-react";

export function BatchNotesModal({
  isOpen,
  onClose,
  selectedPorts,
  onSave,
  loading = false,
}) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNote("");
      setIsDirty(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setIsDirty(note.trim().length > 0);
  }, [note]);

  const handleSave = () => {
    onSave({
      note: note.trim() || null,
      selectedPorts: Array.from(selectedPorts),
    });
  };

  const handleClear = () => {
    onSave({
      note: null,
      selectedPorts: Array.from(selectedPorts),
      isClear: true,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && e.ctrlKey && note.trim()) {
      e.preventDefault();
      handleSave();
    }
  };

  const portCount = selectedPorts?.size || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('batch.batchNoteTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('batch.batchNoteDesc', { count: portCount })}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="batch-note">{t('batch.note')}</Label>
            <textarea
              id="batch-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('batch.enterNote')}
              className="w-full min-h-[100px] p-3 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
              disabled={loading}
              autoFocus
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('batch.noteAppliedAll', { count: portCount })}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 sm:order-1">
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={loading}
            >
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleSave}
              disabled={loading}
              className="min-w-16"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('common.saving')}
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  {isDirty ? t('batch.addNotePorts', { count: portCount }) : t('common.save')}
                </>
              )}
            </Button>
          </div>
          
          <Button
            variant="ghost"
            onClick={handleClear}
            disabled={loading}
            className="sm:order-0 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('batch.clearAllNotes')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}