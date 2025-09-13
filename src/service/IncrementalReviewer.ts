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
 * ======================================================
 * 漫游式渐进阅读插件 - 渐进式阅读审阅器
 * ======================================================
 * 
 * 本文件实现了渐进式阅读的核心功能，包括文档优先级计算、轮盘赌选择算法、
 * 文档筛选与过滤、指标管理等功能。这是插件最核心的业务逻辑所在。
 * 
 * ## 文件结构
 * 1. 审阅器类定义与初始化 - 渐进审阅器的核心配置与状态
 * 2. 配置管理 - 处理渐进配置的加载与保存
 * 3. 文档获取 - 实现文档查询、过滤与选择
 * 4. 优先级与指标 - 处理文档优先级、指标计算与管理
 * 5. 轮盘赌算法 - 基于优先级的随机选择算法
 * 6. 访问记录 - 管理文档访问次数与历史
 * 7. 工具方法 - 提供过滤条件构建等辅助功能
 */

import { showMessage } from "siyuan"
import RandomDocPlugin from "../index"
import RandomDocConfig, { FilterMode, ReviewMode } from "../models/RandomDocConfig"
import IncrementalConfig, { DocPriorityData, Metric } from "../models/IncrementalConfig"

/**
 * 1. 渐进式阅读审阅器
 * 实现渐进式阅读的核心算法与功能
 */
class IncrementalReviewer {
  /** 1.1 插件配置 */
  private storeConfig: RandomDocConfig
  /** 1.2 插件实例 */
  private pluginInstance: RandomDocPlugin
  /** 1.3 渐进式阅读配置 */
  private incrementalConfig: IncrementalConfig
  
  /** 1.4 文档总数缓存 - 按笔记本ID缓存，避免重复统计查询 */
  private static docCountCache = new Map<string, {count: number, timestamp: number}>()
  private static readonly CACHE_DURATION = 10 * 60 * 1000 // 10分钟缓存

  /**
   * 1.4 构造函数
   * 初始化审阅器并关联配置与插件实例
   * 
   * @param storeConfig 存储配置
   * @param pluginInstance 插件实例
   */
  constructor(storeConfig: RandomDocConfig, pluginInstance: RandomDocPlugin) {
    this.storeConfig = storeConfig
    this.pluginInstance = pluginInstance
    this.incrementalConfig = new IncrementalConfig()
  }

  /**
   * 2. 配置管理
   */
  
  /**
   * 2.1 初始化渐进配置
   * 从存储中加载配置或使用默认值
   */
  public async initIncrementalConfig(): Promise<void> {
    try {
      // 2.1.1 从存储中加载配置
      const configId = this.storeConfig.incrementalConfigId
      const savedConfig = await this.pluginInstance.safeLoad(configId)
      
      if (savedConfig && savedConfig.metrics) {
        // 2.1.2 使用已保存的配置
        this.incrementalConfig.metrics = savedConfig.metrics
      } else {
        // 2.1.3 使用默认配置
        this.incrementalConfig.metrics = IncrementalConfig.getDefaultMetrics()
        await this.saveIncrementalConfig()
      }
    } catch (error) {
      this.pluginInstance.logger.error("初始化渐进配置失败:", error)
      // 2.1.4 出错时使用默认配置
      this.incrementalConfig.metrics = IncrementalConfig.getDefaultMetrics()
    }
  }

  /**
   * 2.2 保存渐进配置
   * 将配置存储到思源存储中
   */
  public async saveIncrementalConfig(): Promise<void> {
    try {
      const configId = this.storeConfig.incrementalConfigId
      await this.pluginInstance.saveData(configId, {
        metrics: this.incrementalConfig.metrics
      })
    } catch (error) {
      this.pluginInstance.logger.error("保存渐进配置失败:", error)
      showMessage("保存配置失败: " + error.message, 5000, "error")
    }
  }

  /**
   * 3. 文档获取
   */
  
