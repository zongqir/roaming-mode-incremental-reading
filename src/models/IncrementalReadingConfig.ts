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

export enum ReviewMode {
  Incremental = "incremental",
  Once = "once",
}

export enum FilterMode {
  Notebook = "notebook",
  Root = "root",
}

/**
 * 存储对象
 */
class IncrementalReadingConfig {
  /**
   * 笔记本ID
   */
  public notebookId: string

  /**
   * 是否显示加载中
   */
  public showLoading: boolean

  /**
   * 是否启用自定义 SQL
   */
  public customSqlEnabled: boolean

  /**
   * 自定义 SQL
   */
  public sql: string

  /**
   * 当前 SQL
   */
  public currentSql: string

  /**
   * 复习模式
   */
  reviewMode: ReviewMode = ReviewMode.Incremental

  /**
   * 过滤模式
   */
  filterMode: FilterMode = FilterMode.Notebook

  /**
   * 根块ID
   */
  rootId = ""

  /**
   * 渐进模式配置ID
   */
  incrementalConfigId = "incremental_config"

  /**
   * 是否排除今日已访问的文档
   */
  excludeTodayVisited = true

  constructor() {
    this.filterMode = this.filterMode || FilterMode.Notebook
    this.rootId = this.rootId || ""
    this.excludeTodayVisited = this.excludeTodayVisited !== false
  }
}

export default IncrementalReadingConfig 