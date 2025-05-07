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
 *
 * Please contact ebAobS, ebAobs@outlook.com
 * or visit https://github.com/ebAobS/roaming-mode-incremental-reading if you need additional information or have any
 * questions.
 */

/**
 * ========================================
 * 漫游式渐进阅读插件 - 配置模型
 * ========================================
 * 
 * 本文件定义了插件的主要配置模型，包括漫游模式、过滤器和其他运行时配置。
 * 这些配置被存储在思源笔记的数据存储中，用于控制插件的主要行为。
 * 
 * ## 文件结构
 * 1. 枚举定义 - 定义配置中使用的枚举类型
 * 2. 配置类 - 定义插件的主要配置模型
 */

/**
 * 1. 枚举定义
 */

/**
 * 1.1 复习模式枚举
 * 定义文档复习的两种主要模式
 */
export enum ReviewMode {
  /** 1.1.1 渐进式复习模式，基于优先级系统 */
  Incremental = "incremental",
  /** 1.1.2 一次性复习模式，依次查看所有文档 */
  Once = "once",
}

/**
 * 1.2 过滤模式枚举
 * 定义文档筛选的两种主要方式
 */
export enum FilterMode {
  /** 1.2.1 按笔记本过滤 */
  Notebook = "notebook",
  /** 1.2.2 按根文档过滤 */
  Root = "root",
}

/**
 * 2. 配置类
 * 定义插件的主要配置模型
 */
class RandomDocConfig {
  /**
   * 2.1 笔记本ID
   * 当过滤模式为Notebook时使用的笔记本ID
   */
  public notebookId: string

  /**
   * 2.2 是否显示加载动画
   * 控制漫游过程中是否显示加载动画
   */
  public showLoading: boolean

  /**
   * 2.3 是否启用自定义SQL
   * 控制是否使用自定义SQL查询来筛选文档
   */
  public customSqlEnabled: boolean

  /**
   * 2.4 自定义SQL列表
   * 存储用户定义的SQL查询列表（JSON字符串）
   */
  public sql: string

  /**
   * 2.5 当前选中的SQL
   * 当前正在使用的SQL查询
   */
  public currentSql: string

  /**
   * 2.6 复习模式
   * 控制文档的复习方式，默认为渐进式
   */
  reviewMode: ReviewMode = ReviewMode.Incremental

  /**
   * 2.7 过滤模式
   * 控制文档的筛选方式，默认为按笔记本
   */
  filterMode: FilterMode = FilterMode.Notebook

  /**
   * 2.8 根文档ID
   * 当过滤模式为Root时使用的根文档ID
   */
  rootId = ""

  /**
   * 2.9 渐进模式配置ID
   * 用于存储渐进模式的配置数据
   */
  incrementalConfigId = "incremental_config"

  /**
   * 2.10 是否排除今日已访问文档
   * 控制是否在漫游时排除今天已经访问过的文档
   */
  excludeTodayVisited = true

  /**
   * 2.11 构造函数
   * 初始化配置对象，设置默认值
   */
  constructor() {
    this.filterMode = this.filterMode || FilterMode.Notebook
    this.rootId = this.rootId || ""
    this.excludeTodayVisited = this.excludeTodayVisited !== false
  }
}

export default RandomDocConfig