  /**
   * 3.1 获取随机文档（基于轮盘赌选择算法）
   * 根据优先级从符合条件的文档中随机选择一篇
   * 
   * @returns 选中的文档ID
   */
  public async getRandomDoc(): Promise<string | { docId: string, isAbsolutePriority: boolean }> {
    try {
      this.pluginInstance.logger.info("开始获取随机文档...")
      
      // 3.1.1 获取最新过滤条件
      const filterCondition = this.buildFilterCondition()
      this.pluginInstance.logger.info(`构建的过滤条件: ${filterCondition}`)
      
      let excludeVisited = ""
      
      // 3.1.2 构建排除已访问文档的条件
      if (this.storeConfig.excludeVisited) {
        this.pluginInstance.logger.info("启用了排除已访问文档选项")
        excludeVisited = `
          AND (
            NOT EXISTS (
              SELECT 1 FROM attributes 
              WHERE block_id = blocks.id 
              AND name = 'custom-visit-count'
              AND value <> ''
            )
          )
        `
      }

      // 3.1.3 获取符合条件的文档总数
      const countSql = `
        SELECT COUNT(id) as total FROM blocks 
        WHERE type = 'd' 
        ${filterCondition}
        ${excludeVisited}
      `
      
      const countResult = await this.pluginInstance.kernelApi.sql(countSql)
      if (countResult.code !== 0) {
        this.pluginInstance.logger.error(`获取文档总数失败，错误码: ${countResult.code}, 错误信息: ${countResult.msg}`)
        showMessage("获取文档总数失败: " + countResult.msg, 7000, "error")
        throw new Error(countResult.msg)
      }
      
      const totalDocCount = countResult.data?.[0]?.total || 0
      this.pluginInstance.logger.info(`符合条件的文档总数: ${totalDocCount}`)
      
      // 3.1.4 检查是否存在符合条件的文档
      if (totalDocCount === 0) {
        const errorMsg = this.storeConfig.excludeVisited 
          ? "所有文档都已访问过，可以重置访问记录或关闭排除已访问选项" 
          : "没有找到符合条件的文档";
          
        this.pluginInstance.logger.error(errorMsg);
        showMessage(errorMsg, 5000, "error");
        throw new Error(errorMsg);
      }

      // 3.1.5 使用分页查询获取所有文档
      const pageSize = 3000 // 每页获取3000个文档，本地SQLite性能优秀
      const expectedPages = Math.ceil(totalDocCount / pageSize)
      this.pluginInstance.logger.info(`开始分页获取 ${totalDocCount} 个文档，每页 ${pageSize} 个，预计需要 ${expectedPages} 次SQL查询`)
      let allDocs = []
      
      for (let offset = 0; offset < totalDocCount; offset += pageSize) {
        // 3.1.5.1 构建分页查询SQL
        const pageSql = `
          SELECT id FROM blocks 
          WHERE type = 'd' 
          ${filterCondition}
          ${excludeVisited}
          LIMIT ${pageSize} OFFSET ${offset}
        `
        
        this.pluginInstance.logger.info(`执行分页查询 ${Math.floor(offset/pageSize) + 1}/${Math.ceil(totalDocCount/pageSize)}: ${pageSql.replace(/\s+/g, ' ')}`)
        
        // 3.1.5.2 执行查询
        const pageResult = await this.pluginInstance.kernelApi.sql(pageSql)
        if (pageResult.code !== 0) {
          this.pluginInstance.logger.error(`分页查询失败，错误码: ${pageResult.code}, 错误信息: ${pageResult.msg}`)
          showMessage("获取文档失败: " + pageResult.msg, 7000, "error")
          throw new Error(pageResult.msg)
        }
        
        // 3.1.5.3 处理查询结果
        const pageDocs = Array.isArray(pageResult.data) ? pageResult.data : [];
        if (pageDocs.length === 0) {
          this.pluginInstance.logger.warn(`分页 ${Math.floor(offset/pageSize) + 1} 没有返回文档，提前结束分页查询`)
          break
        }
        
        // 3.1.5.4 累计文档结果
        allDocs = allDocs.concat(pageDocs)
        this.pluginInstance.logger.info(`已获取 ${allDocs.length}/${totalDocCount} 个文档`)
      }
      
      // 3.1.6 验证查询结果
      if (allDocs.length === 0) {
        const errorMsg = "分页查询未能获取到任何文档"
        this.pluginInstance.logger.error(errorMsg)
        showMessage(errorMsg, 5000, "error")
        throw new Error(errorMsg)
      }
      
      this.pluginInstance.logger.info(`最终获取到 ${allDocs.length}/${totalDocCount} 个文档，实际执行了 ${Math.ceil(allDocs.length / pageSize)} 次分页查询`)
      this.pluginInstance.logger.info(`SQL查询优化效果：从预期的20次减少到 ${Math.ceil(allDocs.length / pageSize)} 次`)
      
      // 3.1.7 记录获取文档数量（仅日志，不显示弹窗）
      this.pluginInstance.logger.info(`已获取 ${allDocs.length} 个文档用于计算漫游概率`)

      // 3.1.8 批量获取所有文档的优先级数据 - 性能优化版本
      this.pluginInstance.logger.info("开始批量获取所有文档的优先级数据...")
      
      // 3.1.8.1 提取所有文档ID
      const allDocIds = allDocs.map(doc => doc.id)
      
      // 3.1.8.2 批量获取所有文档的属性数据（一次SQL查询替代N次API调用）
      const batchStartTime = Date.now()
      const allDocAttributes = await this.getBatchDocAttributes(allDocIds)
      const batchEndTime = Date.now()
      this.pluginInstance.logger.info(`批量属性查询耗时: ${batchEndTime - batchStartTime}ms，平均每个文档: ${((batchEndTime - batchStartTime) / allDocIds.length).toFixed(2)}ms`)
      
      // 3.1.8.3 在内存中处理所有文档的优先级计算
      this.pluginInstance.logger.info(`开始计算 ${allDocs.length} 个文档的优先级...`)
      const priorityStartTime = Date.now()
      const docPriorityList: { docId: string, priority: number }[] = []
      
      for (let i = 0; i < allDocs.length; i++) {
        const doc = allDocs[i]
        try {
          // 从批量获取的属性数据中解析文档数据
          const docAttributes = allDocAttributes[doc.id] || {}
          const docData = this.parseDocPriorityFromAttrs(doc.id, docAttributes)
          
          // 计算优先级
          const priorityResult = await this.calculatePriority(docData)
          docPriorityList.push({ docId: doc.id, priority: priorityResult.priority })
          
        } catch (err) {
          this.pluginInstance.logger.error(`计算文档 ${doc.id} 优先级失败`, err);
          // 返回默认优先级，避免因单个文档失败而中断整个流程
          docPriorityList.push({ docId: doc.id, priority: 5.0 });
        }
        
        // 显示进度（每处理100个文档显示一次）
        if (allDocs.length > 200 && (i + 1) % 100 === 0) {
          this.pluginInstance.logger.info(`已处理 ${i + 1}/${allDocs.length} 个文档的优先级计算`)
        }
      }
      
      const priorityEndTime = Date.now()
      this.pluginInstance.logger.info(`成功计算 ${docPriorityList.length} 个文档的优先级数据`)
      this.pluginInstance.logger.info(`优先级计算耗时: ${priorityEndTime - priorityStartTime}ms，平均每个文档: ${((priorityEndTime - priorityStartTime) / allDocs.length).toFixed(2)}ms`)
      this.pluginInstance.logger.info(`总优化效果: 批量查询(${batchEndTime - batchStartTime}ms) + 计算(${priorityEndTime - priorityStartTime}ms) = ${(batchEndTime - batchStartTime) + (priorityEndTime - priorityStartTime)}ms`)
      
      // 3.1.10 记录前几个文档的优先级情况（调试用）
      const top5Docs = docPriorityList.slice(0, 5).map(doc => `${doc.docId}: ${doc.priority.toFixed(2)}`);
      this.pluginInstance.logger.info(`前5个文档的优先级: ${top5Docs.join(', ')}`)

      // 绝对优先级顺序漫游概率逻辑
      const prob = this.storeConfig.absolutePriorityProb ?? 0
      if (prob > 0 && Math.random() < prob) {
        // 直接选择优先级最高的未访问文档
        let maxDoc = docPriorityList[0]
        for (const doc of docPriorityList) {
          if (doc.priority > maxDoc.priority) maxDoc = doc
        }
        this.pluginInstance.logger.info(`绝对优先级顺序漫游命中，直接选择文档: ${maxDoc.docId}`)
        await this.updateVisitCount(maxDoc.docId)
        // 不计算轮盘赌概率，直接返回
        return { docId: maxDoc.docId, isAbsolutePriority: true }
      }

      // 3.1.11 使用轮盘赌算法选择文档
      const selectedDoc = this.rouletteWheelSelection(docPriorityList)
      this.pluginInstance.logger.info(`选中的文档ID: ${selectedDoc}`)
      
      // 3.1.12 计算并记录选中文档的概率
      const selectedDocInfo = docPriorityList.find(item => item.docId === selectedDoc)
      if (!selectedDocInfo) {
        this.pluginInstance.logger.error(`严重错误：无法找到选中文档 ${selectedDoc} 的优先级信息`)
        throw new Error(`无法找到选中文档 ${selectedDoc} 的优先级信息`)
      }
      
      // 3.1.13 计算总优先级（高精度）
      const totalPriority = docPriorityList.reduce((sum, item) => sum + item.priority, 0)
      this.pluginInstance.logger.info(`所有文档总优先级: ${totalPriority.toFixed(6)}`)
      
      try {
        this.pluginInstance.logger.info(`开始计算选中文档的概率...`)
        // 3.1.14 精确计算概率值
        this._lastSelectionProbability = this.calculateSelectionProbability(
          selectedDocInfo.priority, 
          totalPriority
        )
        
        this.pluginInstance.logger.info(`概率计算完成, 最终结果: ${this._lastSelectionProbability.toFixed(6)}%`)
      } catch (error) {
        this.pluginInstance.logger.error('计算概率时出错:', error)
        throw new Error(`计算选中概率失败: ${error.message}`)
      }
      
      // 3.1.15 更新访问次数
      await this.updateVisitCount(selectedDoc)
      this.pluginInstance.logger.info("已更新文档的访问次数")
      
      // 3.1.16 记录漫游历史
      try {
        const blockResult = await this.pluginInstance.kernelApi.getBlockByID(selectedDoc)
        if (blockResult) {
          const docTitle = blockResult.content || "无标题文档"
          // await this.saveRoamingHistory(selectedDoc, docTitle, this._lastSelectionProbability)
        }
      } catch (error) {
        this.pluginInstance.logger.error('获取文档标题失败，不影响漫游过程:', error)
      }
      
      return { docId: selectedDoc, isAbsolutePriority: false }
    } catch (error) {
      this.pluginInstance.logger.error("获取随机文档失败", error)
      showMessage("获取随机文档失败: " + error.message, 5000, "error")
      throw error
    }
  }

  /**
   * 3.2 获取符合条件的文档总数
   * 
   * @param config 可选配置，不提供则使用当前配置
   * @returns 文档总数
   */
  public async getTotalDocCount(config?: RandomDocConfig): Promise<number> {
    console.log("📊 getTotalDocCount 被调用")
    try {
      // 3.2.1 使用传入的配置或当前最新配置
      const targetConfig = config || this.storeConfig
      console.log("🎯 使用的配置:", targetConfig)
      console.log("🏷️ 配置中的标签:", targetConfig.tags)
      console.log("📋 配置中的筛选模式:", targetConfig.filterMode)
      
      // 3.2.2 生成缓存键并尝试从缓存获取
      const cacheKey = this.generateCacheKey(targetConfig)
      console.log("🔑 生成的缓存键:", cacheKey)
      const cachedCount = this.getFromCache(cacheKey)
      
      if (cachedCount !== null) {
        console.log("🎯 命中缓存，返回:", cachedCount)
        // 命中缓存，直接返回
        return cachedCount
      }
      
      console.log("❌ 缓存未命中，开始构建SQL")
      // 3.2.3 缓存未命中，执行SQL查询
      const filterCondition = this.buildFilterCondition(targetConfig)
      console.log("🔍 构建的筛选条件:", filterCondition)
      const sql = `
        SELECT COUNT(id) as total FROM blocks 
        WHERE type = 'd' 
        ${filterCondition}
      `
      console.log("📝 最终SQL查询:", sql)
      
      this.pluginInstance.logger.info(`缓存未命中，执行SQL查询: ${cacheKey}`)
      
      // 3.2.4 执行查询
      const result = await this.pluginInstance.kernelApi.sql(sql)
      if (result.code !== 0) {
        this.pluginInstance.logger.error(`获取文档总数时出错，错误码: ${result.code}, 错误信息: ${result.msg}`)
        throw new Error(`获取文档总数时出错: ${result.msg}`)
      }
      
      const count = result.data?.[0]?.total || 0
      
      // 3.2.5 设置缓存
      this.setCache(cacheKey, count)
      
      this.pluginInstance.logger.info(`获取到文档总数: ${count}，已缓存`)
      return count
    } catch (error) {
      this.pluginInstance.logger.error("获取文档总数时出错:", error)
      throw error
    }
  }

