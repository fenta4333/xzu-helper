/**
 * 本地存储层（localStorage）
 *
 * 所有数据只存在浏览器本地，不上传任何服务器。
 */
(function (global) {
  'use strict';

  var PREFIX = 'xzu.';
  var VERSION = 'v1';

  var KEYS = {
    timetable: PREFIX + 'timetable.' + VERSION,
    fitness: PREFIX + 'fitness.' + VERSION,
    fitnessProfile: PREFIX + 'fitness-profile.' + VERSION,
    docs: PREFIX + 'docs.' + VERSION,
    settings: PREFIX + 'settings.' + VERSION
  };

  var memoryFallback = {};
  var storageAvailable = (function () {
    try {
      var k = '__xzu_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  })();

  function warnOnce() {
    if (storageAvailable || warnOnce.done) return;
    warnOnce.done = true;
    if (global.Utils) {
      Utils.toast('浏览器禁用了本地存储，数据只在当前页面有效（刷新会丢失）', 'warn');
    }
  }

  function read(key, fallback) {
    warnOnce();
    try {
      var raw = storageAvailable ? localStorage.getItem(key) : memoryFallback[key];
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[store] 读取失败', key, e);
      return fallback;
    }
  }

  function write(key, value) {
    warnOnce();
    var raw = JSON.stringify(value);
    try {
      if (storageAvailable) localStorage.setItem(key, raw);
      else memoryFallback[key] = raw;
      return true;
    } catch (e) {
      console.warn('[store] 写入失败', key, e);
      if (global.Utils) {
        Utils.toast('本地存储空间不足，请先导出备份或清理旧数据', 'error');
      }
      return false;
    }
  }

  function remove(key) {
    if (storageAvailable) localStorage.removeItem(key);
    else delete memoryFallback[key];
  }

  /** 已用空间估算（字节） */
  function usage() {
    if (!storageAvailable) {
      return Object.keys(memoryFallback).reduce(function (n, k) {
        return n + k.length + memoryFallback[k].length;
      }, 0);
    }
    var total = 0;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) {
        total += k.length + (localStorage.getItem(k) || '').length;
      }
    }
    return total * 2; // UTF-16
  }

  /** 导出全部数据（备份） */
  function exportAll() {
    return {
      app: 'XZU Helper',
      version: VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        timetable: read(KEYS.timetable, null),
        fitness: read(KEYS.fitness, null),
        fitnessProfile: read(KEYS.fitnessProfile, null),
        docs: read(KEYS.docs, null),
        settings: read(KEYS.settings, null)
      }
    };
  }

  /** 导入备份 */
  function importAll(payload) {
    if (!payload || !payload.data) throw new Error('备份文件格式不正确');
    var d = payload.data;
    if (d.timetable) write(KEYS.timetable, d.timetable);
    if (d.fitness) write(KEYS.fitness, d.fitness);
    if (d.fitnessProfile) write(KEYS.fitnessProfile, d.fitnessProfile);
    if (d.docs) write(KEYS.docs, d.docs);
    if (d.settings) write(KEYS.settings, d.settings);
    return true;
  }

  function clearAll() {
    Object.keys(KEYS).forEach(function (k) { remove(KEYS[k]); });
  }

  global.Store = {
    KEYS: KEYS,
    read: read,
    write: write,
    remove: remove,
    usage: usage,
    exportAll: exportAll,
    importAll: importAll,
    clearAll: clearAll,
    available: storageAvailable
  };
})(typeof window !== 'undefined' ? window : globalThis);
