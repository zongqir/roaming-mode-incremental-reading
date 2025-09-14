<!--
  - Copyright (c) 2025, ebAobS . All rights reserved.
  - DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
  -
  - This code is free software; you can redistribute it and/or modify it
  - under the terms of the GNU General Public License version 2 only, as
  - published by the Free Software Foundation.  ebAobS designates this
  - particular file as subject to the "Classpath" exception as provided
  - by ebAobS in the LICENSE file that accompanied this code.
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
  - Please contact ebAobS, ebAobs@outlook.com
  - or visit https://github.com/ebAobS/roaming-mode-incremental-reading if you need additional information or have any
  - questions.
  -->

<script lang="ts">
  import { onMount } from "svelte"
  import RandomDocPlugin from "../index"
  import IncrementalReviewer from "../service/IncrementalReviewer"
  import RandomDocConfig, { ReviewMode } from "../models/RandomDocConfig"
  import { Metric } from "../models/IncrementalConfig"
  import { showMessage, Dialog } from "siyuan"

  // props
  export let pluginInstance: RandomDocPlugin
  export let storeConfig: RandomDocConfig
  export let dialog: Dialog

  // state
  let reviewer: IncrementalReviewer
  let metrics: Metric[] = []
  let newMetric: Partial<Metric> = { id: "", name: "", weight: 10, value: 5, description: "" }

  // 进度状态
  let isProcessing = false
  let processProgress = 0
  let processTotal = 0
  let processCurrent = 0

  // 初始化
  onMount(async () => {
    reviewer = new IncrementalReviewer(storeConfig, pluginInstance)
    await reviewer.initIncrementalConfig()
    metrics = reviewer.getMetrics()
  })

  // 保存配置
  async function saveConfig() {
    try {
      if (reviewer) {
        // 先保存配置
        await reviewer.saveIncrementalConfig()
        
        // 开始处理文档，显示进度条
        isProcessing = true
        processProgress = 0
        processCurrent = 0
        processTotal = 0
        
        // 修复所有文档的指标，传入进度回调
        const repairResult = await reviewer.repairAllDocumentMetrics((current, total) => {
          processCurrent = current
          processTotal = total
          processProgress = Math.floor((current / total) * 100)
        })
        
        // 重置进度状态
        isProcessing = false
        
        // 格式化统计信息
        const stats = []
        if (repairResult.updatedDocs > 0) {
          // 添加修复的指标信息
          if (repairResult.updatedMetrics.length > 0) {
            const updatedMetricsSummary = repairResult.updatedMetrics
              .map(m => `"${m.name}"(${m.count}篇)`)
              .join("、")
            stats.push(`修复了${repairResult.updatedMetrics.reduce((sum, m) => sum + m.count, 0)}个指标值(${updatedMetricsSummary})`)
          }
          
          // 添加删除的指标信息
          if (repairResult.deletedMetricsCount > 0) {
            stats.push(`删除了${repairResult.deletedMetricsCount}个无效指标`)
          }
          
          // 添加优先级计算信息
          if (repairResult.updatedPriorities > 0) {
            stats.push(`重新计算了${repairResult.updatedPriorities}个文档的优先级`)
          }
      
      // 显示总结信息
          const statsSummary = stats.join("，")
          showMessage(`已处理${repairResult.totalDocs}篇文档，${repairResult.updatedDocs}篇被更新。${statsSummary}`, 7000)
      } else {
          showMessage(`已处理${repairResult.totalDocs}篇文档，所有文档的指标均已完整设置`, 3000)
        }
      }
    } catch (error) {
      // 发生错误时也要重置进度状态
      isProcessing = false
      showMessage("保存配置失败: " + error.message, 5000, "error")
    }
  }

  // 添加新指标
  async function addMetric() {
    // 验证输入
    if (!newMetric.id || !newMetric.name) {
      showMessage("ID和名称不能为空", 3000, "error")
      return
    }
    
    if (metrics.some(m => m.id === newMetric.id)) {
      showMessage("ID已存在", 3000, "error")
      return
    }
    
    // 创建完整的指标对象
    const metric: Metric = {
      id: newMetric.id,
      name: newMetric.name,
      value: newMetric.value || 5,
      weight: newMetric.weight || 10,
      description: newMetric.description || ""
    }
    
    // 添加指标
    await reviewer.addMetric(metric)
    
    // 更新指标列表
    metrics = reviewer.getMetrics()
    
    // 重置表单
    newMetric = { id: "", name: "", weight: 10, value: 5, description: "" }
    
    showMessage("指标已添加", 2000)
  }

  // 删除指标
  async function removeMetric(metricId: string) {
    // 至少保留一个指标
    if (metrics.length <= 1) {
      showMessage("至少需要保留一个指标", 3000, "error")
      return
    }
    
    // 删除指标
    await reviewer.removeMetric(metricId)
    
    // 更新指标列表
    metrics = reviewer.getMetrics()
    
    showMessage("指标已删除", 2000)
  }

  // 更新指标权重
  async function updateMetricWeight(metricId: string, newWeight: number) {
    // 确保权重为正数
    newWeight = Math.max(1, newWeight)
    
    // 更新指标
    await reviewer.updateMetric(metricId, { weight: newWeight })
    
    // 更新指标列表
    metrics = reviewer.getMetrics()
  }

  // 关闭对话框
  function closeDialog() {
    dialog?.destroy()
  }
