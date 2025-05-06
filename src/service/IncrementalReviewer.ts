/*
 * Copyright (c) 2023, Terwer . All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 only, as
 * published by the Free Software Foundation.  Terwer designates this
 * particular file as subject to the "Classpath" exception as provided
 * by Terwer in the LICENSE file that accompanied this code.
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
 * Please contact Terwer, Shenzhen, Guangdong, China, youweics@163.com
 * or visit www.terwer.space if you need additional information or have any
 * questions.
 */

import { showMessage } from "siyuan"
import RandomDocPlugin from "../index"
import RandomDocConfig, { FilterMode, ReviewMode } from "../models/RandomDocConfig"
import IncrementalConfig, { DocPriorityData, Metric } from "../models/ProgressiveConfig"

/**
 * 渐进式阅读审阅器
 *
 * @author terwer
 * @since 1.6.0
 */
class IncrementalReviewer {
  private storeConfig: RandomDocConfig
  private pluginInstance: RandomDocPlugin
  private incrementalConfig: IncrementalConfig

  constructor(storeConfig: RandomDocConfig, pluginInstance: RandomDocPlugin) {
    this.storeConfig = storeConfig
    this.pluginInstance = pluginInstance
    this.incrementalConfig = new IncrementalConfig()
  }

  /**
   * 初始化渐进配置
   */
  public async initIncrementalConfig(): Promise<void> {
    try {
      // 从存储中加载配置
      const configId = this.storeConfig.progressiveConfigId
      const savedConfig = await this.pluginInstance.safeLoad(configId)
      
      if (savedConfig && savedConfig.metrics) {
        this.incrementalConfig.metrics = savedConfig.metrics
      } else {
        // 如果没有保存的配置，使用默认值
        this.incrementalConfig.metrics = IncrementalConfig.getDefaultMetrics()
        await this.saveIncrementalConfig()
      }
    } catch (error) {
      this.pluginInstance.logger.error("初始化渐进配置失败:", error)
      // 如果出错，使用默认配置
      this.incrementalConfig.metrics = IncrementalConfig.getDefaultMetrics()
    }
  }

  /**
   * 保存渐进配置
   */
  public async saveIncrementalConfig(): Promise<void> {
    try {
      const configId = this.storeConfig.progressiveConfigId
      await this.pluginInstance.saveData(configId, {
        metrics: this.incrementalConfig.metrics
      })
    } catch (error) {
      this.pluginInstance.logger.error("保存渐进配置失败:", error)
      showMessage("保存配置失败: " + error.message, 5000, "error")
    }
  }

