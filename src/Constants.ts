/*
 * Copyright (c) 2023-2025, ebAobS . All rights reserved.
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
 * 漫游式渐进阅读插件 - 常量定义
 * ========================================
 * 
 * 本文件定义了插件中使用的全局常量，包括环境配置、路径和存储键等，
 * 这些常量被整个插件共享使用。
 * 
 * ## 文件结构
 * 1. 环境常量 - 定义运行环境相关常量
 * 2. 路径常量 - 定义文件路径和目录常量
 * 3. API相关常量 - 思源笔记API相关配置
 * 4. 存储常量 - 插件数据存储相关常量
 */

/** 1. 环境常量 */

/** 1.1 思源笔记工作空间目录 */
export const workspaceDir = `${(window as any).siyuan.config.system.workspaceDir}`

/** 1.2 思源笔记数据目录 */
export const dataDir = `${(window as any).siyuan.config.system.dataDir}`

/** 1.3 是否为开发模式 */
export const isDev = process.env.DEV_MODE === "true"

/** 2. API相关常量 */

/** 2.1 思源笔记API地址 */
export const siyuanApiUrl = ""

/** 2.2 思源笔记API令牌 */
export const siyuanApiToken = ""

/** 3. 存储常量 */

/** 3.1 主配置存储键名 */
export const storeName = "roaming-mode-incremental-reading.json"