  /**
   * 获取所有文档的优先级列表，包含id、标题和优先级
   * @returns 文档优先级列表
   */
  public async getPriorityList(): Promise<Array<{id: string; title?: string; priority: number}>> {
    try {
      // 获取最新过滤条件
      const filterCondition = this.buildFilterCondition()
      
      // 获取符合条件的文档总数
      const totalCount = await this.getTotalDocCount()
      if (totalCount === 0) {
        return [];
      }
      
      // 使用分页查询获取所有文档
      const pageSize = 3000 // 每页获取3000个文档，本地SQLite性能优秀
      let allDocs = []
      
      for (let offset = 0; offset < totalCount; offset += pageSize) {
        // 构建分页查询SQL
        const pageSql = `
          SELECT id, content FROM blocks 
          WHERE type = 'd' 
          ${filterCondition}
          LIMIT ${pageSize} OFFSET ${offset}
        `
        
        // 执行查询
        const pageResult = await this.pluginInstance.kernelApi.sql(pageSql)
        if (pageResult.code !== 0) {
          this.pluginInstance.logger.error(`分页查询失败，错误码: ${pageResult.code}, 错误信息: ${pageResult.msg}`)
          throw new Error(pageResult.msg)
        }
        
        // 处理查询结果
        const pageDocs = Array.isArray(pageResult.data) ? pageResult.data : [];
        if (pageDocs.length === 0) {
          break
        }
        
        // 累计文档结果
        allDocs = allDocs.concat(pageDocs)
      }
      
      // 批量获取文档的优先级 - 性能优化版本
      this.pluginInstance.logger.info(`开始批量计算 ${allDocs.length} 个文档的优先级列表...`)
      
      // 提取所有文档ID
      const allDocIds = allDocs.map(doc => doc.id)
      
      // 批量获取所有文档的属性数据（一次SQL查询替代N次API调用）
      const allDocAttributes = await this.getBatchDocAttributes(allDocIds)
      
      // 在内存中处理所有文档的优先级计算
      const priorityList: Array<{id: string; title?: string; priority: number}> = []
      
      for (let i = 0; i < allDocs.length; i++) {
        const doc = allDocs[i]
        try {
          // 从批量获取的属性数据中解析文档数据
          const docAttributes = allDocAttributes[doc.id] || {}
          const docData = this.parseDocPriorityFromAttrs(doc.id, docAttributes)
          
          // 计算优先级
          const priorityResult = await this.calculatePriority(docData)
          
          // 提取文档标题
          let title = doc.content
          if (title && title.length > 0) {
            // 从content中提取标题，通常是第一行的markdown标题
            const titleMatch = title.match(/^#+\s+(.+)$/m)
            if (titleMatch && titleMatch[1]) {
              title = titleMatch[1].trim()
            } else {
              // 或者使用内容的前30个字符
              title = title.substring(0, 30) + (title.length > 30 ? '...' : '')
            }
          } else {
            title = '未命名文档'
          }
          
          priorityList.push({ 
            id: doc.id, 
            title, 
            priority: priorityResult.priority 
          })
          
        } catch (err) {
          this.pluginInstance.logger.warn(`计算文档 ${doc.id} 优先级失败:`, err)
          priorityList.push({ 
            id: doc.id, 
            title: '未知文档', 
            priority: 5.0 // 默认优先级 
          })
        }
        
        // 显示进度（每处理50个文档显示一次）
        if (allDocs.length > 100 && (i + 1) % 50 === 0) {
          this.pluginInstance.logger.info(`优先级列表计算进度: ${i + 1}/${allDocs.length}`)
        }
      }
      
      this.pluginInstance.logger.info(`成功计算 ${priorityList.length} 个文档的优先级列表`)
      
      // 按优先级排序（从高到低）
      priorityList.sort((a, b) => b.priority - a.priority)
      return priorityList
    } catch (error) {
      this.pluginInstance.logger.error("获取文档优先级列表失败:", error)
      throw error
    }
  }

  /**
   * 获取文档信息，包括ID和标题
   * @param docId 文档ID
   * @returns 文档信息
   */
  public async getDocInfo(docId: string): Promise<{id: string; title: string} | null> {
    try {
      if (!docId) return null;
      
      // 查询文档内容
      const sql = `SELECT id, content FROM blocks WHERE id = '${docId}' AND type = 'd'`
      const result = await this.pluginInstance.kernelApi.sql(sql)
      
      if (result.code !== 0 || !result.data || !Array.isArray(result.data) || result.data.length === 0) {
        return null;
      }
      
      const doc = result.data[0];
      
      // 提取文档标题
      let title = doc.content;
      if (title && title.length > 0) {
        // 从content中提取标题，通常是第一行的markdown标题
        const titleMatch = title.match(/^#+\s+(.+)$/m)
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1].trim()
        } else {
          // 或者使用内容的前30个字符
          title = title.substring(0, 30) + (title.length > 30 ? '...' : '')
        }
      } else {
        title = '未命名文档'
      }
      
      return {
        id: docId,
        title
      };
    } catch (error) {
      this.pluginInstance.logger.error(`获取文档 ${docId} 信息失败:`, error)
      return null;
    }
  }

  /**
   * 4. 优先级与指标
   */

  /**
   * 4.0 批量获取多个文档的属性数据 - 性能优化：一次SQL查询替代N次API调用
   * @param docIds 文档ID数组
   * @returns 文档ID到属性映射的对象
   */
  public async getBatchDocAttributes(docIds: string[]): Promise<{[docId: string]: {[key: string]: string}}> {
    try {
      if (docIds.length === 0) return {}
      
      // 构建IN查询条件
      const docIdList = docIds.map(id => `'${id}'`).join(',')
      
      // 批量查询所有文档的custom-metric属性
      const sql = `
        SELECT block_id, name, value 
        FROM attributes 
        WHERE block_id IN (${docIdList}) 
          AND name LIKE 'custom-metric-%'
        ORDER BY block_id, name
      `
      
      this.pluginInstance.logger.info(`批量查询${docIds.length}个文档的属性数据...`)
      const result = await this.pluginInstance.kernelApi.sql(sql)
      
      if (result.code !== 0) {
        this.pluginInstance.logger.error(`批量查询属性失败: ${result.msg}`)
        throw new Error(`批量查询属性失败: ${result.msg}`)
      }
      
      // 将结果组织为 {docId: {attrName: attrValue}} 的格式
      const attributesMap: {[docId: string]: {[key: string]: string}} = {}
      
      if (result.data && Array.isArray(result.data)) {
        for (const row of result.data) {
          const docId = row.block_id
          const attrName = row.name
          const attrValue = row.value
          
          if (!attributesMap[docId]) {
            attributesMap[docId] = {}
          }
          attributesMap[docId][attrName] = attrValue
        }
      }
      
      this.pluginInstance.logger.info(`成功获取${Object.keys(attributesMap).length}个文档的属性数据`)
      return attributesMap
      
    } catch (error) {
      this.pluginInstance.logger.error('批量获取文档属性失败:', error)
      throw error
    }
  }

  /**
   * 4.1 从属性数据解析文档优先级数据 - 纯内存操作，配合批量查询使用
   * @param docId 文档ID
   * @param attributes 文档属性映射
   * @returns 文档优先级数据对象
   */
  public parseDocPriorityFromAttrs(docId: string, attributes: {[key: string]: string}): DocPriorityData {
    const docData: DocPriorityData = {
      docId,
      metrics: {}
    }
    
    // 跟踪需要更新的指标（批量模式下暂不自动修复，避免大量写操作）
    const metricsToUpdate: { [key: string]: string } = {}
    let hasInvalidMetrics = false
    
    // 获取每个指标的值并检查修复
    for (const metric of this.incrementalConfig.metrics) {
      const attrKey = `custom-metric-${metric.id}`
      const rawValue = attributes[attrKey]
      let metricValue: number
      
      // 检查指标是否为空或0，设置默认值
      if (!rawValue || rawValue === '' || parseFloat(rawValue) === 0) {
        metricValue = 5.0
        metricsToUpdate[attrKey] = metricValue.toFixed(4)
        hasInvalidMetrics = true
        this.pluginInstance.logger.debug(`文档 ${docId} 的指标 ${metric.id} 为空或0，将使用默认值5.0`)
      } else {
        metricValue = parseFloat(rawValue)
      }
      
      docData.metrics[metric.id] = metricValue
    }
    
    // 如果有无效指标，记录但不立即修复（避免批量写操作影响性能）
    if (hasInvalidMetrics) {
      this.pluginInstance.logger.debug(`文档 ${docId} 存在无效指标，建议后续修复`)
    }
    
    return docData
  }