</script>

<div class="incremental-config">
  <h2>渐进式模式配置</h2>
  
  <div class="config-section">
    <h3>自定义指标</h3>
    <p class="help-text">权重总和将自动调整为100%</p>
    
    <table class="metrics-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>名称</th>
          <th>权重 (%)</th>
          <th>描述</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {#each metrics as metric}
          <tr>
            <td>{metric.id}</td>
            <td>{metric.name}</td>
            <td>
              <input 
                type="number" 
                value={metric.weight.toFixed(0)} 
                min="1" 
                on:change={(e) => updateMetricWeight(metric.id, parseFloat(e.currentTarget.value))}
              />
            </td>
            <td>{metric.description || "-"}</td>
            <td>
              <button class="delete-button" on:click={() => removeMetric(metric.id)}>删除</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  
  <div class="config-section">
    <h3>添加新指标</h3>
    
    <div class="form-row">
      <div class="form-group">
        <label for="newMetricId">ID</label>
        <input 
          type="text" 
          id="newMetricId" 
          bind:value={newMetric.id} 
          placeholder="英文ID，如 importance"
        />
      </div>
      
      <div class="form-group">
        <label for="newMetricName">名称</label>
        <input 
          type="text" 
          id="newMetricName" 
          bind:value={newMetric.name} 
          placeholder="显示名称，如 重要性"
        />
      </div>
      
      <div class="form-group">
        <label for="newMetricWeight">权重 (%)</label>
        <input 
          type="number" 
          id="newMetricWeight" 
          bind:value={newMetric.weight} 
          min="1" 
          max="100"
        />
      </div>
    </div>
    
    <div class="form-row">
      <div class="form-group">
        <label for="newMetricDescription">描述 (可选)</label>
        <input 
          type="text" 
          id="newMetricDescription" 
          bind:value={newMetric.description} 
          placeholder="指标的详细描述"
        />
      </div>
      
      <div class="form-group">
        <button class="add-button" on:click={addMetric}>添加指标</button>
      </div>
    </div>
  </div>
  
  <!-- 自动重置设置 -->
  <div class="config-section">
    <h3>{pluginInstance.i18n.autoResetSettings}</h3>
    
    <div class="form-row">
      <div class="form-group">
        <label>
          <input
            type="checkbox"
            bind:checked={storeConfig.autoResetOnStartup}
          />
          {pluginInstance.i18n.enableAutoReset}
        </label>
      </div>
      </div>
    </div>
    
  <!-- 绝对优先级顺序漫游概率设置 -->
  <div class="config-section">
    <h3>绝对优先级顺序漫游概率</h3>
      <div class="form-row">
        <div class="form-group">
        <label for="absolutePriorityProb">概率（0~1，0为禁用，1为100%）：</label>
          <input
            type="number"
          id="absolutePriorityProb"
          min="0"
          max="1"
          step="0.1"
          bind:value={storeConfig.absolutePriorityProb}
          />
        <p class="help-text">设置为0则禁用，设置为0.2表示20%的概率直接漫游优先级最高的未访问文档。</p>
      </div>
    </div>
  </div>
  
  <!-- 进度条显示 -->
  {#if isProcessing}
    <div class="progress-section">
      <h3>正在修复文档指标</h3>
      <div class="progress-info">
        正在处理 {processCurrent} / {processTotal} 篇文档 ({processProgress}%)
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: {processProgress}%"></div>
      </div>
      <p class="help-text">正在扫描并修复文档指标，分页处理中，请耐心等待...</p>
      <p class="help-text">大量文档处理可能需要较长时间，请勿关闭窗口</p>
    </div>
  {/if}
  
  <div class="button-group">
    <button class="primary-button" on:click={saveConfig}>保存配置</button>
    <button class="cancel-button" on:click={closeDialog}>关闭</button>
  </div>
</div>

<style>
  .incremental-config {
    padding: 16px;
    font-size: 14px;
    color: var(--b3-theme-on-background);
  }
  
  h2 {
    margin-top: 0;
    margin-bottom: 16px;
    font-size: 18px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
    border-bottom: 1px solid var(--b3-border-color);
    padding-bottom: 8px;
  }
  
  h3 {
    font-size: 16px;
    font-weight: 500;
    margin-bottom: 8px;
    color: var(--b3-theme-on-background);
  }
  
  .help-text {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
    margin-bottom: 12px;
  }
  
  .config-section, .reset-section {
    margin-bottom: 20px;
    padding: 12px;
    border-radius: 4px;
    background-color: var(--b3-theme-surface);
  }
  
  .metrics-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
  }
  
  .metrics-table th, .metrics-table td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid var(--b3-border-color);
  }
  
  .metrics-table th {
    font-weight: 500;
    color: var(--b3-theme-on-background);
    background-color: var(--b3-theme-background);
  }
  
  input[type="text"], input[type="number"] {
    padding: 6px 8px;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    width: 100%;
    color: var(--b3-theme-on-background);
    background-color: var(--b3-theme-background);
  }
  
  input[type="number"] {
    width: 80px;
  }
  
  .form-row {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
  }
  
  .form-group {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  
  .form-group label {
    margin-bottom: 4px;
    font-size: 12px;
    color: var(--b3-theme-on-surface);
  }
  
  .delete-button {
    padding: 4px 8px;
    background-color: var(--b3-theme-error-lighter);
    color: var(--b3-theme-error);
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .delete-button:hover {
    background-color: var(--b3-theme-error-light);
  }
  
  .add-button {
    padding: 6px 12px;
    background-color: var(--b3-theme-primary-lighter);
    color: var(--b3-theme-primary);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 20px;
  }
  
  .add-button:hover {
    background-color: var(--b3-theme-primary-light);
  }
  
  .reset-button {
    padding: 6px 12px;
    background-color: var(--b3-theme-error-lighter);
    color: var(--b3-theme-error);
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .reset-button:hover {
    background-color: var(--b3-theme-error-light);
  }
  
  .button-group {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }
  
  .primary-button {
    padding: 8px 16px;
    background-color: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .primary-button:hover {
    background-color: var(--b3-theme-primary-light);
  }
  
  .cancel-button {
    padding: 8px 16px;
    background-color: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    cursor: pointer;
  }
  
  .cancel-button:hover {
    background-color: var(--b3-theme-background);
  }
  
  /* 进度条样式 */
  .progress-section {
    margin: 16px 0;
    padding: 16px;
    background-color: var(--b3-theme-surface);
    border-radius: 4px;
    border: 1px solid var(--b3-theme-primary-lightest);
  }
  
  .progress-section h3 {
    margin-top: 0;
    color: var(--b3-theme-primary);
  }
  
  .progress-info {
    margin-bottom: 8px;
    font-weight: 500;
  }
  
  .progress-bar-container {
    height: 10px;
    background-color: var(--b3-theme-background);
    border-radius: 5px;
    overflow: hidden;
    margin-bottom: 8px;
  }
  
  .progress-bar {
    height: 100%;
    background-color: var(--b3-theme-primary);
    border-radius: 5px;
    transition: width 0.5s ease;
  }
</style> 