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
 * 漫游式渐进阅读插件 - 渐进式阅读配置模型
 * ========================================
 * 
 * 本文件定义了渐进式阅读的核心配置模型，包括指标定义、文档优先级数据结构和优先级计算逻辑。
 * 这些配置用于实现轮盘赌算法中的权重计算和文档选择。
 * 
 * ## 文件结构
 * 1. 接口定义 - 指标和文档优先级的数据结构
 * 2. 配置类 - 管理渐进阅读的指标和计算方法
 */

/**
 * 1. 接口定义
 */

/**
 * 1.1 自定义指标
 * 定义文档评估的标准和权重
 */
export interface Metric {
  /** 1.2.0 指标唯一标识符 */
  id: string;
  /** 1.1.2 指标显示名称 */
  name: string;
  /** 1.1.3 指标默认值（0-10） */
  value: number;
  /** 1.1.4 指标在总评分中的权重（0-100%） */
  weight: number;
  /** 1.1.5 指标描述信息（可选） */
  description?: string;
}

/**
 * 1.2 文档优先级数据
 * 存储特定文档的指标值和访问记录
 */
export interface DocPriorityData {
  /** 1.2.1 文档ID */
  docId: string;
  /** 1.2.2 指标ID到值的映射 */
  metrics: { [key: string]: number };
  /** 1.2.3 访问次数（可选） */
  visitCount?: number;
}

/**
 * 2. 配置类
 * 渐进式阅读配置管理
 */
export class IncrementalConfig {
  /**
   * 2.1 可用的指标列表
   * 存储当前活跃的所有指标
   */
  public metrics: Metric[] = [];

  /**
   * 2.2 获取默认指标
   * 提供初始的预设指标列表
   * 
   * @returns 默认指标列表
   */
  static getDefaultMetrics(): Metric[] {
    return [
      {
        id: "importance",
        name: "重要性",
        value: 5.0,
        weight: 40,
        description: "文档的重要程度"
      },
      {
        id: "urgency",
        name: "紧急度",
        value: 5.0,
        weight: 30,
        description: "需要尽快查看的程度"
      },
      {
        id: "difficulty",
        name: "难度",
        value: 5.0,
        weight: 30,
        description: "理解和记忆的难度"
      }
    ];
  }

  /**
   * 2.3 计算文档优先级
   * 根据指标权重计算文档总优先级
   * 
   * @param docData 文档优先级数据
   * @returns 包含优先级分数的对象
   */
  public calculatePriority(docData: DocPriorityData): { priority: number } {
    let priority = 0;
    let totalWeight = 0;
    
    // 2.3.1 遍历所有指标
    for (const metric of this.metrics) {
      // 2.3.2 获取指标值，假设已经在getDocPriorityData中修复过
      const metricValue = docData.metrics[metric.id] || 5.0;
      
      // 2.3.3 将该指标的值乘以权重加到总优先级上
      priority += metricValue * metric.weight;
      totalWeight += metric.weight;
    }
    
    // 2.3.4 检查总权重
    if (totalWeight <= 0) {
      throw new Error("总权重非正数，无法计算优先级");
    }
    
    // 2.3.5 归一化结果（0-10）
    const normalizedPriority = priority / totalWeight;
    
    // 2.3.6 返回优先级
    return { priority: normalizedPriority };
  }

  /**
   * 2.4 构造函数
   * 初始化配置对象和默认指标
   */
  constructor() {
    // 2.4.1 初始化默认指标
    this.metrics = IncrementalConfig.getDefaultMetrics();
  }

  /**
   * 2.5 添加新指标
   * 
   * @param metric 要添加的指标对象
   */
  public addMetric(metric: Metric): void {
    this.metrics.push(metric);
    this.normalizeWeights();
  }

  /**
   * 2.6 删除指标
   * 
   * @param metricId 要删除的指标ID
   */
  public removeMetric(metricId: string): void {
    this.metrics = this.metrics.filter(m => m.id !== metricId);
    this.normalizeWeights();
  }

  /**
   * 2.7 更新指标
   * 
   * @param metricId 要更新的指标ID
   * @param updates 部分更新内容
   */
  public updateMetric(metricId: string, updates: Partial<Metric>): void {
    const index = this.metrics.findIndex(m => m.id === metricId);
    if (index >= 0) {
      this.metrics[index] = { ...this.metrics[index], ...updates };
      // 2.7.1 如果更新了权重，需要重新归一化
      if (updates.weight !== undefined) {
        this.normalizeWeights();
      }
    }
  }

  /**
   * 2.8 归一化所有指标的权重
   * 调整所有权重使总和为100
   */
  private normalizeWeights(): void {
    const totalWeight = this.metrics.reduce((sum, metric) => sum + metric.weight, 0);
    
    if (totalWeight > 0 && totalWeight !== 100) {
      // 2.8.1 调整所有权重使总和为100
      this.metrics.forEach(metric => {
        metric.weight = (metric.weight / totalWeight) * 100;
      });
    }
  }
}

export default IncrementalConfig; 