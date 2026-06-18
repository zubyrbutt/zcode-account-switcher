'use strict';
/**
 * preload - 安全桥接
 *
 * 通过 contextBridge 向渲染进程暴露一个受限的 window.api 对象。
 * 渲染进程只能调用这里列出的方法，无法直接访问 Node / 文件系统。
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  status: () => ipcRenderer.invoke('account:status'),
  list: () => ipcRenderer.invoke('account:list'),
  capture: (opts) => ipcRenderer.invoke('account:capture', opts),
  use: (id) => ipcRenderer.invoke('account:use', id),
  remove: (id) => ipcRenderer.invoke('account:delete', id),
  rename: (id, label) => ipcRenderer.invoke('account:rename', id, label),
  exportAccounts: (ids) => ipcRenderer.invoke('account:export', ids),
  importAccounts: () => ipcRenderer.invoke('account:import'),
  // OAuth 添加账号（CLI OAuth + 系统浏览器跳转）
  oauthStart: (opts) => ipcRenderer.invoke('account:oauth-start', opts),
  oauthCancel: () => ipcRenderer.invoke('account:oauth-cancel'),
  // 流程事件订阅（返回取消订阅函数）
  // cb 收到 event: {type: 'browser-open'|'waiting-login'|'exchanging'|'saved'|'error', ...}
  onFlowEvent: (cb) => {
    const handler = (_e, event) => cb(event);
    ipcRenderer.on('oauth:flow-event', handler);
    return () => ipcRenderer.removeListener('oauth:flow-event', handler);
  },
  quota: () => ipcRenderer.invoke('account:quota'),
  accountQuota: (id) => ipcRenderer.invoke('account:quota-one', id),
  accountQuotas: (ids) => ipcRenderer.invoke('account:quota-many', ids),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  rollback: () => ipcRenderer.invoke('account:rollback'),
  // 多实例管理
  instanceList: () => ipcRenderer.invoke('instance:list'),
  instanceCreate: (opts) => ipcRenderer.invoke('instance:create', opts),
  instanceLaunch: (id) => ipcRenderer.invoke('instance:launch', id),
  instanceStop: (id) => ipcRenderer.invoke('instance:stop', id),
  instanceRemove: (id) => ipcRenderer.invoke('instance:remove', id),
  instanceRename: (id, label) => ipcRenderer.invoke('instance:rename', id, label),
  instanceAssignAccount: (instanceId, accountId) => ipcRenderer.invoke('instance:assign-account', instanceId, accountId),
  instanceUnassignAccount: (instanceId) => ipcRenderer.invoke('instance:unassign-account', instanceId),
  // Wake-up automation
  wakeupStart: (config) => ipcRenderer.invoke('wakeup:start', config),
  wakeupStop: () => ipcRenderer.invoke('wakeup:stop'),
  wakeupStatus: () => ipcRenderer.invoke('wakeup:status'),
  onWakeupEvent: (cb) => {
    const handler = (_e, event) => cb(event);
    ipcRenderer.on('wakeup:event', handler);
    return () => ipcRenderer.removeListener('wakeup:event', handler);
  },
});