  /**
   * 4.2 获取文档的优先级数据（单个文档版本，保持向下兼容）
   * 读取文档属性中存储的指标值，并自动修复空值或无效值
   * 
   * @param docId 文档ID
   * @returns 文档优先级数据对象
   */
  public async getDocPriorityData(docId: string): Promise<DocPriorityData> {
    try {
      // 4.1.1 获取文档属性
      const attrs = await this.pluginInstance.kernelApi.getBlockAttrs(docId)
      const data = attrs.data || attrs

      // 4.1.2 准备文档数据对象
      const docData: DocPriorityData = {
        docId,
        metrics: {}
      }

      // 4.1.3 跟踪需要更新的指标
      const metricsToUpdate: { [key: string]: string } = {}
      
      // 4.1.4 获取每个指标的值并检查修复
      for (const metric of this.incrementalConfig.metrics) {
        const attrKey = `custom-metric-${metric.id}`
        const rawValue = data[attrKey]
        let metricValue: number
        
        // 4.1.4.1 检查指标是否为空或0，设置默认值
        if (!rawValue || rawValue === '' || parseFloat(rawValue) === 0) {
          metricValue = 5.0
          metricsToUpdate[attrKey] = metricValue.toFixed(4)
          this.pluginInstance.logger.info(`文档 ${docId} 的指标 ${metric.id} 为空或0，将设置为默认值5.0`)
        } else {
          metricValue = parseFloat(rawValue)
        }
        
        docData.metrics[metric.id] = metricValue
      }
      
      // 4.1.5 找出不属于当前配置的多余指标并准备删除
      const currentMetricKeys = this.incrementalConfig.metrics.map(m => `custom-metric-${m.id}`)
      const allMetricKeys = Object.keys(data).filter(key => key.startsWith('custom-metric-'))
      
      for (const key of allMetricKeys) {
        if (!currentMetricKeys.includes(key)) {
          metricsToUpdate[key] = '' // 将值设为空字符串相当于删除
          this.pluginInstance.logger.info(`删除文档 ${docId} 的无效指标 ${key}`)
        }
      }
      
      // 4.1.6 如果有需要更新的指标，执行更新
      if (Object.keys(metricsToUpdate).length > 0) {
        try {
          await this.pluginInstance.kernelApi.setBlockAttrs(docId, metricsToUpdate)
          this.pluginInstance.logger.info(`已更新文档 ${docId} 的 ${Object.keys(metricsToUpdate).length} 个指标`)
        } catch (updateError) {
          this.pluginInstance.logger.error(`更新文档 ${docId} 的指标失败`, updateError)
          // 即使更新失败，也继续返回读取到的数据
        }
      }

      return docData
    } catch (error) {
      this.pluginInstance.logger.error(`获取文档 ${docId} 的优先级数据失败`, error)
      // 4.1.7 返回默认数据
      return {
        docId,
        metrics: this.incrementalConfig.metrics.reduce((obj, metric) => {
          obj[metric.id] = 5.0
          return obj
        }, {})
      }
    }
  }

  /**
   * 4.2 更新文档的指标值
   * 
   * @param docId 文档ID
   * @param metricId 指标ID
   * @param value 新的指标值
   */
  public async updateDocMetric(docId: string, metricId: string, value: number): Promise<void> {
    try {
      // 4.2.1 确保值在0-10之间
      const clampedValue = Math.max(0, Math.min(10, value))
      
      // 4.2.2 更新文档属性
      await this.pluginInstance.kernelApi.setBlockAttrs(docId, {
        [`custom-metric-${metricId}`]: clampedValue.toFixed(4)
      })
      
      showMessage(`已更新指标: ${metricId} = ${clampedValue.toFixed(4)}`, 2000)
    } catch (error) {
      this.pluginInstance.logger.error(`更新文档 ${docId} 的指标 ${metricId} 失败`, error)
      showMessage(`更新指标失败: ${error.message}`, 5000, "error")
    }
  }

  /**
   * 4.3 修复所有文档的指标
   * 将空值或0值设为默认值5，删除多余指标
   * 
   * @param progressCallback 可选的进度回调函数
   * @returns 修复结果统计信息
   */
  public async repairAllDocumentMetrics(
    progressCallback?: (current: number, total: number) => void
  ): Promise<{
    totalDocs: number,
    updatedDocs: number,
    updatedMetrics: { id: string, name: string, count: number }[],
    deletedMetricsCount: number
  }> {
    try {
      // 4.3.1 使用空过滤条件，处理所有文档
      const filterCondition = this.buildEmptyFilterCondition()
      this.pluginInstance.logger.info("修复指标: 使用空过滤条件，将处理所有文档")
      
      // 4.3.2 初始化统计变量
      let totalUpdatedDocs = 0
      let updatedMetricsMap = new Map()
      let totalDeletedMetrics = 0
      
      // 4.3.3 初始化指标统计计数器
      this.incrementalConfig.metrics.forEach(metric => {
        updatedMetricsMap.set(metric.id, { id: metric.id, name: metric.name, count: 0 })
      })
      
      // 4.3.4 获取符合条件的文档总数
      const countSql = `
        SELECT COUNT(id) AS total FROM blocks 
        WHERE type = 'd' 
        ${filterCondition}
      `
      
      const countResult = await this.pluginInstance.kernelApi.sql(countSql)
      if (countResult.code !== 0) {
        throw new Error(countResult.msg)
      }
      
      const totalDocCount = countResult.data?.[0]?.total || 0
      this.pluginInstance.logger.info(`符合条件的文档总数: ${totalDocCount}`)
      
      if (totalDocCount === 0) {
        return { totalDocs: 0, updatedDocs: 0, updatedMetrics: [], deletedMetricsCount: 0 }
      }
      
      // 4.3.5 使用分页查询处理所有文档
      const pageSize = 100 // 每页处理100个文档
      let processedCount = 0
      let allDocs = []
      
      // 4.3.6 显示处理范围提示
      showMessage(`将处理所有文档的指标 (共${totalDocCount}篇)`, 3000, "info")
      
      // 4.3.7 获取所有文档ID
      for (let offset = 0; offset < totalDocCount; offset += pageSize) {
        // 4.3.7.1 使用分页查询获取文档
        const pageSql = `
          SELECT id FROM blocks 
          WHERE type = 'd' 
          ${filterCondition}
          LIMIT ${pageSize} OFFSET ${offset}
        `
        
        const pageResult = await this.pluginInstance.kernelApi.sql(pageSql)
        if (pageResult.code !== 0) {
          throw new Error(pageResult.msg)
        }
        
        const pageDocs = pageResult.data as any[] || []
        allDocs = allDocs.concat(pageDocs)
        this.pluginInstance.logger.info(`获取分页 ${Math.floor(offset/pageSize) + 1}/${Math.ceil(totalDocCount/pageSize)}，共 ${pageDocs.length} 篇文档`)
      }
      
      this.pluginInstance.logger.info(`总共获取 ${allDocs.length} 篇文档，将检查指标完整性`)
      
      // 4.3.8 顺序处理每篇文档的指标
      for (let i = 0; i < allDocs.length; i++) {
        const doc = allDocs[i]
        
        // 4.3.8.1 更新进度
        if (progressCallback) {
          progressCallback(i + 1, allDocs.length)
        }
        
        // 4.3.8.2 定期更新进度提示
        if (i % 50 === 0 || i === allDocs.length - 1) {
          showMessage(`正在处理文档指标: ${i+1}/${allDocs.length}`, 1000, "info")
        }
        
        // 4.3.8.3 获取文档当前的所有属性
        const attrs = await this.pluginInstance.kernelApi.getBlockAttrs(doc.id)
        const data = attrs.data || attrs
        
        // 4.3.8.4 统计需要更新的指标
        const metricsToUpdate: { [key: string]: string } = {}
        let docUpdated = false
        
        // 4.3.8.5 检查每个当前配置中的指标
        for (const metric of this.incrementalConfig.metrics) {
          const attrKey = `custom-metric-${metric.id}`
          const rawValue = data[attrKey]
          
          // 4.3.8.6 检查指标是否为空或0
          if (!rawValue || rawValue === '' || parseFloat(rawValue) === 0) {
            const defaultValue = 5.0
            metricsToUpdate[attrKey] = defaultValue.toFixed(4)
            
            // 4.3.8.7 更新统计信息
            if (updatedMetricsMap.has(metric.id)) {
              updatedMetricsMap.get(metric.id).count++
              docUpdated = true
            }
          }
        }
        
        // 4.3.8.8 找出不属于当前配置的多余指标
        const currentMetricKeys = this.incrementalConfig.metrics.map(m => `custom-metric-${m.id}`)
        const allMetricKeys = Object.keys(data).filter(key => key.startsWith('custom-metric-'))
        const invalidMetrics = allMetricKeys.filter(key => !currentMetricKeys.includes(key))
        
        // 4.3.8.9 删除无效指标
        for (const key of invalidMetrics) {
          metricsToUpdate[key] = '' // 将值设为空字符串相当于删除
          totalDeletedMetrics++
          docUpdated = true
        }
        
        // 4.3.8.10 如果有需要更新的指标，执行更新
        if (Object.keys(metricsToUpdate).length > 0) {
          try {
            await this.pluginInstance.kernelApi.setBlockAttrs(doc.id, metricsToUpdate)
            this.pluginInstance.logger.info(
              `已更新文档 ${doc.id} 的指标 [${i+1}/${allDocs.length}]: ` + 
              `新增/修复 ${Object.keys(metricsToUpdate).filter(k => metricsToUpdate[k] !== '').length}个, ` +
              `删除 ${invalidMetrics.length}个`
            )
          } catch (updateError) {
            this.pluginInstance.logger.error(`更新文档 ${doc.id} 的指标失败 [${i+1}/${allDocs.length}]`, updateError)
          }
        }
        
        // 4.3.8.11 如果文档有更新，计数加1
        if (docUpdated) {
          totalUpdatedDocs++
        }
      }
      
      // 4.3.9 完成后显示结果
      showMessage(`指标修复完成! 处理了 ${allDocs.length} 篇文档，更新了 ${totalUpdatedDocs} 篇`, 5000, "info")
      
      // 4.3.10 返回统计结果
      return {
        totalDocs: allDocs.length,
        updatedDocs: totalUpdatedDocs,
        updatedMetrics: Array.from(updatedMetricsMap.values()).filter(m => m.count > 0),
        deletedMetricsCount: totalDeletedMetrics
      }
    } catch (error) {
      this.pluginInstance.logger.error("修复文档指标失败", error)
      showMessage(`修复文档指标失败: ${error.message}`, 5000, "error")
      throw error
    }
  }

