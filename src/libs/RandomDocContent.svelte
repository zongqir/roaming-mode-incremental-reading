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
  import { storeName } from "../Constants"
  import RandomDocConfig, { FilterMode, ReviewMode } from "../models/RandomDocConfig"
  import { Dialog, openTab, showMessage } from "siyuan"
  import RandomDocPlugin from "../index"
  import Loading from "./Loading.svelte"
  import IncrementalReviewer from "../service/IncrementalReviewer"
  import MetricsPanel from "./MetricsPanel.svelte"
  import { isContentEmpty } from "../utils/utils"

  // props
  export let pluginInstance: RandomDocPlugin

  // vars
  let isLoading = false
  let storeConfig: RandomDocConfig
  let notebooks = []
  let toNotebookId = ""
  let filterMode = FilterMode.Notebook
  let rootId = ""
  let title = pluginInstance.i18n.welcomeTitle
  let tips = pluginInstance.i18n.welcomeTips
  let currentRndId
  let unReviewedCount = 0
  let content = ""
  let reviewMode = ReviewMode.Incremental

  let sqlList: any[] = []
  let currentSql = ""
  let pr: IncrementalReviewer
  
  // 渐进模式相关
  let docMetrics = []
  let docPriority: { [key: string]: number } = {}
  
  // 漫游历史相关
  let showHistoryDialog = false
  let roamingHistory = []
  let isLoadingHistory = false
  let historyDialog = null

  // methods
  export const doRandomDoc = async () => {
    if (isLoading) {
      pluginInstance.logger.warn("上次随机还未结束，忽略")
      return
    }

    try {
      isLoading = true
      pluginInstance.logger.info("开始漫游...")
      
      // 根据模式选择不同的漫游方法
      if (storeConfig.reviewMode === ReviewMode.Incremental) {
        await doIncrementalRandomDoc()
        return
      }
      
      // 一遍过模式处理
      let currentRndRes
      // 自定义SQL模式
      if (storeConfig?.customSqlEnabled) {
        currentRndRes = await handleCustomSqlMode()
        currentRndId = currentRndRes
        if (!currentRndId) {
          clearDoc()
          throw new Error(new Date().toISOString() + "：" + pluginInstance.i18n.docFetchError)
        }
        
        pluginInstance.logger.info(`已漫游到 ${currentRndId} ...`)
        
        try {
          // 获取文档块信息
          const rootBlock = await pluginInstance.kernelApi.getBlockByID(currentRndId)
          if (!rootBlock) {
            throw new Error("获取文档块失败")
          }
          
        // 获取文档内容
          const docResult = await pluginInstance.kernelApi.getDoc(currentRndId)
          if (!docResult || docResult.code !== 0) {
            throw new Error("获取文档内容失败")
          }
          
          const doc = docResult.data as any
        title = rootBlock.content
        content = doc.content ?? ""
          
        // 只读
        content = content.replace(/contenteditable="true"/g, 'contenteditable="false"')
          
        // 获取总文档数
        const total = await pluginInstance.kernelApi.getRootBlocksCount()
        
        // 获取已访问文档数量（通过SQL方式）
        let remainingCount = total
        try {
          // 确保pr已初始化
          if (!pr) {
            pr = new IncrementalReviewer(storeConfig, pluginInstance)
            await pr.initIncrementalConfig()
          }
          const visitedCount = await pr.getTodayVisitedCount()
          remainingCount = total - visitedCount
        } catch (error) {
          pluginInstance.logger.warn("获取已访问文档数量失败，使用总数作为剩余数", error)
          // 失败时保持剩余数等于总数
        }
        
        tips = `${total}篇文档已剩${remainingCount}。展卷乃无言的情意，它踏碎星辰来看你，三秋霜雪作马蹄。`
        } catch (error) {
          clearDoc()
          tips = "获取文档内容失败：" + error.message
          throw error
        }
      } else {
        // 常规模式
        currentRndRes = await getOnceModeDoc()
        currentRndId = currentRndRes?.id
        unReviewedCount = currentRndRes?.count ?? "0"
        if (!currentRndId) {
          clearDoc()
          throw new Error(new Date().toISOString() + "：" + pluginInstance.i18n.docFetchError)
        }
        
        pluginInstance.logger.info(`已漫游到 ${currentRndId} ...`)
        
        try {
          // 获取文档块信息
          const rootBlock = await pluginInstance.kernelApi.getBlockByID(currentRndId)
          if (!rootBlock) {
            throw new Error("获取文档块失败")
          }
          
        // 获取文档内容
          const docResult = await pluginInstance.kernelApi.getDoc(currentRndId)
          if (!docResult || docResult.code !== 0) {
            throw new Error("获取文档内容失败")
          }
          
          const doc = docResult.data as any
        title = rootBlock.content
        content = doc.content ?? ""
          
        // 处理空文档
        if (isContentEmpty(content)) {
          clearDoc()
          tips = "白纸素笺无墨迹，且待片刻换新篇。正文为空，2秒后继续下一个。"
          setTimeout(async () => {
            await doRandomDoc()
          }, 2000)
          return
        }
          
        // 只读
        content = content.replace(/contenteditable="true"/g, 'contenteditable="false"')
        
        // 获取总文档数
        const total = await getTotalDocCount()
        // 使用unReviewedCount表示剩余文档数
        tips = `${total}篇文档已剩${unReviewedCount}。展卷乃无言的情意，它踏碎星辰来看你，三秋霜雪作马蹄。`
        } catch (error) {
          clearDoc()
          tips = "获取文档内容失败：" + error.message
          throw error
        }
      }
    } catch (e) {
      clearDoc()
      tips = "漫游式渐进阅读失败！=>" + e.toString()
    } finally {
      isLoading = false
    }
  }
  
  /**
   * 渐进模式下的文档漫游
   */
  const doIncrementalRandomDoc = async () => {
    isLoading = true
    title = "漫游中..."
    content = ""
    tips = "加载中..."
    
    // 清空当前文档ID和指标数据，避免显示上一篇文章的数据
    currentRndId = undefined
    docPriority = {}
    docMetrics = []

    try {
      // 检查渐进复习器是否已初始化
      if (!pr) {
        pr = new IncrementalReviewer(storeConfig, pluginInstance)
        await pr.initIncrementalConfig()
      }
      
      // 获取文档总数
      const total = await pr.getTotalDocCount(storeConfig)
      if (total === 0) {
        content = "没有找到符合条件的文档"
        tips = "知识的海洋等待你去填充，请先创建并填充一些文档。"
        isLoading = false
        return
      }

      // 获取随机文档
      try {
        const newDocId = await pr.getRandomDoc()
        
        if (!newDocId) {
          content = "没有找到符合条件的文档，这可能是因为随机算法的误差或优先级配置问题。"
          tips = "调整过滤条件或优先级配置，然后再次尝试。"
          isLoading = false
          return
        }
        
        // 设置当前文档ID
        currentRndId = newDocId
      } catch (error) {
        pluginInstance.logger.error("获取随机文档失败:", error)
        content = `获取随机文档失败: ${error.message}`
        tips = "发生错误，请检查过滤条件和优先级配置。"
        isLoading = false
        return
      }
      
      pluginInstance.logger.info(`已漫游到文档: ${currentRndId}`)
      
      try {
        // 获取文档块信息
        const blockResult = await pluginInstance.kernelApi.getBlockByID(currentRndId)
        if (!blockResult) {
          content = "获取文档块信息失败"
          tips = "或许文档已被删除，请尝试使用其他过滤条件。"
          currentRndId = undefined
          isLoading = false
          return
        }
        
        // 设置标题
        title = blockResult.content || "无标题"
        
        // 获取文档详细内容
        const docResult = await pluginInstance.kernelApi.getDoc(currentRndId)
        
        if (!docResult || docResult.code !== 0) {
          content = "获取文档详情失败"
          tips = "或许文档已被删除，请尝试使用其他过滤条件。"
          isLoading = false
          return
        }
        
        // 设置内容
        const doc = docResult.data as any
        content = doc.content || ""
        
        // 只读模式
        content = content.replace(/contenteditable="true"/g, 'contenteditable="false"')
      } catch (error) {
        pluginInstance.logger.error("获取文档内容时出错:", error)
        content = "获取文档内容时出错: " + error.message
        tips = "发生错误，请检查日志获取详细信息。"
        isLoading = false
        return
      }
      
      // 获取文档的优先级数据
      try {
        // 保存当前处理的文档ID，用于后续校验
        const processingDocId = currentRndId
        
        // 获取文档的优先级数据
        const docPriorityData = await pr.getDocPriorityData(processingDocId)
        
        // 检查文档ID是否已经改变
        if (processingDocId !== currentRndId) {
          pluginInstance.logger.warn(`文档ID已改变，放弃处理 ${processingDocId} 的优先级数据`)
          return
        }
        
        // 使用文档指标对象
        docPriority = docPriorityData.metrics
        
        // 获取指标配置
        docMetrics = pr.getMetrics()
        
        if (!docMetrics || docMetrics.length === 0) {
          pluginInstance.logger.error("无法获取指标配置，尝试重新初始化...")
          // 重新初始化审阅器以获取指标配置
          await pr.initIncrementalConfig()
          docMetrics = pr.getMetrics()
          
          if (!docMetrics || docMetrics.length === 0) {
            pluginInstance.logger.error("重新初始化后仍无法获取指标配置")
            content = "获取指标配置失败，请检查渐进阅读设置。"
            tips = "无法加载指标配置，请重新设置指标。"
            isLoading = false
            return
          }
        }
      } catch (error) {
        pluginInstance.logger.error("获取文档优先级数据失败:", error)
        content = "获取文档优先级数据失败: " + error.message
        tips = "无法加载优先级数据，但可以继续阅读。"
      }
      
      // 获取选中概率
      let selectionProbabilityText = "未知"
      try {
        const selectionProbability = pr.getLastSelectionProbability()
        // 严格按照要求显示4位小数，不进行任何约数处理
        selectionProbabilityText = selectionProbability.toFixed(4) + "%"
        pluginInstance.logger.info(`显示的概率值: ${selectionProbabilityText}, 原始概率值: ${selectionProbability}`)
      } catch (error) {
        pluginInstance.logger.error("获取概率值失败:", error)
        showMessage("获取概率值失败: " + error.message, 3000, "error")
        selectionProbabilityText = "计算出错"
      }
      
      // 获取已访问文档数量
      const visitedCount = await pr.getTodayVisitedCount()
      const remainingCount = total - visitedCount
      
      tips = `${total}篇文档已剩${remainingCount}。展卷乃无言的情意，以${selectionProbabilityText}的机遇，踏碎星辰来看你，三秋霜雪作马蹄。`
      
    } catch (e) {
      pluginInstance.logger.error("渐进复习出错:", e)
      content = "渐进复习出错: " + (e.message || e)
      tips = "发生了意外错误，请检查控制台日志获取详细信息。"
    } finally {
      isLoading = false
    }
  }

  /**
   * 重置所有文档的访问记录
   */
  async function resetAllVisitCounts() {
    try {
      // 使用IncrementalReviewer的重置方法
      await pr.resetTodayVisits()
    } catch (error) {
      pluginInstance.logger.error("重置访问记录失败", error)
      showMessage(`重置失败: ${error.message}`, 5000, "error")
      throw error
    }
  }

  // 一遍过模式获取文档
  const getOnceModeDoc = async () => {
    const filterCondition = pr.buildFilterCondition(storeConfig)
    // 先获取符合条件的总记录数
    const countSql = `
        SELECT COUNT(id) as total 
        FROM blocks 
        WHERE 
            type = 'd' 
            ${filterCondition}
            AND id NOT IN (
                SELECT block_id FROM attributes 
                WHERE name = 'custom-visit-count'
            )`
    const countResult = await pluginInstance.kernelApi.sql(countSql)
    if (countResult.code !== 0) {
      throw new Error(countResult.msg)
    }
    const total = countResult.data[0]?.total || 0
    if (total === 0) {
      // 使用IncrementalReviewer的重置方法
      await pr.resetTodayVisits(filterCondition)
      // 重置后再次尝试
      return await getOnceModeDoc()
    }

    // 随机选择一个未复习的文档
    const selectSql = `
        SELECT id 
        FROM blocks 
        WHERE 
            type = 'd' 
            ${filterCondition}
            AND id NOT IN (
                SELECT block_id FROM attributes 
                WHERE name = 'custom-visit-count'
            )
        ORDER BY RANDOM() 
        LIMIT 1`
    const selectResult = await pluginInstance.kernelApi.sql(selectSql)
    if (selectResult.code !== 0) {
      throw new Error(selectResult.msg)
    }
    const selectedData = selectResult.data as any[]
    if (!selectedData || selectedData.length === 0) return null
    const selectedId = selectedData[0].id

    // 更新访问记录
    await pluginInstance.kernelApi.setBlockAttrs(selectedId, {
      "custom-visit-count": "1",
    })

    return {
      id: selectedId,
      count: total - 1,
    }
  }

  // 处理自定义 SQL 模式
  const handleCustomSqlMode = async () => {
    const currentSql = storeConfig.currentSql
    const result = await pluginInstance.kernelApi.sql(currentSql)
    if (result.code !== 0) {
      showMessage(pluginInstance.i18n.docFetchError, 7000, "error")
      throw new Error(result.msg)
    }

    const data = result.data as any[]
    if (!data || data.length === 0) {
      throw new Error(new Date().toISOString() + "：" + "没有找到符合条件的文档")
    }
    const firstKey = Object.keys(data[0])[0]
    const docId = data[0][firstKey]

    pluginInstance.logger.info(`自定义SQL获取文档: ${docId}`)
    return docId
  }

  // 获取文档总数
  const getTotalDocCount = async () => {
    return await pr.getTotalDocCount(storeConfig)
  }

  // events
  const clearDoc = () => {
    currentRndId = undefined
    content = ""
    tips = "条件已改变，请重新漫游！待从头，收拾旧山河，朝天阙！"
  }

  const onNotebookChange = async function () {
    // 笔记本选择切换
    storeConfig.notebookId = toNotebookId
    await pluginInstance.saveData(storeName, storeConfig)
    
    // 重置文档
    clearDoc()
    
    // 如果当前是渐进模式，需要重新初始化reviewer以更新笔记本过滤条件
    if (reviewMode === ReviewMode.Incremental && filterMode === FilterMode.Notebook) {
      pluginInstance.logger.info("笔记本变更后重新初始化渐进模式...")
      pr = new IncrementalReviewer(storeConfig, pluginInstance)
      await pr.initIncrementalConfig()
      
      // 自动开始新的漫游，避免用户手动点击
      await doIncrementalRandomDoc()
    }
    
    pluginInstance.logger.info("storeConfig saved notebookId =>", storeConfig)
  }

  const onSqlChange = async function () {
    // 显示当前选择的名称
    storeConfig.currentSql = currentSql
    await pluginInstance.saveData(storeName, storeConfig)
    // 重置文档
    clearDoc()
    pluginInstance.logger.info("storeConfig saved currentSql =>", storeConfig)
  }

  const onReviewModeChange = async function () {
    // 模式切换
    storeConfig.reviewMode = reviewMode
    await pluginInstance.saveData(storeName, storeConfig)
    // 重置文档
    clearDoc()
    // 如果切换到渐进模式，需要重新初始化pr
    if (reviewMode === ReviewMode.Incremental) {
      pr = null
    }
    pluginInstance.logger.info("storeConfig saved reviewMode =>", storeConfig)
  }

  const onFilterModeChange = async function () {
    // 模式切换
    storeConfig.filterMode = filterMode
    await pluginInstance.saveData(storeName, storeConfig)
    
    // 重置文档
    clearDoc()
    
    // 如果当前是渐进模式，需要重新初始化reviewer以更新筛选条件
    if (reviewMode === ReviewMode.Incremental) {
      pluginInstance.logger.info("筛选模式变更后重新初始化渐进模式...")
      pr = new IncrementalReviewer(storeConfig, pluginInstance)
      await pr.initIncrementalConfig()
      
      // 自动开始新的漫游，避免用户手动点击
      await doIncrementalRandomDoc()
    }
    
    pluginInstance.logger.info("storeConfig saved filterMode =>", storeConfig)
  }

  const onRootIdChange = async function () {
    // 显示当前选择的名称
    storeConfig.rootId = rootId
    await pluginInstance.saveData(storeName, storeConfig)
    
    // 重置文档
    clearDoc()
    
    // 如果当前是渐进模式，需要重新初始化reviewer以更新筛选条件
    if (reviewMode === ReviewMode.Incremental && filterMode === FilterMode.Root) {
      pluginInstance.logger.info("根文档ID变更后重新初始化渐进模式...")
      pr = new IncrementalReviewer(storeConfig, pluginInstance)
      await pr.initIncrementalConfig()
      
      // 自动开始新的漫游，避免用户手动点击
      await doIncrementalRandomDoc()
    }
    
    pluginInstance.logger.info("storeConfig saved rootId =>", storeConfig)
  }

  const openDocEditor = async () => {
    await openTab({
      app: pluginInstance.app,
      doc: {
        id: currentRndId,
      },
    })
  }

  const openHelpDoc = () => {
    window.open("https://github.com/ebAobS/roaming-mode-incremental-reading/blob/main/README_zh_CN.md")
  }

  // 导出函数，让外部可以调用
  export const resetAndRefresh = async () => {
    try {
      await resetAllVisitCounts()
      
      // 重置后立即重新漫游
      if (reviewMode === ReviewMode.Incremental) {
        await doIncrementalRandomDoc()
      } else {
        await doRandomDoc()
      }
    } catch (error) {
      pluginInstance.logger.error("重置访问记录失败", error)
      showMessage("重置失败: " + error.message, 5000, "error")
    }
  }

  // 优先级变更回调
  function handlePriorityChange(event) {
    // 记录数值型的总优先级，用于显示
    const numericPriority = event.detail.priority
    pluginInstance.logger.info(`优先级已更新: ${numericPriority}`)
  }
  
  /**
   * 显示漫游历史对话框
   */
  const showRoamingHistory = async () => {
    if (!pr) {
      showMessage("请先开始漫游", 3000, "info")
      return
    }
    
    isLoadingHistory = true
    
    try {
      // 获取历史记录
      roamingHistory = await pr.getRoamingHistory()
      
      // 销毁旧对话框
      if (historyDialog) {
        historyDialog.destroy()
        historyDialog = null
      }
      
      // 创建对话框
      historyDialog = new Dialog({
        title: "漫游历史记录",
        content: '<div id="roaming-history-container" class="history-container"></div>',
        width: "600px",
        height: "400px",
      })
      
      // 确保对话框容器样式正确
      const container = historyDialog.element.querySelector(".b3-dialog__container")
      if (container) {
        container.style.maxWidth = "80vw"
      }
      
      // 渲染历史记录
      renderHistoryTable()
    } catch (error) {
      pluginInstance.logger.error("获取漫游历史失败:", error)
      showMessage("无法获取漫游历史: " + error.message, 3000, "error")
    } finally {
      isLoadingHistory = false
    }
  }
  
  /**
   * 渲染历史记录表格
   */
  const renderHistoryTable = () => {
    if (!historyDialog) return
    
    const container = historyDialog.element.querySelector("#roaming-history-container")
    if (!container) return
    
    if (roamingHistory.length === 0) {
      container.innerHTML = '<div class="empty-history">暂无漫游历史记录</div>'
      return
    }
    
    const tableHTML = `
      <div class="history-table-container">
        <table class="history-table">
          <thead>
            <tr>
              <th style="width: 180px">时间</th>
              <th>文档标题</th>
              <th style="width: 80px">概率</th>
              <th style="width: 70px">操作</th>
            </tr>
          </thead>
          <tbody>
            ${roamingHistory.map((item, index) => {
              const date = new Date(item.timestamp)
              const formattedDate = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
              
              return `
                <tr data-id="${item.id}" class="history-item">
                  <td>${formattedDate}</td>
                  <td class="history-title" title="${item.title}">${item.title}</td>
                  <td>${item.probability}%</td>
                  <td>
                    <button class="b3-button b3-button--outline btn-open-doc" data-id="${item.id}">
                      打开
                    </button>
                  </td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="history-footer">
        <button class="b3-button b3-button--outline btn-clear-history">
          清空历史
        </button>
      </div>
    `
    
    container.innerHTML = tableHTML
    
    // 添加事件监听
    const openButtons = container.querySelectorAll('.btn-open-doc')
    openButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const docId = (e.currentTarget as HTMLElement).dataset.id
        if (docId) {
          // 在新标签页打开文档
          openTab({
            app: pluginInstance.app,
            doc: { id: docId }
          })
        }
      })
    })
    
    // 添加点击行打开文档
    const historyItems = container.querySelectorAll('.history-item')
    historyItems.forEach(item => {
      item.addEventListener('click', (e) => {
        // 如果点击的是按钮，不处理
        if ((e.target as HTMLElement).closest('.btn-open-doc')) {
          return
        }
        
        const docId = (item as HTMLElement).dataset.id
        if (docId) {
          // 在新标签页打开文档
          openTab({
            app: pluginInstance.app,
            doc: { id: docId }
          })
        }
      })
    })
    
    // 添加清空历史按钮事件
    const clearButton = container.querySelector('.btn-clear-history')
    if (clearButton) {
      clearButton.addEventListener('click', async () => {
        try {
          if (confirm("确定要清空所有漫游历史记录吗？")) {
            await pr.clearRoamingHistory()
            roamingHistory = []
            renderHistoryTable()
            showMessage("漫游历史已清空", 3000, "info")
          }
        } catch (error) {
          showMessage("清空历史失败: " + error.message, 3000, "error")
        }
      })
    }
  }
  
  // 关闭历史对话框
  const closeHistoryDialog = () => {
    showHistoryDialog = false
    if (historyDialog) {
      historyDialog.destroy()
      historyDialog = null
    }
  }

  // lifecycle
  onMount(async () => {
    // 读取配置
    storeConfig = await pluginInstance.safeLoad(storeName)

    // 读取笔记本
    const res = await pluginInstance.kernelApi.lsNotebooks()
    notebooks = (res?.data as any)?.notebooks ?? []
    // 用户指南不应该作为可以写入的笔记本
    const hiddenNotebook: Set<string> = new Set(["思源笔记用户指南", "SiYuan User Guide"])
    // 没有必要把所有笔记本都列出来
    notebooks = notebooks.filter((notebook) => !notebook.closed && !hiddenNotebook.has(notebook.name))
    // 选中，若是没保存，获取第一个
    toNotebookId = storeConfig?.notebookId ?? notebooks[0].id

    // 筛选模式
    if (!storeConfig?.filterMode) {
      storeConfig.filterMode = FilterMode.Notebook
    }
    filterMode = storeConfig.filterMode
    rootId = storeConfig?.rootId ?? ""

    // 复习模式
    if (!storeConfig?.reviewMode) {
      storeConfig.reviewMode = ReviewMode.Incremental
    }
    reviewMode = storeConfig.reviewMode

    // 处理自定义 sql
    if (storeConfig?.customSqlEnabled) {
      sqlList = JSON.parse(storeConfig?.sql ?? "[]")
      if (sqlList.length == 0) {
        showMessage(pluginInstance.i18n.customSqlEmpty, 7000, "error")
        return
      }
      currentSql = storeConfig?.currentSql ?? sqlList[0].sql
      storeConfig.currentSql = currentSql
    }

    // 初始化渐进模式
    if (reviewMode === ReviewMode.Incremental) {
      pr = new IncrementalReviewer(storeConfig, pluginInstance)
      await pr.initIncrementalConfig()
    }

    // 开始漫游
    await doRandomDoc()
  })
</script>

<div class="fn__flex-1 protyle" data-loading="finished">
  <Loading show={isLoading && storeConfig.showLoading} />
  <div class="protyle-content protyle-content--transition" data-fullwidth="true">
    <div class="protyle-title protyle-wysiwyg--attr" style="margin: 16px 96px 0px;">
      <div
        style="margin:20px 0"
        contenteditable="false"
        data-position="center"
        spellcheck="false"
        class="protyle-title__input"
        data-render="true"
      >
        {title}
      </div>
    </div>
    <div
      class="protyle-wysiwyg protyle-wysiwyg--attr"
      spellcheck="false"
      contenteditable="false"
      style="padding: 16px 96px 281.5px;"
      data-doc-type="NodeDocument"
    >
      <div class="action-btn-group">
        {#if storeConfig?.customSqlEnabled}
          <select
            class="action-item b3-select fn__flex-center fn__size180 notebook-select"
            bind:value={currentSql}
            on:change={onSqlChange}
          >
            {#if sqlList && sqlList.length > 0}
              {#each sqlList as s (s.sql)}
                <option value={s.sql}>{s.name}</option>
              {/each}
            {:else}
              <option value="">{pluginInstance.i18n.loading}...</option>
            {/if}
          </select>
          <span class="custom-sql">当前使用自定义 SQL 漫游</span>
        {:else}
          <span class="filter-label">筛选:</span>
          <select
            bind:value={filterMode}
            class="action-item b3-select fn__flex-center fn__size100"
            on:change={onFilterModeChange}
          >
            <option value={FilterMode.Notebook}>笔记本</option>
            <option value={FilterMode.Root}>根文档</option>
          </select>
          {#if filterMode === FilterMode.Notebook}
            <select
              class="action-item b3-select fn__flex-center fn__size150"
              bind:value={toNotebookId}
              on:change={onNotebookChange}
            >
              <option value="" selected>全部笔记本</option>
              {#if notebooks && notebooks.length > 0}
                {#each notebooks as notebook (notebook.id)}
                  <option value={notebook.id}>{notebook.name}</option>
                {/each}
              {:else}
                <option value="0">{pluginInstance.i18n.loading}...</option>
              {/if}
            </select>
          {:else}
            <input
              class="b3-text-field fn__size150"
              bind:value={rootId}
              on:change={onRootIdChange}
              placeholder="输入根文档ID"
            />
          {/if}
          <span class="filter-label">模式:</span>
          <select
            bind:value={reviewMode}
            class="action-item b3-select fn__flex-center fn__size100"
            on:change={onReviewModeChange}
          >
            <option value={ReviewMode.Incremental}>渐进</option>
            <option value={ReviewMode.Once}>一遍过</option>
          </select>
        {/if}

        <button class="action-item b3-button primary-btn btn-small" on:click={reviewMode === ReviewMode.Incremental ? doIncrementalRandomDoc : doRandomDoc}>
          {isLoading ? "漫游中..." : "继续漫游"}
        </button>
        <button class="action-item b3-button primary-btn btn-small" on:click={openDocEditor}>编辑</button>
        <button class="action-item b3-button b3-button--outline btn-small reset-button" on:click={resetAndRefresh} title="清空已访问的文档记录">
          重置已访问
        </button>
        <button class="action-item b3-button b3-button--outline btn-small light-btn history-button" on:click={showRoamingHistory} title="查看漫游历史记录">
          漫游历史
        </button>
        <button
          class="action-item b3-button b3-button--outline btn-small light-btn help-icon"
          on:click={openHelpDoc}
          title={pluginInstance.i18n.help}
        >
          ?
        </button>
      </div>

      {#if reviewMode === ReviewMode.Incremental && currentRndId}
        <MetricsPanel
          pluginInstance={pluginInstance}
          docId={currentRndId}
          reviewer={pr}
          metrics={docMetrics}
          {docPriority}
          on:priorityChange={handlePriorityChange}
        />
      {/if}

      <div class="rnd-doc-custom-tips">
        <div
          data-type="NodeParagraph"
          class="p"
          style="color: var(--b3-card-info-color);background-color: var(--b3-card-info-background);"
        >
          <div class="t" contenteditable="false" spellcheck="false">{tips}</div>
          <div class="protyle-attr" contenteditable="false" />
        </div>
      </div>
      {@html content}
    </div>
  </div>
</div>

<style lang="stylus">
  .fr
    float right

  .custom-sql
    margin-left 10px
    color: red
    font-size 13px

  .action-btn-group
    margin: 10px 0
    display: flex
    align-items: center
    flex-wrap: wrap
    gap: 5px

    .action-item
      margin-left 3px

  .filter-label
    font-size 13px
    margin-left 5px
    margin-right 2px
    
  .btn-small
    padding: 4px 8px
    font-size: 12px
    height: 26px
    line-height: 18px

  .help-icon
    width: 26px
    padding: 4px 0

  .b3-select
    max-width 120px
    height: 26px
    
  .fn__size100
    width: 100px !important
    
  .fn__size150
    width: 150px !important
    
  .fn__size180
    width: 180px !important
    
  .reset-button
    color: var(--b3-theme-on-background)
    background-color: var(--b3-theme-error-lighter) !important
    &:hover
      background-color: var(--b3-theme-error-light) !important
      
  .history-button
    color: var(--b3-theme-on-background)
    background-color: var(--b3-theme-primary-lighter) !important
    &:hover
      background-color: var(--b3-theme-primary-light) !important
      
  /* 历史记录样式 */
  .history-container
    height: 100%
    padding: 8px 0
    overflow: auto
    
  .history-table-container
    height: calc(100% - 40px)
    overflow: auto
    
  .history-table
    width: 100%
    border-collapse: collapse
    
    th
      background-color: var(--b3-theme-surface)
      padding: 8px
      text-align: left
      position: sticky
      top: 0
      z-index: 1
      
    td
      padding: 8px
      border-bottom: 1px solid var(--b3-border-color)
      
    .history-item
      cursor: pointer
      
      &:hover
        background-color: var(--b3-list-hover)
        
    .history-title
      max-width: 300px
      overflow: hidden
      text-overflow: ellipsis
      white-space: nowrap
      
  .history-footer
    padding: 8px
    text-align: right
    border-top: 1px solid var(--b3-border-color)
    margin-top: 8px
    
  .empty-history
    text-align: center
    padding: 40px
    color: var(--b3-theme-on-surface-light)
    font-style: italic

  .primary-btn
    background-color: var(--b3-theme-primary) !important
    color: white !important
    &:hover
      background-color: var(--b3-theme-primary-light) !important
      
  .light-btn
    color: var(--b3-theme-on-surface)
    background-color: var(--b3-theme-background) !important
    border-color: var(--b3-theme-surface-lighter) !important
    &:hover
      background-color: var(--b3-theme-surface-light) !important
</style>
