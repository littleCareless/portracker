import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog';
import { Button } from './button';
import { Globe, Database, Sparkles, Shield, Layout, Server, HardDrive, Wrench, Package, Bandage, Star } from 'lucide-react';
import { getFeatureIcon } from '../../lib/feature-icons';
import { cn } from '@/lib/utils';

const AUTOXPOSE_REPO = 'https://github.com/mostafa-wahied/autoxpose';

const linkifyAutoxpose = (text, t) => {
  if (!text.toLowerCase().includes('autoxpose')) return text;
  
  const parts = text.split(/(autoxpose)/i);
  return parts.map((part, i) => 
    part.toLowerCase() === 'autoxpose' ? (
      <a 
        key={i}
        href={AUTOXPOSE_REPO}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        autoxpose
      </a>
    ) : part
  );
};

const hasAutoxpose = (item) => {
  return item.title?.toLowerCase().includes('autoxpose') || 
         item.description?.toLowerCase().includes('autoxpose');
};

const HighlightsSection = ({ highlights, onOpenSettings, onClose, t }) => {
  if (!highlights?.length) return null;
  
  return (
    <div className="mb-6 p-4 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800">
      <div className="flex items-center gap-2 mb-3">
        <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
        <h3 className="font-bold text-slate-900 dark:text-slate-100">{t('whatsNew.highlights')}</h3>
      </div>
      <ul className="space-y-2">
        {highlights.map((item, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="text-indigo-600 dark:text-indigo-400 mt-0.5">•</span>
            <div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{linkifyAutoxpose(item.title, t)}</span>
              {item.description && (
                <span className="text-slate-600 dark:text-slate-400"> - {linkifyAutoxpose(item.description, t)}</span>
              )}
              {hasAutoxpose(item) && (
                <button
                  onClick={() => {
                    onClose?.();
                    onOpenSettings?.();
                  }}
                  className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800/50 transition-colors cursor-pointer border-none"
                >
                  Set up →
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

const FeatureCard = ({ feature, index, t }) => {
  const IconComponent = getFeatureIcon(feature);
  const hasDetails = feature.details?.length > 0;
  
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border transition-all duration-300 hover:shadow-lg",
        "bg-slate-50 border-slate-200 hover:border-slate-700 hover:bg-slate-100/80",
        "dark:bg-slate-800/50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800/80",
        "animate-in fade-in-0 slide-in-from-bottom-4"
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="relative flex items-start gap-3 p-4">
        <div className="flex-shrink-0 rounded-full bg-slate-200 dark:bg-slate-700/50 p-2 group-hover:bg-indigo-600 dark:group-hover:bg-indigo-500 transition-all duration-300">
          <IconComponent className="h-4 w-4 text-slate-600 dark:text-slate-300 group-hover:text-white dark:group-hover:text-white transition-all duration-300 ease-in-out group-hover:rotate-12" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-tight mb-1 transition-colors">
            {feature.title}
          </h4>
          {feature.description && (
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
              {feature.description}
            </p>
          )}
          {hasDetails && (
            <ul className="mt-2 ml-3 space-y-1.5">
              {feature.details.map((detail, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <span className="text-indigo-600 dark:text-indigo-400 mt-0.5">•</span>
                  <div>
                    {detail.title ? (
                      <>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{detail.title}</span>
                        {detail.description && (
                          <span className="text-slate-600 dark:text-slate-400">: {detail.description}</span>
                        )}
                      </>
                    ) : (
                      <span>{detail.description}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

const CategorySection = ({ title, features, icon: Icon, t, index }) => {
  const categoryIcons = {
    'Security & Access Control': Shield,
    'Dashboard & UX': Layout,
    'Server Integrations': Server,
    'Data & Infrastructure': HardDrive,
    'Operations & Tooling': Wrench,
    'Stability & Fixes': Bandage,
    'Frontend Improvements': Globe,
    'Backend Enhancements': Database,
    'Other Updates': Package,
  };
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
        <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400 transition-all duration-300 ease-in-out hover:rotate-[15deg]" />
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      </div>
      
      <div className="space-y-3">
        {features.map((feature, idx) => (
          <FeatureCard key={idx} feature={feature} index={idx} t={t} />
        ))}
      </div>
    </div>
  );
};

const VersionBadge = ({ version }) => (
  <div className="inline-flex items-center justify-center min-w-[3rem] h-8 px-2 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-200 dark:border-indigo-800">
    v{version}
  </div>
);

const VersionSection = ({ versionData, index, onOpenSettings, onClose, t }) => {
  const categoryTitles = {
    security: t('whatsNew.securityAndAccess'),
    dashboard: t('whatsNew.dashboardAndUx'),
    integrations: t('whatsNew.serverIntegrations'),
    data: t('whatsNew.dataAndInfrastructure'),
    tooling: t('whatsNew.operationsAndTooling'),
    fixes: t('whatsNew.stabilityAndFixes'),
    frontend: t('whatsNew.frontendImprovements'),
    backend: t('whatsNew.backendEnhancements'),
    misc: t('whatsNew.otherUpdates'),
  };

  const categoryIcons = {
    security: Shield,
    dashboard: Layout,
    integrations: Server,
    data: HardDrive,
    tooling: Wrench,
    fixes: Bandage,
    frontend: Globe,
    backend: Database,
    misc: Package,
  };
  
  return (
    <div 
      className={cn(
        "space-y-4 p-4 rounded-lg border bg-gradient-to-br transition-all duration-500",
        "from-slate-50/50 to-slate-100/30 border-slate-200",
        "dark:from-slate-800/30 dark:to-slate-900/50 dark:border-slate-700",
        "animate-in fade-in-0 slide-in-from-left-4"
      )}
      style={{ animationDelay: `${index * 150}ms` }}
    >
      <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
        <VersionBadge version={versionData.version} />
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('whatsNew.version', { version: versionData.version })}
        </h2>
      </div>

      <HighlightsSection highlights={versionData.changes.highlights} onOpenSettings={onOpenSettings} onClose={onClose} t={t} />

      <div className="space-y-4">
        {Object.entries(categoryTitles).map(([key, title]) => {
          if (!versionData.changes[key]?.length) return null;
          const IconComponent = categoryIcons[key];
          return (
            <CategorySection
              key={key}
              title={title}
              features={versionData.changes[key]}
              icon={IconComponent}
              t={t}
              index={index}
            />
          );
        })}
      </div>
    </div>
  );
};

const FlatChangesDisplay = ({ changes, onOpenSettings, onClose, t }) => {
  const categoryTitles = {
    security: t('whatsNew.securityAndAccess'),
    dashboard: t('whatsNew.dashboardAndUx'),
    integrations: t('whatsNew.serverIntegrations'),
    data: t('whatsNew.dataAndInfrastructure'),
    tooling: t('whatsNew.operationsAndTooling'),
    fixes: t('whatsNew.stabilityAndFixes'),
    frontend: t('whatsNew.frontendImprovements'),
    backend: t('whatsNew.backendEnhancements'),
    misc: t('whatsNew.otherUpdates'),
  };

  const categoryIcons = {
    security: Shield,
    dashboard: Layout,
    integrations: Server,
    data: HardDrive,
    tooling: Wrench,
    fixes: Bandage,
    frontend: Globe,
    backend: Database,
    misc: Package,
  };
  
  return (
    <>
      <HighlightsSection highlights={changes.highlights} onOpenSettings={onOpenSettings} onClose={onClose} t={t} />

      {Object.entries(categoryTitles).map(([key, title]) => {
        if (!changes[key]?.length) return null;
        const IconComponent = categoryIcons[key];
        return (
          <CategorySection
            key={key}
            title={title}
            features={changes[key]}
            icon={IconComponent}
            t={t}
            index={0}
          />
        );
      })}
    </>
  );
};

export function WhatsNewModal({ isOpen, onClose, onDismiss, version, changes, groupedChanges, onOpenSettings }) {
  const { t } = useTranslation();
  const hasGroupedData = groupedChanges?.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
        <DialogHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-900/50 dark:to-indigo-800/50 p-2">
              <Sparkles className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {t('whatsNew.whatsNewIn', { version })}
              </DialogTitle>
              <DialogDescription className="text-slate-600 dark:text-slate-400 mt-1">
                {t('whatsNew.discoverLatestFeatures')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto pr-2 -mr-2" style={{ maxHeight: 'calc(80vh - 200px)' }}>
          <div className="space-y-6">
            {hasGroupedData ? (
              groupedChanges.map((versionData, index) => (
                <VersionSection key={versionData.version} versionData={versionData} index={index} onOpenSettings={onOpenSettings} onClose={onClose} t={t} />
              ))
            ) : (
              <FlatChangesDisplay changes={changes} onOpenSettings={onOpenSettings} onClose={onClose} t={t} />
            )}
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button
            variant="ghost"
            onClick={() => {
              if (onDismiss) {
                onDismiss();
              }
              onClose();
            }}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            {t('whatsNew.dontShowAgain')}
          </Button>
          
          <Button
            onClick={onClose}
            className="min-w-[120px] bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors duration-200"
          >
            {t('whatsNew.getStarted')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