  /**
   * 4.4 获取当前所有指标
   * 
   * @returns 指标列表
   */
  getMetrics(): Metric[] {
    return this.incrementalConfig.metrics
  }

  /**
   * 4.5 添加指标
   * 
   * @param metric 要添加的指标
   */
  async addMetric(metric: Metric): Promise<void> {
    this.incrementalConfig.addMetric(metric)
    await this.saveIncrementalConfig()
  }

  /**
   * 4.6 删除指标
   * 
   * @param metricId 要删除的指标ID
   */
  async removeMetric(metricId: string): Promise<void> {
    this.incrementalConfig.removeMetric(metricId)
    await this.saveIncrementalConfig()
  }

  /**
   * 4.7 更新指标
   * 
   * @param metricId 要更新的指标ID
   * @param updates 指标更新内容
   */
  async updateMetric(metricId: string, updates: Partial<Metric>): Promise<void> {
    this.incrementalConfig.updateMetric(metricId, updates)
    await this.saveIncrementalConfig()
  }

  /**
   * 4.8 计算文档的优先级
   * 
   * @param docData 文档优先级数据
   * @returns 优先级计算结果
   */
  private async calculatePriority(docData: DocPriorityData): Promise<{ priority: number }> {
    // 直接使用incrementalConfig计算优先级，不再进行指标修复
    return this.incrementalConfig.calculatePriority(docData);
  }

  /**
   * 4.4 更新文档的优先级属性
   * 直接设置文档的custom-priority属性
   * 
   * @param docId 文档ID
   * @param priority 新的优先级值
   */
  public async updateDocPriority(docId: string, priority: number): Promise<void> {
    try {
      // 4.4.1 确保值在0-10之间
      const clampedPriority = Math.max(0, Math.min(10, priority))
      
      // 4.4.2 更新文档的优先级属性
      await this.pluginInstance.kernelApi.setBlockAttrs(docId, {
        "custom-priority": clampedPriority.toFixed(4)
      })
      
      this.pluginInstance.logger.info(`已更新文档 ${docId} 的优先级为 ${clampedPriority.toFixed(4)}`)
    } catch (error) {
      this.pluginInstance.logger.error(`更新文档 ${docId} 的优先级失败`, error)
      throw error
    }
  }

  /**
   * 4.5 获取所有可用标签
   * 从数据库中获取所有存在的标签，用于下拉选择
   */
  public async getAllAvailableTags(): Promise<string[]> {
    try {
      const sql = `SELECT tag FROM blocks WHERE tag IS NOT NULL AND tag != "" GROUP BY tag ORDER BY tag`
      const result = await this.pluginInstance.kernelApi.sql(sql)
      
      // 检查返回结果格式
      if (result.code !== 0) {
        this.pluginInstance.logger.error(`SQL执行失败，错误码: ${result.code}, 错误信息: ${result.msg}`)
        return []
      }
      
      const actualData = result.data || []
      
      if (actualData && actualData.length > 0) {
        // 处理标签数据，包括复合标签（如 "#展开# #练习#"）
        const allTags = new Set<string>()
        
        actualData.forEach((row) => {
          const tagValue = row.tag
          if (tagValue) {
            // 拆分复合标签（多个标签用空格分隔）
            const individualTags = tagValue.split(/\s+/).filter(t => t.trim().length > 0)
            
            individualTags.forEach(tag => {
              // 去除 # 前后缀，返回纯标签名
              let cleanTag = tag.trim()
              
              if (cleanTag.startsWith('#')) {
                cleanTag = cleanTag.substring(1)
              }
              if (cleanTag.endsWith('#')) {
                cleanTag = cleanTag.substring(0, cleanTag.length - 1)
              }
              
              if (cleanTag.length > 0) {
                allTags.add(cleanTag)
              }
            })
          }
        })
        
        const tags = Array.from(allTags).sort()
        this.pluginInstance.logger.info(`获取到 ${tags.length} 个可用标签`)
        return tags
      } else {
        return []
      }
      
    } catch (error) {
      console.error("❌ getAllAvailableTags 发生错误:", error)
      console.error("❌ 错误详情:", error.message)
      console.error("❌ 错误堆栈:", error.stack)
      this.pluginInstance.logger.error("获取可用标签失败", error)
      return []
    }
  }

  /**
   * 5. 轮盘赌算法
   */
  
