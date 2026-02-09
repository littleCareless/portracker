import React from "react";
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
import { Loader2, Eye, EyeOff } from "lucide-react";

export function BatchHideModal({
  isOpen,
  onClose,
  selectedPorts,
  onConfirm,
  loading = false,
  action = "hide",
}) {
  const { t } = useTranslation();
  const handleConfirm = () => {
    onConfirm({
      selectedPorts: Array.from(selectedPorts),
      action,
    });
  };

  const portCount = selectedPorts?.size || 0;
  const isHiding = action === "hide";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isHiding ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            {isHiding ? t('batch.hidePortsTitle', { count: portCount }) : t('batch.showPortsTitle', { count: portCount })}
          </DialogTitle>
          <DialogDescription>
            {isHiding ? t('batch.hideDescription') : t('batch.showDescription')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t('batch.confirmHide', { count: portCount })}
          </p>
        </div>

        <DialogFooter className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={loading}
          >
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={loading}
            variant={isHiding ? "destructive" : "default"}
            className="min-w-16"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('common.processing')}
              </>
            ) : (
              <>
                {isHiding ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {isHiding ? t('batch.hiding') : t('batch.showing')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}