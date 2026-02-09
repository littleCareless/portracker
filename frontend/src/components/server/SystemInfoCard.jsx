import {
  Cpu,
  MemoryStick,
  Server as ServerIcon,
  Terminal,
  Package,
  Home,
  Clock,
  Container,
} from "lucide-react";
import { formatBytes, formatUptime } from "@/lib/utils";
import { useTranslation } from "react-i18next";

function InfoItem({ icon, label, value, fullWidth = false }) {
  if (value === undefined || value === null || value === "") return null;
  const Icon = icon;
  return (
    <div
      className={`flex items-start justify-between text-sm ${
        fullWidth ? "col-span-2" : ""
      }`}
    >
      <div className="flex items-center text-slate-500 dark:text-slate-400 flex-shrink-0">
        <Icon className="h-4 w-4 mr-2 mt-0.5" />
        <span className="font-medium">{label}</span>
      </div>
      <span className="font-semibold text-slate-700 dark:text-slate-200 text-right break-words ml-2">
        {value}
      </span>
    </div>
  );
}

export function SystemInfoCard({ systemInfo, platformName }) {
  const { t } = useTranslation();
  
  if (!systemInfo) return null;

  const info = {
    hostname: systemInfo.hostname,
    os:
      platformName?.toLowerCase().includes("truenas") && systemInfo.version
        ? `TrueNAS ${systemInfo.version}`
        : systemInfo.operating_system,
    product: systemInfo.system_product,
    cpuModel: systemInfo.model || systemInfo.cpu?.model,
    cpuCores: systemInfo.cpu_cores || systemInfo.ncpu || systemInfo.cores,
    memory: systemInfo.physmem || systemInfo.total_mem || systemInfo.memory,
    uptime: systemInfo.uptime_seconds,
    dockerVersion: systemInfo.docker_version,
    containersRunning: systemInfo.containers_running,
    containersTotal: systemInfo.containers_total,
  };
  const memoryGb = info.memory ? info.memory / (1024 ** 3) : null;
  let memoryMessage = null;
  if (memoryGb != null) {
    if (memoryGb >= 128) {
      memoryMessage = t('systemInfo.lotsOfRam');
    } else if (memoryGb < 4) {
      memoryMessage = t('systemInfo.leanRespect');
    }
  }

  const containerInfoValue = () => {
    const running = info.containersRunning;
    const total = info.containersTotal;

    if (running !== undefined && total !== undefined) {
      return `${running} / ${total}`;
    }
    if (running !== undefined) {
      return `${running}`;
    }
    return undefined;
  };

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-6 h-full">
      <div className="space-y-3">
        
        <div className="space-y-2 border-b border-slate-200 dark:border-slate-700/50 pb-3">
          <InfoItem
            icon={Home}
            label={t('systemInfo.hostname')}
            value={info.hostname}
            fullWidth={true}
          />
          <InfoItem
            icon={ServerIcon}
            label={t('systemInfo.product')}
            value={info.product}
            fullWidth={true}
          />
          <InfoItem
            icon={Terminal}
            label={t('systemInfo.os')}
            value={info.os}
            fullWidth={true}
          />
          <InfoItem
            icon={Cpu}
            label={t('systemInfo.cpuModel')}
            value={info.cpuModel}
            fullWidth={true}
          />
        </div>

        
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-1">
          <InfoItem icon={Cpu} label={t('systemInfo.cpuCores')} value={info.cpuCores} />
          <InfoItem
            icon={MemoryStick}
            label={t('systemInfo.memory')}
            value={info.memory ? `${t('systemInfo.total')}: ${formatBytes(info.memory)}` : t('systemInfo.na')}
          />
          {memoryMessage && (
            <div className="col-span-2 text-xs text-slate-500 dark:text-slate-400 italic">
              {memoryMessage}
            </div>
          )}
          <InfoItem
            icon={Clock}
            label={t('systemInfo.uptime')}
            value={info.uptime ? formatUptime(info.uptime) : t('systemInfo.na')}
          />
          <InfoItem
            icon={Container}
            label={t('systemInfo.containers')}
            value={containerInfoValue()}
          />
          <InfoItem icon={Package} label={t('systemInfo.docker')} value={info.dockerVersion} />
        </div>
      </div>
    </div>
  );
}


