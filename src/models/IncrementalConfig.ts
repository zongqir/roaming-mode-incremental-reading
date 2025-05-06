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

/**
 * 自定义指标
 */
export interface Metric {
  id: string; // 指标唯一ID
  name: string; // 指标名称
  value: number; // 值（0-10）
  weight: number; // 权重（0-100%）
  description?: string; // 指标描述
}

/**
 * 文档优先级数据
 */
export interface DocPriorityData {
  docId: string; // 文档ID
  metrics: { [key: string]: number }; // 指标ID到值的映射
  visitCount?: number; // 访问次数
}

/**
 * 渐进模式配置
 */
export class IncrementalConfig {
  /**
   * 可用的指标列表
   */
  public metrics: Metric[] = [];

  /**
   * 默认指标
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
   * 计算文档优先级
   * @param docData 文档优先级数据
   * @returns 优先级分数（0-10）
   */
  public calculatePriority(docData: DocPriorityData): number {
    let priority = 0;
    let totalWeight = 0;
    
    // 遍历所有指标
    for (const metric of this.metrics) {
      // 如果文档有该指标的值
      if (docData.metrics[metric.id] !== undefined) {
        priority += docData.metrics[metric.id] * metric.weight;
        totalWeight += metric.weight;
      }
    }
    
    // 归一化结果（0-10）
    return totalWeight > 0 ? priority / totalWeight : 0;
  }

  /**
   * 初始化配置
   */
  constructor() {
    // 初始化默认指标
    this.metrics = IncrementalConfig.getDefaultMetrics();
  }

  /**
   * 添加新指标
   */
  public addMetric(metric: Metric): void {
    this.metrics.push(metric);
    this.normalizeWeights();
  }

  /**
   * 删除指标
   */
  public removeMetric(metricId: string): void {
    this.metrics = this.metrics.filter(m => m.id !== metricId);
    this.normalizeWeights();
  }

  /**
   * 更新指标
   */
  public updateMetric(metricId: string, updates: Partial<Metric>): void {
    const index = this.metrics.findIndex(m => m.id === metricId);
    if (index >= 0) {
      this.metrics[index] = { ...this.metrics[index], ...updates };
      // 如果更新了权重，需要重新归一化
      if (updates.weight !== undefined) {
        this.normalizeWeights();
      }
    }
  }

  /**
   * 归一化所有指标的权重，使总和为100
   */
  private normalizeWeights(): void {
    const totalWeight = this.metrics.reduce((sum, metric) => sum + metric.weight, 0);
    
    if (totalWeight > 0 && totalWeight !== 100) {
      // 调整所有权重使总和为100
      this.metrics.forEach(metric => {
        metric.weight = (metric.weight / totalWeight) * 100;
      });
    }
  }
}

export default IncrementalConfig; 