  /**
   * 5.1 轮盘赌选择算法
   * 根据文档优先级权重随机选择一篇文档
   * 
   * @param items 文档列表及其优先级
   * @returns 选中的文档ID
   */
  private rouletteWheelSelection(items: { docId: string, priority: number }[]): string {
    // 5.1.1 严格校验输入
    if (!items || items.length === 0) {
      throw new Error("轮盘赌选择算法需要至少一个项目")
    }
    
    this.pluginInstance.logger.info(`----------------轮盘赌选择过程----------------`)
    this.pluginInstance.logger.info(`总文档数: ${items.length}`)
    
    // 5.1.2 计算总优先级（使用高精度计算）
    const totalPriority = items.reduce((sum, item) => {
      // 5.1.2.1 确保每个优先级都是有效数字
      if (typeof item.priority !== 'number' || isNaN(item.priority)) {
        throw new Error(`文档 ${item.docId} 的优先级值无效: ${item.priority}`)
      }
      if (item.priority < 0) {
        throw new Error(`文档 ${item.docId} 的优先级值为负数: ${item.priority}`)
      }
      return sum + item.priority
    }, 0)
    
    // 5.1.3 检查总优先级
    if (totalPriority === 0) {
      throw new Error("所有文档的总优先级为0，无法使用轮盘赌算法选择")
    }
    
    this.pluginInstance.logger.info(`文档总优先级值: ${totalPriority.toFixed(6)}`)
    
    // 5.1.4 生成随机数
    const random = Math.random() * totalPriority
    this.pluginInstance.logger.info(`生成随机数: ${random.toFixed(6)} (范围: 0 - ${totalPriority.toFixed(6)})`)
    
    // 5.1.5 记录文档概率分布
    this.pluginInstance.logger.info(`文档概率分布:`)
    // 5.1.5.1 按概率从高到低排序
    const sortedItems = [...items].sort((a, b) => b.priority - a.priority);
    
    // 5.1.6 显示前5个最高概率的文档
    this.pluginInstance.logger.info(`最高概率的5个文档:`)
    for (let i = 0; i < Math.min(5, sortedItems.length); i++) {
      const item = sortedItems[i];
      const ratio = (item.priority / totalPriority) * 100;
      this.pluginInstance.logger.info(`[${i+1}] 文档ID: ${item.docId.substring(0, 8)}..., 优先级: ${item.priority.toFixed(4)}, 概率: ${ratio.toFixed(4)}%`);
    }
    
    // 5.1.7 概率分布统计功能已删除
    
    // 5.1.9 执行轮盘赌选择
    let accumulatedPriority = 0
    for (const item of items) {
      accumulatedPriority += item.priority
      
      // 5.1.9.1 精确比较，避免浮点数精度问题
      if (random <= accumulatedPriority || Math.abs(random - accumulatedPriority) < 1e-10) {
        const ratio = (item.priority / totalPriority) * 100;
        this.pluginInstance.logger.info(`选中文档: ${item.docId}`);
        this.pluginInstance.logger.info(`选中文档优先级: ${item.priority.toFixed(6)}`);
        this.pluginInstance.logger.info(`选中文档概率: ${ratio.toFixed(6)}%`);
        this.pluginInstance.logger.info(`累积优先级值: ${accumulatedPriority.toFixed(6)}`);
        this.pluginInstance.logger.info(`随机值(${random.toFixed(6)}) <= 累积优先级(${accumulatedPriority.toFixed(6)}), 因此选中当前文档`);
        this.pluginInstance.logger.info(`------------------------------------------------`);
        return item.docId
      }
    }
    
    // 5.1.10 处理浮点数精度边缘情况
    const lastItem = items[items.length - 1]
    
    // 5.1.10.1 验证累积概率误差是否在可接受范围内
    const errorMargin = Math.abs(accumulatedPriority - totalPriority)
    if (errorMargin < 1e-10) {
      this.pluginInstance.logger.warn(`由于浮点数精度问题(误差:${errorMargin.toExponential(6)})，选择最后一个文档: ${lastItem.docId}`)
      return lastItem.docId
    }
    
    // 5.1.10.2 处理算法异常
    throw new Error(`轮盘赌选择算法未能选择文档，随机值: ${random}，总优先级: ${totalPriority}，累积优先级: ${accumulatedPriority}，误差: ${errorMargin}`)
  }

  /**
   * 5.2 计算文档在当前优先级配置下被选中的概率
   * 
   * @param docPriority 文档的优先级
   * @param totalPriority 所有文档的总优先级
   * @returns 选中概率的百分比
   */
  public calculateSelectionProbability(docPriority: number, totalPriority: number): number {
    // 5.2.1 严格校验输入
    if (typeof docPriority !== 'number' || isNaN(docPriority)) {
      throw new Error(`无效的文档优先级值: ${docPriority}`)
    }
    
    if (docPriority < 0) {
      throw new Error(`文档优先级不能为负数: ${docPriority}`)
    }
    
    if (typeof totalPriority !== 'number' || isNaN(totalPriority)) {
      throw new Error(`无效的总优先级值: ${totalPriority}`)
    }
    
    if (totalPriority <= 0) {
      throw new Error(`总优先级必须大于0: ${totalPriority}`)
    }
    
    // 5.2.2 记录输入值
    this.pluginInstance.logger.info(`概率计算详细信息:`)
    this.pluginInstance.logger.info(`- 文档优先级(docPriority): ${docPriority.toFixed(6)}`)
    this.pluginInstance.logger.info(`- 总优先级(totalPriority): ${totalPriority.toFixed(6)}`)
    
    // 5.2.3 严格按照数学公式计算概率
    const probability = (docPriority / totalPriority) * 100
    
    // 5.2.4 记录计算结果
    this.pluginInstance.logger.info(`- 原始计算结果: ${probability.toFixed(6)}%`)
    this.pluginInstance.logger.info(`- 四位小数格式: ${probability.toFixed(4)}%`)
    
    // 5.2.5 记录概率计算过程（仅日志，不显示弹窗）
    this.pluginInstance.logger.info(`概率计算过程:`)
    this.pluginInstance.logger.info(`文档优先级: ${docPriority.toFixed(2)}`)
    this.pluginInstance.logger.info(`总体优先级: ${totalPriority.toFixed(2)}`)
    this.pluginInstance.logger.info(`计算结果: (${docPriority.toFixed(2)} / ${totalPriority.toFixed(2)}) × 100 = ${probability.toFixed(4)}%`)
    
    // 5.2.6 返回原始计算结果，不进行任何约束或舍入
    return probability
  }
  
  /**
   * 5.3 获取最近选中文档的概率
   * 
   * @returns 选中概率的百分比
   */
  private _lastSelectionProbability: number = null
  
  public getLastSelectionProbability(): number {
    if (this._lastSelectionProbability === null) {
      throw new Error("概率值尚未计算")
    }
    return this._lastSelectionProbability
  }
  
  /**
   * 6. 访问记录
   */

  /**
   * 6.1 更新文档的访问次数
   * 
   * @param docId 文档ID
   */
  private async updateVisitCount(docId: string): Promise<void> {
    try {
      // 6.1.1 获取当前访问次数
      const attrs = await this.pluginInstance.kernelApi.getBlockAttrs(docId)
      const data = attrs.data || attrs
      const currentCount = parseInt(data["custom-visit-count"] || "0", 10)
      
      // 6.1.2 递增并更新访问次数
      await this.pluginInstance.kernelApi.setBlockAttrs(docId, {
        "custom-visit-count": (currentCount + 1).toString()
      })
    } catch (error) {
      this.pluginInstance.logger.error(`更新文档 ${docId} 的访问次数失败`, error)
    }
  }

  /**
   * 6.2 重置所有文档的访问记录
   * 
   * @param filterCondition 可选的过滤条件
   */
  public async resetVisited(filterCondition: string = ""): Promise<void> {
    try {
      // 6.2.1 查找所有已访问的文档
      const sql = `
        SELECT id FROM blocks 
        WHERE type = 'd' 
        ${filterCondition}
        AND id IN (
          SELECT block_id FROM attributes 
          WHERE name = 'custom-visit-count' 
          AND value <> ''
        )
      `
      
      const result = await this.pluginInstance.kernelApi.sql(sql)
      if (result.code !== 0) {
        this.pluginInstance.logger.error(`SQL查询失败，错误码: ${result.code}, 错误信息: ${result.msg}`)
        showMessage("获取文档失败: " + result.msg, 7000, "error")
        throw new Error(result.msg)
      }
      
      const docs = result.data as any[]
      if (!docs || docs.length === 0) {
        this.pluginInstance.logger.info("没有访问记录需要重置")
        showMessage("没有访问记录需要重置", 3000)
        return
      }

      this.pluginInstance.logger.info(`找到 ${docs.length} 篇需要重置访问记录的文档`)

      // 6.2.2 重置所有文档的访问记录
      let successCount = 0
      for (const doc of docs) {
        try {
          await this.pluginInstance.kernelApi.setBlockAttrs(doc.id, {
            "custom-visit-count": ""
          })
          successCount++
        } catch (error) {
          this.pluginInstance.logger.error(`重置文档 ${doc.id} 的访问记录失败`, error)
        }
      }

      // 6.2.3 检查重置结果
      if (successCount === 0) {
        throw new Error("重置所有文档的访问记录都失败了")
      }

      this.pluginInstance.logger.info(`成功重置 ${successCount}/${docs.length} 篇文档的访问记录`)
      showMessage(`已重置 ${successCount} 篇文档的访问记录`, 3000)
    } catch (error) {
      this.pluginInstance.logger.error("重置访问记录失败", error)
      showMessage(`重置失败: ${error.message}`, 5000, "error")
      throw error
    }
  }

