import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';

export function ChangePasswordModal({ open, onClose, requirePasswordChange = false }) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError(t('changePassword.min8CharsRequired'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('changePassword.passwordsDoNotMatch'));
      return;
    }

    setLoading(true);

    try {
      const body = requirePasswordChange
        ? { newPassword }
        : { currentPassword, newPassword };

      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('changePassword.passwordChangeFailed'));
        setLoading(false);
        return;
      }

      onClose(true);
    } catch (error) {
      setError(error.message || t('changePassword.networkError'));
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={requirePasswordChange ? undefined : onClose}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => requirePasswordChange && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {requirePasswordChange ? t('changePassword.setNewPassword') : t('changePassword.changePassword')}
          </DialogTitle>
          <DialogDescription>
            {requirePasswordChange
              ? t('changePassword.mustSetNewPassword')
              : t('changePassword.updatePassword')}
          </DialogDescription>
        </DialogHeader>

        {requirePasswordChange && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {t('changePassword.recoveryModeMessage')}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!requirePasswordChange && (
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t('changePassword.currentPassword')}</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('changePassword.enterCurrentPassword')}
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('changePassword.newPassword')}</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('changePassword.atLeast8Chars')}
              required
              autoComplete="new-password"
              disabled={loading}
            />
            {newPassword && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {newPassword.length >= 8 ? (
                  <span className="text-green-600 dark:text-green-400">✓ {t('changePassword.validPassword')}</span>
                ) : (
                  <span>{t('changePassword.min8CharsRequired')}</span>
                )}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('changePassword.confirmNewPassword')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('changePassword.reEnterNewPassword')}
              required
              autoComplete="new-password"
              disabled={loading}
            />
            {confirmPassword && (
              <p className="text-xs">
                {newPassword === confirmPassword ? (
                  <span className="text-green-600 dark:text-green-400">✓ {t('changePassword.passwordsMatch')}</span>
                ) : (
                  <span className="text-red-600 dark:text-red-400">✗ {t('changePassword.passwordsDoNotMatch')}</span>
                )}
              </p>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            {!requirePasswordChange && (
              <Button type="button" variant="outline" onClick={() => onClose(false)} disabled={loading}>
                {t('changePassword.cancel')}
              </Button>
            )}
            <Button
              type="submit"
              disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading ? t('changePassword.changing') : t('changePassword.changePasswordBtn')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
