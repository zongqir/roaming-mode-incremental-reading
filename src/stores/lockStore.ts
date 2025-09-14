/*
 * Copyright (c) 2025, ebAobS . All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 only, as
 * published by the Free Software Foundation.  ebAobS designates this
 * particular file as subject to the "Classpath" exception as provided
 * by ebAobS in the LICENSE file that accompanied this code.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * version 2 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 2 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 */

/**
 * ========================================
 * 全局锁定状态管理
 * ========================================
 * 
 * 管理整个应用程序的锁定状态，确保所有组件的锁定状态同步
 */

import { writable } from 'svelte/store';

/**
 * 检测当前环境是否为移动端
 * @returns 是否为移动端环境
 */
function isMobileEnv(): boolean {
  if (typeof window !== 'undefined') {
    // 通过屏幕宽度判断是否为移动端
    return window.innerWidth <= 768;
  }
  return false;
}

// 全局锁定状态 - 手机版本默认锁定，桌面版本默认不锁定
export const isLocked = writable<boolean>(isMobileEnv());

// 锁定切换函数
export function toggleLock() {
  isLocked.update(locked => !locked);
}

// 设置锁定状态函数
export function setLocked(locked: boolean) {
  isLocked.set(locked);
}
