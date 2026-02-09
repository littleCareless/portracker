import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Edit3, EyeOff, StickyNote, X, CheckSquare } from "lucide-react";

export function BatchOperationsBar({
  selectedCount,
  onBatchRename,
  onBatchHide,
  onBatchNote,
  onClearSelection,
  onSelectAll,
  showSelectAll = false,
  loading = false,
}) {
  const { t } = useTranslation();
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-2 duration-200">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg px-4 py-3 flex items-center space-x-2">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('common.portsSelected', { count: selectedCount })}
          </span>
          
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
          
          <div className="flex items-center space-x-1">
            {showSelectAll && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSelectAll}
                disabled={loading}
                className="h-8 px-2"
              >
                <CheckSquare className="h-4 w-4 mr-1" />
                {t('common.all')}
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onBatchRename}
              disabled={loading}
              className="h-8 px-2"
            >
              <Edit3 className="h-4 w-4 mr-1" />
              {t('common.rename')}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onBatchHide}
              disabled={loading}
              className="h-8 px-2"
            >
              <EyeOff className="h-4 w-4 mr-1" />
              {t('common.hide')}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onBatchNote}
              disabled={loading}
              className="h-8 px-2"
            >
              <StickyNote className="h-4 w-4 mr-1" />
              {t('common.note')}
            </Button>
            
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              disabled={loading}
              className="h-8 px-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}