  /**
   * 6.3 获取今天已访问的文档数量
   * 
   * @returns 已访问文档数量
   */
  public async getVisitedCount(): Promise<number> {
    try {
      const filterCondition = this.buildFilterCondition()
      
      // 6.3.1 构建SQL查询已访问文档
      const sql = `
        SELECT COUNT(id) AS total FROM blocks 
        WHERE type = 'd' 
        ${filterCondition}
        AND id IN (
          SELECT block_id FROM attributes 
          WHERE name = 'custom-visit-count' 
          AND value <> ''
        )
      `
      
      const result = await this.pluginInstance.kernelApi.sql(sql)
      if (result.code !== 0) {
        this.pluginInstance.logger.error(`获取已访问文档数量失败，错误码: ${result.code}, 错误信息: ${result.msg}`)
        return 0
      }
      
      return result.data?.[0]?.total || 0
    } catch (error) {
      this.pluginInstance.logger.error("获取已访问文档数量失败", error)
      return 0
    }
  }

  /**
   * 6.x 获取今日已访问文档详细列表（含id和标题）
   * @returns [{id, content}[]]
   */
  public async getVisitedDocs(): Promise<Array<{id: string, content: string}>> {
    try {
      const filterCondition = this.buildFilterCondition()
      const sql = `
        SELECT id, content FROM blocks 
        WHERE type = 'd' 
        ${filterCondition}
        AND id IN (
          SELECT block_id FROM attributes 
          WHERE name = 'custom-visit-count' 
          AND value <> ''
        )
        ORDER BY updated DESC
      `
      const result = await this.pluginInstance.kernelApi.sql(sql)
      if (result.code !== 0) {
        this.pluginInstance.logger.error(`获取已访问文档列表失败，错误码: ${result.code}, 错误信息: ${result.msg}`)
        return []
      }
      return result.data as Array<{id: string, content: string}>
    } catch (error) {
      this.pluginInstance.logger.error("获取已访问文档列表失败", error)
      return []
    }
  }

  /**
   * 6.7 获取文档的漫游次数
   * 获取文档被浏览的总次数（永久记录，不受重置影响）
   * 
   * @param docId 文档ID
   * @returns 漫游次数
   */
  public async getRoamingCount(docId: string): Promise<number> {
    try {
      const attrs = await this.pluginInstance.kernelApi.getBlockAttrs(docId)
      const data = attrs.data || attrs
      const count = parseInt(data["custom-roaming-count"] || "0", 10)
      return count
    } catch (error) {
      this.pluginInstance.logger.error(`获取文档 ${docId} 的漫游次数失败`, error)
      return 0
    }
  }

  /**
   * 6.8 增加文档的漫游次数
   * 当文档被浏览时调用，增加漫游次数
   * 
   * @param docId 文档ID
   */
  public async incrementRoamingCount(docId: string): Promise<void> {
    try {
      const currentCount = await this.getRoamingCount(docId)
      const newCount = currentCount + 1
      const now = new Date().toISOString()
      await this.pluginInstance.kernelApi.setBlockAttrs(docId, {
        "custom-roaming-count": newCount.toString(),
        "custom-roaming-last": now
      })
      this.pluginInstance.logger.info(`文档 ${docId} 的漫游次数已更新为 ${newCount}，上次访问时间：${now}`)
    } catch (error) {
      this.pluginInstance.logger.error(`更新文档 ${docId} 的漫游次数失败`, error)
    }
  }
  
  /**
   * 6.9 获取文档的上次漫游时间
   * @param docId 文档ID
   * @returns ISO字符串或 undefined
   */
  public async getRoamingLastTime(docId: string): Promise<string | undefined> {
    try {
      const attrs = await this.pluginInstance.kernelApi.getBlockAttrs(docId)
      const data = attrs.data || attrs
      return data["custom-roaming-last"]
    } catch (error) {
      this.pluginInstance.logger.error(`获取文档 ${docId} 的上次漫游时间失败`, error)
      return undefined
    }
  }
  
  /**
   * 7. 工具方法
   */
  
  /**
   * 7.0 文档总数缓存管理
   */
  
  /**
   * 7.0.1 生成缓存键 - 基于过滤条件生成唯一标识
   * @param config 配置对象
   * @returns 缓存键字符串
   */
  private generateCacheKey(config: RandomDocConfig): string {
    const filterMode = config.filterMode || FilterMode.Notebook
    const notebookId = config.notebookId || ""
    const rootId = config.rootId || ""
    const tags = config.tags || []
    
    // 为每种模式生成唯一的缓存键，即使参数为空也要区分模式
    if (filterMode === FilterMode.Notebook) {
      return `notebook:${notebookId}`
    } else if (filterMode === FilterMode.Root) {
      return `root:${rootId}`
    } else if (filterMode === FilterMode.Tag) {
      if (Array.isArray(tags) && tags.length > 0) {
        // 对标签进行排序以确保缓存键一致性
        const sortedTags = tags.filter(tag => tag && tag.trim().length > 0).sort().join(',')
        return `tag:${sortedTags}`
      } else {
        return `tag:empty` // 标签模式但无标签内容
      }
    }
    
    return "all" // 默认所有文档
  }
  
  /**
   * 7.0.2 从缓存获取文档总数
   * @param cacheKey 缓存键
   * @returns 缓存的文档总数，如果缓存过期或不存在则返回null
   */
  private getFromCache(cacheKey: string): number | null {
    const cached = IncrementalReviewer.docCountCache.get(cacheKey)
    if (!cached) return null
    
    const now = Date.now()
    if (now - cached.timestamp > IncrementalReviewer.CACHE_DURATION) {
      // 缓存过期，清除
      IncrementalReviewer.docCountCache.delete(cacheKey)
      this.pluginInstance.logger.info(`缓存已过期并清除: ${cacheKey}`)
      return null
    }
    
    this.pluginInstance.logger.info(`命中缓存: ${cacheKey}, 文档总数: ${cached.count}`)
    return cached.count
  }
  
  /**
   * 7.0.3 设置缓存
   * @param cacheKey 缓存键
   * @param count 文档总数
   */
  private setCache(cacheKey: string, count: number): void {
    IncrementalReviewer.docCountCache.set(cacheKey, {
      count,
      timestamp: Date.now()
    })
    this.pluginInstance.logger.info(`设置缓存: ${cacheKey}, 文档总数: ${count}`)
  }
  
  /**
   * 7.0.4 清理所有缓存 - 应用关闭时调用
   */
  public static clearAllCache(): void {
    IncrementalReviewer.docCountCache.clear()
    console.log("文档总数缓存已清空")
  }

