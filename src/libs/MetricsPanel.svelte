<!--
  - Copyright (c) 2023, Terwer . All rights reserved.
  - DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
  -
  - This code is free software; you can redistribute it and/or modify it
  - under the terms of the GNU General Public License version 2 only, as
  - published by the Free Software Foundation.  Terwer designates this
  - particular file as subject to the "Classpath" exception as provided
  - by Terwer in the LICENSE file that accompanied this code.
  -
  - This code is distributed in the hope that it will be useful, but WITHOUT
  - ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
  - FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
  - version 2 for more details (a copy is included in the LICENSE file that
  - accompanied this code).
  -
  - You should have received a copy of the GNU General Public License version
  - 2 along with this work; if not, write to the Free Software Foundation,
  - Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
  -
  - Please contact Terwer, Shenzhen, Guangdong, China, youweics@163.com
  - or visit www.terwer.space if you need additional information or have any
  - questions.
  -->

<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte"
  import RandomDocPlugin from "../index"
  import ProgressiveReviewer from "../service/ProgressiveReviewer"
  import { Metric } from "../models/ProgressiveConfig"

  // props
  export let pluginInstance: RandomDocPlugin
  export let docId: string = ""
  export let reviewer: ProgressiveReviewer
  export let metrics: Metric[] = []
  export let totalPriority: number = 0

  // state
  let docMetrics: Map<string, number> = new Map()
  let priorityColor: string = "#666"

  // events
  const dispatch = createEventDispatcher()

  // 初始化
  onMount(async () => {
    await loadDocMetrics()
  })

  // 当文档ID变化时重新加载
  $: if (docId) {
    loadDocMetrics()
  }

  // 加载文档指标数据
  async function loadDocMetrics() {
    if (!docId || !reviewer) return
    
    const docPriorityData = await reviewer.getDocPriorityData(docId)
    
    // 更新指标值
    docMetrics = new Map()
    metrics.forEach(metric => {
      const value = docPriorityData.metrics[metric.id] !== undefined 
        ? docPriorityData.metrics[metric.id] 
        : 5.0
      docMetrics.set(metric.id, value)
    })
    
    // 计算优先级并设置颜色
    calculatePriority()
  }

  // 计算总体优先级
  function calculatePriority() {
    let weightedSum = 0
    let totalWeight = 0
    
    metrics.forEach(metric => {
      const value = docMetrics.get(metric.id) || 0
      weightedSum += value * metric.weight
      totalWeight += metric.weight
    })
    
    totalPriority = totalWeight > 0 ? weightedSum / totalWeight : 0
    
    // 设置优先级颜色 (从绿色到红色的渐变)
    const hue = (120 - totalPriority * 12) // 120为绿色, 0为红色
    priorityColor = `hsl(${hue}, 80%, 45%)`
    
    // 通知父组件优先级已更新
    dispatch("priorityChange", { priority: totalPriority })
  }

  // 直接更新指标值 (供输入框使用)
  async function updateMetricValue(metricId: string, newValueStr: string) {
    let newValue = parseFloat(newValueStr)
    
    // 验证输入是否为有效数字
    if (isNaN(newValue)) {
      // 如果输入无效，恢复原来的值
      newValue = docMetrics.get(metricId) || 0
      return
    }
    
    // 限制在0-10范围内
    newValue = Math.max(0, Math.min(10, newValue))
    
    // 更新本地状态
    docMetrics.set(metricId, newValue)
    docMetrics = docMetrics // 触发Svelte更新界面
    
    // 重新计算优先级
    calculatePriority()
    
    // 保存到文档
    await reviewer.updateDocMetric(docId, metricId, newValue)
  }

  // 增加指标值
  async function increaseMetric(metricId: string) {
    const currentValue = docMetrics.get(metricId) || 0
    const newValue = Math.min(10, currentValue + 0.1)
    
    // 更新本地状态
    docMetrics.set(metricId, newValue)
    docMetrics = docMetrics // 触发Svelte更新界面
    
    // 重新计算优先级
    calculatePriority()
    
    // 保存到文档
    await reviewer.updateDocMetric(docId, metricId, newValue)
  }

  // 减少指标值
  async function decreaseMetric(metricId: string) {
    const currentValue = docMetrics.get(metricId) || 0
    const newValue = Math.max(0, currentValue - 0.1)
    
    // 更新本地状态
    docMetrics.set(metricId, newValue)
    docMetrics = docMetrics // 触发Svelte更新界面
    
    // 重新计算优先级
    calculatePriority()
    
    // 保存到文档
    await reviewer.updateDocMetric(docId, metricId, newValue)
  }
</script>

<div class="metrics-panel">
  <div class="metrics-title">
    <h3>文档指标</h3>
    <div class="priority-display" style="color: {priorityColor}">
      优先级：{totalPriority.toFixed(1)}
    </div>
  </div>
  
  <div class="metrics-list">
    {#each metrics as metric}
      <div class="metric-item">
        <div class="metric-name" title={metric.description || ""}>
          {metric.name}<span class="metric-weight">({metric.weight.toFixed(0)}%)</span>
        </div>
        <div class="metric-controls">
          <button on:click={() => decreaseMetric(metric.id)}>-</button>
          <input 
            type="text" 
            class="metric-value" 
            value={docMetrics.get(metric.id)?.toFixed(1) || "0.0"}
            on:blur={(e) => updateMetricValue(metric.id, e.currentTarget.value)} 
            on:keydown={(e) => e.key === 'Enter' && updateMetricValue(metric.id, e.currentTarget.value)}
            style="background: linear-gradient(to right, var(--b3-theme-primary-light) {docMetrics.get(metric.id) * 10}%, transparent 0%);"
          />
          <button on:click={() => increaseMetric(metric.id)}>+</button>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .metrics-panel {
    margin-top: 8px;
    padding: 6px 8px;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    background-color: var(--b3-theme-background);
    font-size: 13px;
    box-shadow: var(--b3-dialog-shadow);
  }
  
  .metrics-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
    border-bottom: 1px solid var(--b3-border-color);
    padding-bottom: 4px;
  }
  
  .metrics-title h3 {
    margin: 0;
    font-size: 14px;
    color: var(--b3-theme-on-surface);
  }
  
  .priority-display {
    font-weight: bold;
    font-size: 14px;
  }
  
  .metrics-list {
    margin-bottom: 8px;
  }
  
  .metric-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
    padding: 2px 0;
  }
  
  .metric-name {
    flex: 1;
    font-weight: 500;
    font-size: 13px;
    color: var(--b3-theme-on-surface);
  }
  
  .metric-weight {
    color: var(--b3-theme-on-surface-light);
    font-size: 0.85em;
    font-weight: normal;
    margin-left: 4px;
  }
  
  .metric-controls {
    display: flex;
    align-items: center;
  }
  
  .metric-controls button {
    width: 24px;
    height: 24px;
    border-radius: 3px;
    border: 1px solid var(--b3-border-color);
    background-color: var(--b3-theme-background);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0;
    color: var(--b3-theme-on-surface);
  }
  
  .metric-controls button:hover {
    background-color: var(--b3-list-hover);
  }
  
  .metric-value {
    width: 40px;
    text-align: center;
    margin: 0 4px;
    padding: 2px 4px;
    border-radius: 3px;
    border: 1px solid var(--b3-border-color);
    font-weight: bold;
    font-size: 13px;
    background-color: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
  }
</style> 