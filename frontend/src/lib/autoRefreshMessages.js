const GENERAL_MESSAGES = {
  en: [
    "Shushing noisy daemons… give us 30 seconds.",
    "Counting bits, bytes, and bad decisions.",
    "Scanning the subnet for uninvited guests.",
    "Checking if Docker went rogue again.",
    "Playing hide-and-seek under bridged networks.",
    "Waiting for services to line up for roll call.",
    "Scripting yet another docker ps flex.",
    "Watching for containers that missed curfew.",
    "Renegotiating NAT treaties at the border.",
    "Diffing firewall rules so you don't have to.",
    "Running ip neigh gossip down the rack.",
    "Patching cables with positive thoughts.",
    "Staring down cronjobs until they blink.",
    "Cross-checking config drift in the margins.",
    "Counting open ports faster than nmap.",
    "Waiting for log ingestion to stop screaming."
  ],
  zh: [
    "正在让嘈杂的守护进程安静下来……请给我们30秒。",
    "正在数比特、数字节、以及糟糕的决定。",
    "正在子网中扫描不速之客。",
    "正在检查 Docker 是否又失控了。",
    "正在桥接网络中玩捉迷藏。",
    "正在等待服务排队点名。",
    "正在编写另一个 docker ps 命令。",
    "正在观察未按时回家的容器。",
    "正在重新谈判 NAT 边界条约。",
    "正在对比防火墙规则，好让你不用动手。",
    "正在沿着机架传播邻居信息。",
    "正在用积极的心态修补网线。",
    "正在盯着定时任务直到它们就范。",
    "正在检查配置漂移的边缘情况。",
    "正在以比 nmap 更快的速度统计开放端口。",
    "正在等待日志摄入停止尖叫。"
  ]
};

const TRUE_NAS_MESSAGE = {
  en: "Asking TrueNAS if it woke another VM.",
  zh: "正在问 TrueNAS 它是否又唤醒了另一个虚拟机。"
};

export function buildAutoRefreshMessages({ isTrueNAS = false, currentPort = "4999", lang = "en" } = {}) {
  const messages = GENERAL_MESSAGES[lang] || GENERAL_MESSAGES.en;
  const base = [...messages];

  if (lang === 'zh') {
    base.push(`正在确认端口 ${currentPort} 仍属于你。`);
  } else {
    base.push(`Confirming that Port ${currentPort} still belongs to you.`);
  }

  if (isTrueNAS) {
    base.push(TRUE_NAS_MESSAGE[lang] || TRUE_NAS_MESSAGE.en);
  }

  const shuffled = base
    .map((text) => ({ text, sortKey: Math.random() }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((entry) => entry.text);

  return shuffled;
}