  /**
   * 7.1 构建过滤条件
   * 
   * @param config 可选的配置对象
   * @returns 构建的SQL过滤条件
   */
  public buildFilterCondition(config?: RandomDocConfig): string {
    // 7.1.1 使用传入的配置或当前实例的最新配置
    const targetConfig = config || this.storeConfig
    
    // 7.1.2 从配置中获取过滤模式和相关参数
    const filterMode = targetConfig.filterMode || FilterMode.Notebook
    const notebookId = targetConfig.notebookId || ""
    const rootId = targetConfig.rootId || ""
    const tags = targetConfig.tags || []
    
    // 详细日志：记录当前使用的配置
    this.pluginInstance.logger.info("🏗️ buildFilterCondition 使用的配置:", {
      "是否传入config": !!config,
      "最终使用的filterMode": filterMode,
      "最终使用的notebookId": notebookId,
      "最终使用的rootId": rootId,
      "最终使用的tags": tags,
      "实例this.storeConfig": {
        "filterMode": this.storeConfig.filterMode,
        "notebookId": this.storeConfig.notebookId,
        "rootId": this.storeConfig.rootId,
        "tags": this.storeConfig.tags
      }
    })

    let condition = ""
    
    // 根据筛选模式严格匹配，防止模式切换时的交叉干扰
    if (filterMode === FilterMode.Notebook) {
      // 笔记本模式 - 仅当有笔记本ID时应用过滤
      if (notebookId) {
        const notebookIds = notebookId.split(',')
        if (notebookIds.length > 0) {
          const quotedIds = notebookIds.map(id => `'${id}'`).join(',')
          condition = `AND box IN (${quotedIds})`
          this.pluginInstance.logger.info(`应用笔记本过滤，笔记本IDs: ${quotedIds}`)
        }
      } else {
        this.pluginInstance.logger.info(`笔记本模式但无笔记本ID，不应用过滤条件`)
      }
    } else if (filterMode === FilterMode.Root) {
      // 根文档模式 - 仅当有根文档ID时应用过滤
      if (rootId) {
        condition = `AND path LIKE '%${rootId}%'`
        this.pluginInstance.logger.info(`应用根文档过滤，根文档ID: ${rootId}`)
      } else {
        this.pluginInstance.logger.info(`根文档模式但无根文档ID，不应用过滤条件`)
      }
    } else if (filterMode === FilterMode.Tag) {
      console.log("🏷️ 进入标签过滤模式")
      console.log("📋 传入的tags参数:", tags)
      console.log("🔍 tags类型:", typeof tags)
      console.log("📊 Array.isArray(tags):", Array.isArray(tags))
      
      // 标签模式 - 仅当有标签时应用过滤
      if (tags && Array.isArray(tags) && tags.length > 0) {
        console.log("✅ 标签数组非空，开始处理")
        // 直接使用数组，不需要split操作
        const tagList = tags.filter(tag => tag && tag.trim().length > 0)
        console.log("🧹 过滤后的标签列表:", tagList)
        
        if (tagList.length > 0) {
          console.log("🔨 开始构建标签条件")
          // 找到包含指定标签的文档（通过root_id关联）
          // 标签格式：#标签名#
          const tagConditions = tagList.map(tag => {
            // 确保标签格式为 #标签名#
            let formattedTag = tag.trim()
            if (!formattedTag.startsWith('#')) {
              formattedTag = '#' + formattedTag
            }
            if (!formattedTag.endsWith('#')) {
              formattedTag = formattedTag + '#'
            }
            const sqlCondition = `id IN (SELECT DISTINCT root_id FROM blocks WHERE tag = '${formattedTag}' AND root_id IS NOT NULL AND root_id != '')`
            console.log(`🎯 标签 "${tag}" → 格式化为 "${formattedTag}" → SQL: ${sqlCondition}`)
            return sqlCondition
          })
          condition = `AND (${tagConditions.join(' OR ')})`
          console.log("🏗️ 最终标签筛选条件:", condition)
          this.pluginInstance.logger.info(`应用标签过滤(OR逻辑)，查找包含任一标签的文档，标签列表: ${tagList.join(', ')}`)
        } else {
          console.log("⚠️ 标签模式但过滤后标签列表为空")
          this.pluginInstance.logger.info(`标签模式但标签列表为空，显示所有文档`)
        }
      } else {
        console.log("❌ 标签模式但无有效标签内容")
        console.log("📋 tags:", tags)
        this.pluginInstance.logger.info(`标签模式但无标签内容，显示所有文档`)
      }
    }
    
    return condition
  }
  
  /**
   * 7.2 构建一个空的过滤条件
   * 用于处理所有文档，不使用任何筛选条件
   * 
   * @returns 空过滤条件
   */
  private buildEmptyFilterCondition(): string {
    return ""
  }

  /**
   * 7.3 清空所有文档的指标和优先级数据
   * 完全卸载插件前使用，删除所有相关属性
   * 
   * @param progressCallback 可选的进度回调函数
   * @returns 清理结果统计信息
   */
  public async clearAllDocumentData(
    progressCallback?: (current: number, total: number) => void
  ): Promise<{
    totalDocs: number,
    clearedDocs: number,
    clearedMetricsCount: number,
    clearedPriorityCount: number,
    clearedRoamingCount: number,
    clearedRoamingLast: number,
    clearedVisitCount: number
  }> {
    try {
      // 7.3.1 使用空过滤条件，处理所有文档
      const filterCondition = this.buildEmptyFilterCondition()
      this.pluginInstance.logger.info("清空数据: 使用空过滤条件，将处理所有文档")
      
      // 7.3.2 初始化统计变量
      let totalClearedDocs = 0
      let totalClearedMetrics = 0
      let totalClearedPriority = 0
      let totalClearedRoamingCount = 0
      let totalClearedRoamingLast = 0
      let totalClearedVisitCount = 0
      
      // 7.3.3 获取所有文档总数
      const countSql = `
        SELECT COUNT(id) AS total FROM blocks 
        WHERE type = 'd' 
        ${filterCondition}
      `
      
      const countResult = await this.pluginInstance.kernelApi.sql(countSql)
      if (countResult.code !== 0) {
        throw new Error(countResult.msg)
      }
      
      const totalDocCount = countResult.data?.[0]?.total || 0
      this.pluginInstance.logger.info(`符合条件的文档总数: ${totalDocCount}`)
      
      if (totalDocCount === 0) {
        return { 
          totalDocs: 0, 
          clearedDocs: 0, 
          clearedMetricsCount: 0, 
          clearedPriorityCount: 0,
          clearedRoamingCount: 0,
          clearedRoamingLast: 0,
          clearedVisitCount: 0
        }
      }
      
      // 7.3.4 使用分页查询处理所有文档
      const pageSize = 100 // 每页处理100个文档
      let processedCount = 0
      let allDocs = []
      
      // 7.3.5 显示处理范围提示
      showMessage(`将清空所有文档的指标、优先级、漫游记录和访问记录数据 (共${totalDocCount}篇)`, 3000, "info")
      
      // 7.3.6 获取所有文档ID
      for (let offset = 0; offset < totalDocCount; offset += pageSize) {
        // 7.3.6.1 使用分页查询获取文档
        const pageSql = `
          SELECT id FROM blocks 
          WHERE type = 'd' 
          ${filterCondition}
          LIMIT ${pageSize} OFFSET ${offset}
        `
        
        const pageResult = await this.pluginInstance.kernelApi.sql(pageSql)
        if (pageResult.code !== 0) {
          throw new Error(pageResult.msg)
        }
        
        const pageDocs = pageResult.data as any[] || []
        allDocs = allDocs.concat(pageDocs)
        this.pluginInstance.logger.info(`获取分页 ${Math.floor(offset/pageSize) + 1}/${Math.ceil(totalDocCount/pageSize)}，共 ${pageDocs.length} 篇文档`)
      }
      
      this.pluginInstance.logger.info(`总共获取 ${allDocs.length} 篇文档，将清空指标、优先级、漫游记录和访问记录数据`)
      
      // 7.3.7 顺序处理每篇文档
      for (let i = 0; i < allDocs.length; i++) {
        const doc = allDocs[i]
        processedCount++
        
        // 7.3.7.1 调用进度回调
        if (progressCallback) {
          progressCallback(processedCount, allDocs.length)
        }
        
        try {
          // 7.3.7.2 清空所有指标属性
          const metricsToClear = {}
          this.incrementalConfig.metrics.forEach(metric => {
            metricsToClear[`custom-metric-${metric.id}`] = ""
          })
          
          // 7.3.7.3 清空优先级属性
          metricsToClear["custom-priority"] = ""
          
          // 7.3.7.4 清空漫游和访问记录属性
          metricsToClear["custom-roaming-count"] = ""
          metricsToClear["custom-roaming-last"] = ""
          metricsToClear["custom-visit-count"] = ""
          
          // 7.3.7.5 批量更新文档属性
          await this.pluginInstance.kernelApi.setBlockAttrs(doc.id, metricsToClear)
          
          totalClearedDocs++
          totalClearedMetrics += this.incrementalConfig.metrics.length
          totalClearedPriority++
          totalClearedRoamingCount++
          totalClearedRoamingLast++
          totalClearedVisitCount++
          
          // 7.3.7.5 每处理50个文档显示一次进度
          if (i % 50 === 0 || i === allDocs.length - 1) {
            const progress = Math.floor((processedCount / allDocs.length) * 100)
            showMessage(`正在清空文档数据: ${processedCount}/${allDocs.length} (${progress}%)`, 1000, "info")
          }
          
        } catch (error) {
          this.pluginInstance.logger.error(`清空文档 ${doc.id} 的数据失败`, error)
          // 继续处理下一个文档，不中断整个流程
        }
      }
      
      // 7.3.8 显示完成信息
      this.pluginInstance.logger.info(`成功清空 ${totalClearedDocs}/${allDocs.length} 篇文档的数据`)
      showMessage(`已清空 ${totalClearedDocs} 篇文档的指标、优先级、漫游记录和访问记录数据`, 5000, "info")
      
      return {
        totalDocs: allDocs.length,
        clearedDocs: totalClearedDocs,
        clearedMetricsCount: totalClearedMetrics,
        clearedPriorityCount: totalClearedPriority,
        clearedRoamingCount: totalClearedRoamingCount,
        clearedRoamingLast: totalClearedRoamingLast,
        clearedVisitCount: totalClearedVisitCount
      }
      
    } catch (error) {
      this.pluginInstance.logger.error("清空所有文档数据失败", error)
      showMessage(`清空数据失败: ${error.message}`, 5000, "error")
      throw error
    }
  }
}

export { IncrementalReviewer }
export default IncrementalReviewer 