import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertCircle,
  Shield,
  Globe,
} from "lucide-react";
import {
  getRouterConfigs,
  testRouterConnection,
  addRouterConfig,
  deleteRouterConfig,
  getPortForwardings,
  addPortForwarding,
  deletePortForwarding,
  syncRouter,
} from "@/lib/api/router";

export function RouterSettingsModal({ isOpen, onClose, routerStatus, onRouterStatusChange, servers = [] }) {
  const { t } = useTranslation();
  const [routers, setRouters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("routers");
  const [selectedRouterId, setSelectedRouterId] = useState(null);
  const [forwardings, setForwardings] = useState([]);
  const [forwardingsLoading, setForwardingsLoading] = useState(false);

  // New router form state
  const [showAddRouter, setShowAddRouter] = useState(false);
  const [routerForm, setRouterForm] = useState({
    name: "",
    routerUrl: "",
    username: "",
    password: "",
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // New forwarding form state
  const [showAddForwarding, setShowAddForwarding] = useState(false);
  const [forwardingForm, setForwardingForm] = useState({
    name: "",
    protocol: "tcp",
    externalPort: "",
    internalIp: "",
    internalPort: "",
    description: "",
  });

  // Sync state
  const [syncing, setSyncing] = useState(false);

  const loadRouters = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRouterConfigs();
      setRouters(data);
      if (data.length > 0 && !selectedRouterId) {
        setSelectedRouterId(data[0].id);
      }
      if (onRouterStatusChange) {
        onRouterStatusChange({ count: data.length });
      }
    } catch (error) {
      // Silently fail on error
    } finally {
      setLoading(false);
    }
  }, [onRouterStatusChange, selectedRouterId]);

  useEffect(() => {
    if (isOpen) {
      loadRouters();
    }
  }, [isOpen, loadRouters]);

  const loadForwardings = async (routerId) => {
    setForwardingsLoading(true);
    try {
      const data = await getPortForwardings(routerId);
      setForwardings(data.local || []);
    } catch (error) {
      // Silently fail on error
    } finally {
      setForwardingsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!routerForm.routerUrl) {
      setTestResult({ success: false, message: "Router URL is required" });
      return;
    }

    setTestingConnection(true);
    setTestResult(null);

    try {
      const result = await testRouterConnection(
        routerForm.routerUrl,
        "basic",
        routerForm.username,
        routerForm.password
      );

      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, message: error.message || "Connection failed" });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleAddRouter = async () => {
    if (!routerForm.name || !routerForm.routerUrl) {
      return;
    }

    try {
      await addRouterConfig({
        name: routerForm.name,
        routerUrl: routerForm.routerUrl,
        username: routerForm.username,
        password: routerForm.password,
      });
      setShowAddRouter(false);
      setTestResult(null);
      setRouterForm({ name: "", routerUrl: "", username: "", password: "" });
      await loadRouters();
    } catch (error) {
      // Silently fail on error
    }
  };

  const handleDeleteRouter = async (id) => {
    if (!confirm("Are you sure you want to delete this router?")) return;
    
    try {
      await deleteRouterConfig(id);
      await loadRouters();
      if (selectedRouterId === id) {
        setActiveTab("routers");
        setSelectedRouterId(null);
        setForwardings([]);
      }
    } catch (error) {
      // Silently fail on error
    }
  };

  const handleSyncRouter = async () => {
    if (!selectedRouterId) return;

    setSyncing(true);
    try {
      const result = await syncRouter(selectedRouterId);
      alert(`Sync completed: ${result.added} added, ${result.failed} failed`);
      await loadForwardings(selectedRouterId);
    } catch (error) {
      // Silently fail on error
    } finally {
      setSyncing(false);
    }
  };

  const handleAddForwarding = async () => {
    if (!selectedRouterId) return;
    if (!forwardingForm.name || !forwardingForm.externalPort || !forwardingForm.internalIp || !forwardingForm.internalPort) {
      return;
    }

    try {
      await addPortForwarding(selectedRouterId, {
        name: forwardingForm.name,
        protocol: forwardingForm.protocol,
        externalPort: parseInt(forwardingForm.externalPort),
        internalIp: forwardingForm.internalIp,
        internalPort: parseInt(forwardingForm.internalPort),
        description: forwardingForm.description,
      });
      setShowAddForwarding(false);
      setForwardingForm({
        name: "",
        protocol: "tcp",
        externalPort: "",
        internalIp: "",
        internalPort: "",
        description: "",
      });
      await loadForwardings(selectedRouterId);
    } catch (error) {
      // Silently fail on error
    }
  };

  const handleDeleteForwarding = async (id) => {
    if (!confirm("Are you sure you want to delete this port forwarding rule?")) return;

    try {
      await deletePortForwarding(id);
      await loadForwardings(selectedRouterId);
    } catch (error) {
      // Silently fail on error
    }
  };

  const getAvailableServers = () => {
    return servers
      .filter((s) => s.type === "peer")
      .map((s) => ({
        label: s.label || s.url,
        url: s.url,
        ip: s.url.replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
      }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t("settings.router.title")}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "routers"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
            onClick={() => setActiveTab("routers")}
          >
            {t("settings.router.routers")}
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "forwardings"
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
            onClick={() => {
              if (!selectedRouterId && routers.length > 0) {
                setSelectedRouterId(routers[0].id);
                loadForwardings(routers[0].id);
              }
              setActiveTab("forwardings");
            }}
            disabled={routers.length === 0}
          >
            {t("settings.router.forwardings")}
          </button>
        </div>

        {/* Routers Tab */}
        {activeTab === "routers" && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : routers.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Globe className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm">{t("settings.router.noRouters")}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowAddRouter(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t("settings.router.addRouter")}
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {routers.map((router) => (
                    <div
                      key={router.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        selectedRouterId === router.id
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          router.hasPassword ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" : "bg-amber-100 text-amber-600"
                        }`}>
                          {router.hasPassword ? <Shield className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{router.name}</p>
                          <p className="text-xs text-slate-500">{router.router_url}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {router.last_sync_at && (
                          <span className="text-xs text-slate-400">
                            {new Date(router.last_sync_at).toLocaleDateString()}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-500"
                          onClick={() => handleDeleteRouter(router.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowAddRouter(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t("settings.router.addRouter")}
                </Button>

                {/* Router Selector for Forwardings Tab */}
                {routers.length > 1 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <label className="text-xs text-slate-500 mb-2 block">
                      {t("settings.router.selectRouterFirst")}
                    </label>
                    <select
                      className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                      value={selectedRouterId || ""}
                      onChange={(e) => setSelectedRouterId(e.target.value)}
                    >
                      {routers.map((router) => (
                        <option key={router.id} value={router.id}>
                          {router.name} ({router.router_url})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            {/* Add Router Form */}
            {showAddRouter && (
              <div className="space-y-3 p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <h4 className="font-medium text-sm">{t("settings.router.newRouter")}</h4>
                
                <Input
                  placeholder={t("settings.router.name")}
                  value={routerForm.name}
                  onChange={(e) => setRouterForm({ ...routerForm, name: e.target.value })}
                />
                <Input
                  placeholder={t("settings.router.routerUrl")}
                  value={routerForm.routerUrl}
                  onChange={(e) => setRouterForm({ ...routerForm, routerUrl: e.target.value })}
                />
                <Input
                  placeholder={t("settings.router.username")}
                  value={routerForm.username}
                  onChange={(e) => setRouterForm({ ...routerForm, username: e.target.value })}
                />
                <Input
                  type="password"
                  placeholder={t("settings.router.password")}
                  value={routerForm.password}
                  onChange={(e) => setRouterForm({ ...routerForm, password: e.target.value })}
                />

                {testResult && (
                  <div className={`flex items-center gap-2 text-sm ${
                    testResult.success ? "text-emerald-600" : "text-red-500"
                  }`}>
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    {testResult.message}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={testingConnection || !routerForm.routerUrl}
                  >
                    {testingConnection ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    {t("settings.router.testConnection")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddRouter}
                    disabled={!testResult?.success}
                  >
                    {t("common.save")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowAddRouter(false);
                      setTestResult(null);
                      setRouterForm({ name: "", routerUrl: "", username: "", password: "" });
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Forwardings Tab */}
        {activeTab === "forwardings" && (
          <div className="space-y-4">
            {!selectedRouterId ? (
              <div className="text-center py-8 text-slate-500">
                <p className="text-sm">{t("settings.router.selectRouterFirst")}</p>
              </div>
            ) : forwardingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : forwardings.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <ExternalLink className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm">{t("settings.router.noForwardings")}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowAddForwarding(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t("settings.router.addForwarding")}
                </Button>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSyncRouter}
                    disabled={syncing}
                  >
                    {syncing ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    {t("settings.router.syncToRouter")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddForwarding(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t("settings.router.addForwarding")}
                  </Button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {forwardings.map((fw) => (
                    <div
                      key={fw.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">
                          {fw.external_port}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{fw.name}</p>
                          <p className="text-xs text-slate-500">
                            {fw.protocol.toUpperCase()} → {fw.internal_ip}:{fw.internal_port}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-500"
                        onClick={() => handleDeleteForwarding(fw.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Add Forwarding Form */}
            {showAddForwarding && selectedRouterId && (
              <div className="space-y-3 p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <h4 className="font-medium text-sm">{t("settings.router.newForwarding")}</h4>
                
                <Input
                  placeholder={t("settings.router.ruleName")}
                  value={forwardingForm.name}
                  onChange={(e) => setForwardingForm({ ...forwardingForm, name: e.target.value })}
                />
                
                <div className="grid grid-cols-3 gap-2">
                  <select
                    className="px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    value={forwardingForm.protocol}
                    onChange={(e) => setForwardingForm({ ...forwardingForm, protocol: e.target.value })}
                  >
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                    <option value="tcpudp">TCP+UDP</option>
                  </select>
                  <Input
                    placeholder={t("settings.router.externalPort")}
                    type="number"
                    value={forwardingForm.externalPort}
                    onChange={(e) => setForwardingForm({ ...forwardingForm, externalPort: e.target.value })}
                  />
                  <Input
                    placeholder={t("settings.router.internalPort")}
                    type="number"
                    value={forwardingForm.internalPort}
                    onChange={(e) => setForwardingForm({ ...forwardingForm, internalPort: e.target.value })}
                  />
                </div>

                <Input
                  placeholder={t("settings.router.internalIp")}
                  value={forwardingForm.internalIp}
                  onChange={(e) => setForwardingForm({ ...forwardingForm, internalIp: e.target.value })}
                />
                <Input
                  placeholder={t("settings.router.description")}
                  value={forwardingForm.description}
                  onChange={(e) => setForwardingForm({ ...forwardingForm, description: e.target.value })}
                />

                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddForwarding}>
                    {t("common.save")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowAddForwarding(false);
                      setForwardingForm({
                        name: "",
                        protocol: "tcp",
                        externalPort: "",
                        internalIp: "",
                        internalPort: "",
                        description: "",
                      });
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}