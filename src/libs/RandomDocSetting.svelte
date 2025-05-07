<script lang="ts">
  import RandomDocPlugin from "../index"
  import { onMount } from "svelte"
  import RandomDocConfig, { ReviewMode } from "../models/RandomDocConfig"
  import { storeName } from "../Constants"
  import { showMessage } from "siyuan"
  import IncrementalReviewer from "../service/IncrementalReviewer"
  import type { Metric } from "../models/IncrementalConfig"

  // props
  export let pluginInstance: RandomDocPlugin
  export let dialog

  let storeConfig: RandomDocConfig
  let showLoading = false
  let customSqlEnabled = false
  let sqlContent = JSON.stringify([])
  let reviewMode = ReviewMode.Incremental
  let excludeTodayVisited = true
  
  // 渐进模式配置相关
  let reviewer: IncrementalReviewer
  let metrics: Metric[] = []
  let newMetric: Partial<Metric> = { id: "", name: "", weight: 10, value: 5, description: "" }

  // 进度状态
  let isProcessing = false
  let processProgress = 0
  let processTotal = 0
  let processCurrent = 0

  const onSaveSetting = async () => {
    try {
      storeConfig.showLoading = showLoading
      storeConfig.customSqlEnabled = customSqlEnabled
      storeConfig.sql = sqlContent
      storeConfig.reviewMode = reviewMode
      storeConfig.excludeTodayVisited = excludeTodayVisited
      await pluginInstance.saveData(storeName, storeConfig)
      
      // 如果是渐进模式，保存渐进配置
      if (reviewMode === ReviewMode.Incremental && reviewer) {
        await reviewer.saveIncrementalConfig()
        
        // 开始处理文档，显示进度条
        isProcessing = true
        processProgress = 0
        processCurrent = 0
        processTotal = 0
        
        // 查找所有指标值为0的文档，将它们改为默认值5
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
              .filter(m => m.count > 0)
              .map(m => `"${m.name}"(${m.count}篇)`)
              .join("、")
            stats.push(`修复了${repairResult.updatedMetrics.reduce((sum, m) => sum + m.count, 0)}个指标值(${updatedMetricsSummary})`)
        }
        
          // 添加删除的指标信息
          if (repairResult.deletedMetricsCount > 0) {
            stats.push(`删除了${repairResult.deletedMetricsCount}个无效指标`)
          }
          
          // 显示总结信息
          const statsSummary = stats.join("，")
          pluginInstance.logger.info(`已处理${repairResult.totalDocs}篇文档，${repairResult.updatedDocs}篇被更新。${statsSummary}`)
          showMessage(`已处理${repairResult.totalDocs}篇文档，${repairResult.updatedDocs}篇被更新。${statsSummary}`, 7000)
      } else {
          showMessage(`已处理${repairResult.totalDocs}篇文档，所有文档指标都已正确设置`, 3000)
        }
      }

      if (!isProcessing) {
        showMessage(`${pluginInstance.i18n.settingConfigSaveSuccess}`, 2000, "info")
        dialog.destroy()
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

  const onCancel = async () => {
    dialog.destroy()
  }
  
  // 复习模式变更时的处理
  async function onReviewModeChange() {
    if (reviewMode === ReviewMode.Incremental && !reviewer) {
      // 初始化渐进模式配置
      await initIncrementalConfig()
    }
  }
  
  // 初始化渐进模式配置
  async function initIncrementalConfig() {
    reviewer = new IncrementalReviewer(storeConfig, pluginInstance)
    await reviewer.initIncrementalConfig()
    metrics = reviewer.getMetrics()
  }

  onMount(async () => {
    storeConfig = await pluginInstance.loadData(storeName)
    showLoading = storeConfig?.showLoading ?? false
    customSqlEnabled = storeConfig?.customSqlEnabled ?? false
    reviewMode = storeConfig?.reviewMode ?? ReviewMode.Incremental
    excludeTodayVisited = storeConfig?.excludeTodayVisited !== false
    sqlContent =
      storeConfig?.sql ??
      JSON.stringify([
        {
          name: "默认",
          sql: "SELECT DISTINCT b.root_id FROM blocks b WHERE TRIM(b.content)<>'' ORDER BY random() LIMIT 1",
        },
        {
          name: "今天",
          sql: "SELECT DISTINCT b.root_id FROM blocks b WHERE TRIM(b.content)<>'' AND strftime('%Y-%m-%d', substr(b.created, 1, 4) || '-' || substr(b.created, 5, 2) || '-' || substr(b.created, 7, 2)) = date('now', 'start of day') ORDER BY random() LIMIT 1",
        },
        {
          name: "3天内",
          sql: "SELECT DISTINCT b.root_id FROM blocks b WHERE TRIM(b.content)<>'' AND strftime('%Y-%m-%d', substr(b.created, 1, 4) || '-' || substr(b.created, 5, 2) || '-' || substr(b.created, 7, 2)) >= date('now', '-3 days') ORDER BY random() LIMIT 1",
        },
        {
          name: "7天内",
          sql: "SELECT DISTINCT b.root_id FROM blocks b WHERE TRIM(b.content)<>'' AND strftime('%Y-%m-%d', substr(b.created, 1, 4) || '-' || substr(b.created, 5, 2) || '-' || substr(b.created, 7, 2)) >= date('now', '-7 days') ORDER BY random() LIMIT 1",
        },
        {
          name: "一个月内",
          sql: "SELECT DISTINCT b.root_id FROM blocks b WHERE TRIM(b.content)<>'' AND strftime('%Y-%m-%d', substr(b.created, 1, 4) || '-' || substr(b.created, 5, 2) || '-' || substr(b.created, 7, 2)) >= date('now', '-1 month') ORDER BY random() LIMIT 1",
        },
        {
          name: "半年内",
          sql: "SELECT DISTINCT b.root_id FROM blocks b WHERE TRIM(b.content)<>'' AND strftime('%Y-%m-%d', substr(b.created, 1, 4) || '-' || substr(b.created, 5, 2) || '-' || substr(b.created, 7, 2)) >= date('now', '-6 months') ORDER BY random() LIMIT 1",
        },
        {
          name: "一年内",
          sql: "SELECT DISTINCT b.root_id FROM blocks b WHERE TRIM(b.content)<>'' AND strftime('%Y-%m-%d', substr(b.created, 1, 4) || '-' || substr(b.created, 5, 2) || '-' || substr(b.created, 7, 2)) >= date('now', '-1 year') ORDER BY random() LIMIT 1",
        },
      ])
      
    // 如果当前是渐进模式，初始化渐进配置
    if (reviewMode === ReviewMode.Incremental) {
      await initIncrementalConfig()
    }
  })
</script>

<div class="random-doc-setting">
  <div class="config__tab-container">
    <div class="fn__block form-item">
      <div class="form-item-row">
        <span class="form-item-label">复习模式</span>
        <select bind:value={reviewMode} class="b3-select" on:change={onReviewModeChange}>
          <option value={ReviewMode.Incremental}>渐进模式</option>
          <option value={ReviewMode.Once}>一遍过模式</option>
        </select>
      </div>
    </div>

    <div class="fn__block form-item">
      <div class="form-item-row">
        <span class="form-item-label">漫游文档时是否显示加载图标</span>
        <input class="b3-switch" type="checkbox" bind:checked={showLoading} />
      </div>
    </div>
    
    {#if reviewMode === ReviewMode.Incremental}
      <div class="fn__block form-item">
        <div class="form-item-row">
          <div>
            <span class="form-item-label">排除今日已漫游的文档</span>
            <div class="b3-label__text form-item-tip">勾选后，今日已访问过的文档将不会再次出现</div>
          </div>
          <input class="b3-switch" type="checkbox" bind:checked={excludeTodayVisited} />
        </div>
      </div>
      
      <div class="fn__block form-item incremental-config-section">
        <h3>渐进模式指标配置</h3>
        <div class="b3-label__text form-item-tip">自定义文档优先级的评估指标，系统将基于这些指标为文档分配选中概率</div>
        <span class="fn__hr" />
        
        {#if metrics && metrics.length > 0}
          <div class="config-section">
            <h4>已有指标</h4>
            <p class="help-text">权重总和将自动调整为100%</p>
            
            <div class="table-container">
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
          </div>
          
          <div class="config-section compact-section">
            <h4>添加新指标</h4>
            
            <div class="form-row">
              <div class="form-group small-group">
                <label for="newMetricId">ID</label>
                <input 
                  type="text" 
                  id="newMetricId" 
                  bind:value={newMetric.id} 
                  placeholder="ID"
                />
              </div>
              
              <div class="form-group small-group">
                <label for="newMetricName">名称</label>
                <input 
                  type="text" 
                  id="newMetricName" 
                  bind:value={newMetric.name} 
                  placeholder="名称"
                />
              </div>
              
              <div class="form-group tiny-group">
                <label for="newMetricWeight">权重</label>
                <input 
                  type="number" 
                  id="newMetricWeight" 
                  bind:value={newMetric.weight} 
                  min="1" 
                  max="100"
                />
              </div>
              
              <div class="form-group">
                <label for="newMetricDescription">描述 (可选)</label>
                <input 
                  type="text" 
                  id="newMetricDescription" 
                  bind:value={newMetric.description} 
                  placeholder="简短描述"
                />
              </div>
              
              <div class="form-group button-group">
                <button class="add-button" on:click={addMetric}>添加</button>
              </div>
            </div>
          </div>
        {/if}
      </div>
      
      <!-- 进度条显示 -->
      {#if isProcessing}
        <div class="fn__block form-item progress-section">
          <h3>正在修复文档指标</h3>
          <div class="progress-info">
            正在处理 {processCurrent} / {processTotal} 篇文档 ({processProgress}%)
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: {processProgress}%"></div>
          </div>
          <p class="b3-label__text">正在扫描并修复文档指标，分页处理中，请耐心等待...</p>
          <p class="b3-label__text">大量文档处理可能需要较长时间，请勿关闭窗口</p>
        </div>
      {/if}
    {/if}

    <div class="fn__block form-item">
      <div class="form-item-row">
        <div>
          <span class="form-item-label">是否启用自定义SQL</span>
          <div class="b3-label__text form-item-tip">{pluginInstance.i18n.customSqlEnabledTip}</div>
        </div>
        <input class="b3-switch" type="checkbox" bind:checked={customSqlEnabled} />
      </div>
    </div>

    {#if customSqlEnabled}
      <div class="fn__block form-item">
        <span class="form-item-label">{pluginInstance.i18n.sqlContent}</span>
        <div class="b3-label__text form-item-tip">{pluginInstance.i18n.sqlContentTip}</div>
        <span class="fn__hr" />
        <textarea
          class="b3-text-field fn__block sql-editor"
          id="regCode"
          bind:value={sqlContent}
          rows="4"
          placeholder={pluginInstance.i18n.sqlContentTip}
        />
      </div>
    {/if}

    <div class="b3-dialog__action">
      <button class="b3-button b3-button--cancel" on:click={onCancel}>{pluginInstance.i18n.cancel}</button>
      <div class="fn__space" />
      <button class="b3-button b3-button--text" on:click={onSaveSetting}>{pluginInstance.i18n.save}</button>
    </div>
  </div>
</div>

<style>
  .form-item {
    padding: 8px;
    width: 92%;
    margin: auto;
    font-size: 14px;
  }

  .form-item-tip {
    font-size: 12px !important;
    color: var(--b3-theme-on-background);
  }
  
  .form-item-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .form-item-label {
    flex: 1;
    padding-right: 10px;
  }
  
  .incremental-config-section {
    margin-top: 8px;
  }
  
  h3 {
    font-size: 15px;
    font-weight: 500;
    margin-bottom: 6px;
    color: var(--b3-theme-on-background);
  }
  
  h4 {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 6px;
    color: var(--b3-theme-on-background);
  }
  
  .help-text {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
    margin-bottom: 10px;
  }
  
  .config-section {
    margin-bottom: 16px;
    padding: 10px;
    border-radius: 4px;
    background-color: var(--b3-theme-surface);
  }
  
  .table-container {
    max-height: 120px;
    overflow-y: auto;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
  }
  
  .metrics-table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .metrics-table th, .metrics-table td {
    padding: 6px 10px;
    text-align: left;
    border-bottom: 1px solid var(--b3-border-color);
  }
  
  .metrics-table th {
    font-weight: 500;
    color: var(--b3-theme-on-background);
    background-color: var(--b3-theme-background);
    position: sticky;
    top: 0;
    z-index: 1;
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
  
  .form-group label {
    margin-bottom: 3px;
    font-size: 12px;
    color: var(--b3-theme-on-surface);
  }
  
  .delete-button {
    padding: 3px 6px;
    background-color: var(--b3-theme-error-lighter);
    color: var(--b3-theme-error);
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
  }
  
  .delete-button:hover {
    background-color: var(--b3-theme-error-light);
  }
  
  .add-button {
    padding: 5px 10px;
    background-color: var(--b3-theme-primary-lighter);
    color: var(--b3-theme-primary);
    border: none;
    border-radius: 3px;
    cursor: pointer;
    margin-top: 18px;
    font-size: 13px;
  }
  
  .add-button:hover {
    background-color: var(--b3-theme-primary-light);
  }
  
  .compact-section {
    padding: 8px;
    margin-bottom: 12px;
  }
  
  .small-group {
    max-width: 80px;
  }
  
  .tiny-group {
    max-width: 60px;
  }
  
  .button-group {
    max-width: 50px;
    display: flex;
    align-items: flex-end;
  }
  
  .sql-editor {
    height: 300px;
    resize: vertical;
    overflow: auto;
    font-family: monospace;
  }
  
  /* 进度条样式 */
  .progress-section {
    margin: 16px 0;
    background-color: var(--b3-theme-surface);
    border-radius: 4px;
    border: 1px solid var(--b3-theme-primary-lightest);
  }
  
  .progress-section h3 {
    margin-top: 0;
    color: var(--b3-theme-primary);
    font-size: 14px;
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
