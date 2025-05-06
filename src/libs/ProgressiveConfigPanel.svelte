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
  import { onMount } from "svelte"
  import RandomDocPlugin from "../index"
  import ProgressiveReviewer from "../service/ProgressiveReviewer"
  import RandomDocConfig, { ReviewMode } from "../models/RandomDocConfig"
  import { Metric } from "../models/ProgressiveConfig"
  import { showMessage, Dialog } from "siyuan"

  // props
  export let pluginInstance: RandomDocPlugin
  export let storeConfig: RandomDocConfig
  export let dialog: Dialog

  // state
  let reviewer: ProgressiveReviewer
  let metrics: Metric[] = []
  let newMetric: Partial<Metric> = { id: "", name: "", weight: 10, value: 5, description: "" }

  // 初始化
  onMount(async () => {
    reviewer = new ProgressiveReviewer(storeConfig, pluginInstance)
    await reviewer.initProgressiveConfig()
    metrics = reviewer.getMetrics()
  })

  // 保存配置
  async function saveConfig() {
    try {
      if (reviewer) {
        await reviewer.saveProgressiveConfig()
        
        // 查找所有指标值为0的文档，将它们改为默认值5
        await updateZeroMetricsToDefault()
      }
      
      showMessage("配置已保存", 2000)
    } catch (error) {
      showMessage("保存配置失败: " + error.message, 5000, "error")
    }
  }
  
  // 将所有文档中指标值为0的指标统一改为默认值5
  async function updateZeroMetricsToDefault() {
    try {
      const filterCondition = reviewer.buildFilterCondition ? reviewer.buildFilterCondition() : ""
      
      for (const metric of metrics) {
        // 构建查询，查找具有该指标且值为0的文档
        const sql = `
          SELECT id FROM blocks 
          WHERE type = 'd' 
          ${filterCondition}
          AND id IN (
            SELECT block_id FROM attributes 
            WHERE name = 'custom-metric-${metric.id}'
            AND value = '0.0'
          )
        `
        
        const result = await pluginInstance.kernelApi.sql(sql)
        if (result.code !== 0) {
          throw new Error(result.msg)
        }
        
        const docs = result.data as any[]
        if (!docs || docs.length === 0) continue
        
        // 更新这些文档的指标值为5.0
        await Promise.all(
          docs.map(async (doc) => {
            await pluginInstance.kernelApi.setBlockAttrs(doc.id, {
              [`custom-metric-${metric.id}`]: "5.0"
            })
          })
        )
        
        showMessage(`已将${docs.length}篇文档的"${metric.name}"指标从0更新为默认值5`, 3000)
      }
    } catch (error) {
      pluginInstance.logger.error("更新指标默认值失败", error)
      showMessage("更新指标默认值失败: " + error.message, 5000, "error")
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

<div class="progressive-config">
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
      <div class="form-group description-field">
        <label for="newMetricDescription">描述</label>
        <input 
          type="text" 
          id="newMetricDescription" 
          bind:value={newMetric.description} 
          placeholder="指标的描述信息（可选）"
        />
      </div>
      
      <div class="form-group">
        <button class="add-button" on:click={addMetric}>添加指标</button>
      </div>
    </div>
  </div>
  
  <div class="button-row">
    <button class="save-button" on:click={saveConfig}>保存配置</button>
    <button class="cancel-button" on:click={closeDialog}>关闭</button>
  </div>
</div>

<style>
  .progressive-config {
    padding: 15px;
    max-height: 80vh;
    overflow-y: auto;
  }
  
  h2 {
    margin-top: 0;
    margin-bottom: 20px;
    font-size: 20px;
    border-bottom: 1px solid #eee;
    padding-bottom: 10px;
  }
  
  .config-section {
    margin-bottom: 25px;
  }
  
  h3 {
    margin-top: 0;
    margin-bottom: 10px;
    font-size: 16px;
  }
  
  .help-text {
    font-size: 0.9em;
    color: #666;
    margin-top: 0;
    margin-bottom: 15px;
  }
  
  .metrics-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 15px;
  }
  
  .metrics-table th,
  .metrics-table td {
    padding: 8px;
    text-align: left;
    border-bottom: 1px solid #eee;
  }
  
  .metrics-table th {
    background-color: #f5f5f5;
  }
  
  .metrics-table input {
    width: 60px;
    padding: 4px;
    text-align: center;
  }
  
  .form-row {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
  }
  
  .form-group {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  
  .description-field {
    flex: 2;
  }
  
  .form-group label {
    margin-bottom: 5px;
    font-size: 0.9em;
  }
  
  .form-group input {
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .button-row {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
  }
  
  button {
    padding: 8px 16px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
  }
  
  .save-button {
    background-color: #4caf50;
    color: white;
  }
  
  .save-button:hover {
    background-color: #45a049;
  }
  
  .cancel-button {
    background-color: #f0f0f0;
    color: #333;
  }
  
  .cancel-button:hover {
    background-color: #e0e0e0;
  }
  
  .add-button {
    background-color: #2196f3;
    color: white;
    margin-top: auto;
  }
  
  .add-button:hover {
    background-color: #0b7dda;
  }
  
  .delete-button {
    background-color: #f44336;
    color: white;
    padding: 4px 8px;
    font-size: 0.9em;
  }
  
  .delete-button:hover {
    background-color: #da190b;
  }
</style> 