  /**
   * 获取随机文档（基于轮盘赌选择算法）
   */
  public async getRandomDoc(): Promise<string | any> {
    try {
      this.pluginInstance.logger.info("开始获取随机文档...")
      
      const filterCondition = this.buildFilterCondition()
      this.pluginInstance.logger.info(`构建的过滤条件: ${filterCondition}`)
      
      let excludeVisited = ""
      
      // 排除已访问的文档
      if (this.storeConfig.excludeTodayVisited) {
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

      // 获取所有符合条件的文档
      const sql = `
        SELECT id FROM blocks 
        WHERE type = 'd' 
        ${filterCondition}
        ${excludeVisited}
        ORDER BY random()
        LIMIT 100
      `
      this.pluginInstance.logger.info(`执行SQL查询: ${sql.replace(/\s+/g, ' ')}`)
      
      const result = await this.pluginInstance.kernelApi.sql(sql)
      if (result.code !== 0) {
        this.pluginInstance.logger.error(`SQL查询失败，错误码: ${result.code}, 错误信息: ${result.msg}`)
        showMessage("获取文档失败: " + result.msg, 7000, "error")
        throw new Error(result.msg)
      }
      
      const docs = result.data as any[]
      this.pluginInstance.logger.info(`查询到 ${docs?.length || 0} 个符合条件的文档`)
      
      if (!docs || docs.length === 0) {
        const errorMsg = this.storeConfig.excludeTodayVisited 
          ? "所有文档都已访问过，可以重置访问记录或关闭排除已访问选项" 
          : "没有找到符合条件的文档";
          
        this.pluginInstance.logger.error(errorMsg);
        showMessage(errorMsg, 5000, "error");
        throw new Error(errorMsg);
      }

      // 如果文档数量很少，直接随机选择，不必计算优先级
      if (docs.length <= 5) {
        this.pluginInstance.logger.info("文档数量较少，直接随机选择");
        const randomIndex = Math.floor(Math.random() * docs.length);
        const selectedDoc = docs[randomIndex].id;
        
        // 更新访问次数
        await this.updateVisitCount(selectedDoc);
        this.pluginInstance.logger.info(`已选择文档: ${selectedDoc}`);
        return selectedDoc;
      }

      // 获取所有文档的优先级数据
      this.pluginInstance.logger.info("开始获取所有文档的优先级数据...")
      
      try {
        const docPriorityList: { docId: string, priority: number }[] = await Promise.all(
          docs.map(async (doc) => {
            try {
              const docData = await this.getDocPriorityData(doc.id)
              const priority = this.calculatePriority(docData)
              return { docId: doc.id, priority }
            } catch (err) {
              this.pluginInstance.logger.error(`获取文档 ${doc.id} 优先级数据失败`, err);
              // 返回默认优先级
              return { docId: doc.id, priority: 5.0 } 
            }
          })
        )
        
        this.pluginInstance.logger.info(`已获取 ${docPriorityList.length} 个文档的优先级数据`)
        
        // 打印前5个文档的优先级情况，帮助调试
        const top5Docs = docPriorityList.slice(0, 5).map(doc => `${doc.docId}: ${doc.priority.toFixed(2)}`);
        this.pluginInstance.logger.info(`前5个文档的优先级: ${top5Docs.join(', ')}`)

        // 使用轮盘赌算法选择文档
        const selectedDoc = this.rouletteWheelSelection(docPriorityList)
        this.pluginInstance.logger.info(`选中的文档ID: ${selectedDoc}`)
        
        // 更新访问次数
        await this.updateVisitCount(selectedDoc)
        this.pluginInstance.logger.info("已更新文档的访问次数")
        
        return selectedDoc
      } catch (priorityError) {
        this.pluginInstance.logger.error("计算优先级过程中出错，改用随机选择", priorityError);
        // 降级到简单随机选择
        const randomIndex = Math.floor(Math.random() * docs.length);
        const selectedDoc = docs[randomIndex].id;
        
        // 更新访问次数
        await this.updateVisitCount(selectedDoc);
        this.pluginInstance.logger.info(`已降级随机选择文档: ${selectedDoc}`);
        return selectedDoc;
      }
    } catch (error) {
      this.pluginInstance.logger.error("获取随机文档失败", error)
      showMessage("获取随机文档失败: " + error.message, 5000, "error")
      throw error
    }
  }

  /**
   * 获取符合条件的文档总数
   */
  public async getTotalDocCount(): Promise<number> {
    try {
      const filterCondition = this.buildFilterCondition()
      
      // 构建SQL查询
      const sql = `
        SELECT COUNT(id) AS total FROM blocks 
        WHERE type = 'd' 
        ${filterCondition}
      `
      
      const result = await this.pluginInstance.kernelApi.sql(sql)
      if (result.code !== 0) {
        throw new Error(result.msg)
      }
      
      return result.data?.[0]?.total || 0
    } catch (error) {
      this.pluginInstance.logger.error("获取文档总数失败", error)
      return 0
    }
  }

  /**
   * 获取文档的优先级数据
   */
  public async getDocPriorityData(docId: string): Promise<DocPriorityData> {
    try {
      const attrs = await this.pluginInstance.kernelApi.getBlockAttrs(docId)
      const data = attrs.data || attrs

      // 准备文档数据对象
      const docData: DocPriorityData = {
        docId,
        metrics: {}
      }

      // 获取每个指标的值
      for (const metric of this.incrementalConfig.metrics) {
        const metricValue = parseFloat(data[`custom-metric-${metric.id}`] || '5.0')
        docData.metrics[metric.id] = metricValue
      }

      return docData
    } catch (error) {
      this.pluginInstance.logger.error(`获取文档 ${docId} 的优先级数据失败`, error)
      // 返回默认数据
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
   * 更新文档的指标值
   */
  public async updateDocMetric(docId: string, metricId: string, value: number): Promise<void> {
    try {
      // 确保值在0-10之间
      const clampedValue = Math.max(0, Math.min(10, value))
      
      // 更新文档属性
      await this.pluginInstance.kernelApi.setBlockAttrs(docId, {
        [`custom-metric-${metricId}`]: clampedValue.toFixed(1)
      })
      
      showMessage(`已更新指标: ${metricId} = ${clampedValue.toFixed(1)}`, 2000)
    } catch (error) {
      this.pluginInstance.logger.error(`更新文档 ${docId} 的指标 ${metricId} 失败`, error)
      showMessage(`更新指标失败: ${error.message}`, 5000, "error")
    }
  }

  /**
   * 更新文档的访问次数
   */
  private async updateVisitCount(docId: string): Promise<void> {
    try {
      // 获取当前访问次数
      const attrs = await this.pluginInstance.kernelApi.getBlockAttrs(docId)
      const data = attrs.data || attrs
      const currentCount = parseInt(data["custom-visit-count"] || "0", 10)
      
      // 更新访问次数
      await this.pluginInstance.kernelApi.setBlockAttrs(docId, {
        "custom-visit-count": (currentCount + 1).toString()
      })
    } catch (error) {
      this.pluginInstance.logger.error(`更新文档 ${docId} 的访问次数失败`, error)
    }
  }

  /**
   * 重置所有文档的访问记录
   */
  public async resetTodayVisits(): Promise<void> {
    try {
      const filterCondition = this.buildFilterCondition()
      
      // 构建SQL查询，找出所有已访问的文档
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
        showMessage("获取文档失败", 7000, "error")
        throw new Error(result.msg)
      }
      
      const docs = result.data as any[]
      if (!docs || docs.length === 0) {
        showMessage("没有访问记录需要重置", 3000)
        return
      }

      // 重置所有文档的访问记录
      await Promise.all(
        docs.map(async (doc) => {
          await this.pluginInstance.kernelApi.setBlockAttrs(doc.id, {
            "custom-visit-count": ""
          })
        })
      )

      showMessage(`已重置 ${docs.length} 篇文档的访问记录`, 3000)
    } catch (error) {
      this.pluginInstance.logger.error("重置访问记录失败", error)
      showMessage(`重置失败: ${error.message}`, 5000, "error")
    }
  }

  /**
   * 获取当前所有指标
   */
  getMetrics(): Metric[] {
    return this.incrementalConfig.metrics
  }

  /**
   * 添加指标
   */
  async addMetric(metric: Metric): Promise<void> {
    this.incrementalConfig.addMetric(metric)
    await this.saveIncrementalConfig()
  }

  /**
   * 删除指标
   */
  async removeMetric(metricId: string): Promise<void> {
    this.incrementalConfig.removeMetric(metricId)
    await this.saveIncrementalConfig()
  }

  /**
   * 更新指标
   */
  async updateMetric(metricId: string, updates: Partial<Metric>): Promise<void> {
    this.incrementalConfig.updateMetric(metricId, updates)
    await this.saveIncrementalConfig()
  }

  /**
   * 轮盘赌选择算法
   */
  private rouletteWheelSelection(items: { docId: string, priority: number }[]): string {
    // 计算总优先级
    const totalPriority = items.reduce((sum, item) => sum + item.priority, 0)
    
    // 如果总优先级为0，随机选择
    if (totalPriority === 0) {
      const randomIndex = Math.floor(Math.random() * items.length)
      return items[randomIndex].docId
    }
    
    // 生成0到总优先级之间的随机数
    const random = Math.random() * totalPriority
    
    // 轮盘赌选择
    let accumulatedPriority = 0
    for (const item of items) {
      accumulatedPriority += item.priority
      if (random <= accumulatedPriority) {
        return item.docId
      }
    }
    
    // 如果出现计算误差，返回最后一个
    return items[items.length - 1].docId
  }

  /**
   * 构建过滤条件
   */
  public buildFilterCondition(): string {
    // 处理旧配置的兼容性
    const filterMode = this.storeConfig.filterMode || FilterMode.Notebook
    const notebookId = this.storeConfig.notebookId || ""
    const rootId = this.storeConfig.rootId || ""

    if (filterMode === FilterMode.Root && rootId && rootId.length > 0) {
      return `AND path like '%${rootId}%'`
    }
    if (filterMode === FilterMode.Notebook && notebookId && notebookId.length > 0) {
      return `AND box = '${notebookId}'`
    }
    return ""
  }

  /**
   * 计算文档的优先级
   */
  private calculatePriority(docData: DocPriorityData): number {
    const priority = this.incrementalConfig.calculatePriority(docData)
    return priority
  }
}

export { IncrementalReviewer }
export default IncrementalReviewer 