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
  import { onMount, onDestroy, tick } from "svelte"
  import { storeName } from "../Constants"
  import RandomDocConfig, { FilterMode } from "../models/RandomDocConfig"
  import { Dialog, openTab, showMessage } from "siyuan"
  import RandomDocPlugin from "../index"
  import IncrementalReviewer from "../service/IncrementalReviewer"
  import MetricsPanel from "./MetricsPanel.svelte"
  import PriorityBarChart from "./PriorityBarChart.svelte"
  import { isContentEmpty } from "../utils/utils"
  import { icons } from "../utils/svg"
  import { showSettingMenu } from "../topbar"
  import type { DocPriorityData } from "../models/IncrementalConfig"
  import type { DocBasicInfo } from "../models/IncrementalConfig"
  import type { Metric } from "../models/IncrementalConfig"
  import { isLocked, toggleLock, setLocked } from "../stores/lockStore"

  // props
  export let pluginInstance: RandomDocPlugin

  // vars
  let isLoading = false
  let storeConfig: RandomDocConfig
  let notebooks = []
  let selectedNotebooks = [] // 存储选中的笔记本ID
  let showNotebookSelector = false // 控制下拉框显示
  let filterMode = FilterMode.Notebook
  let rootId = ""
  
  // 标签筛选相关变量
  let selectedTags: string[] = []
  let availableTags: string[] = []
  let isTagsLoading = false
  let showTagDropdown = false
  
  // 根文档选择器相关变量 - 混合输入模式
  let isDocsLoading = false
  let showDocSelector = false
  let selectedDocTitle = ""
  let currentLevel = "notebooks" // "notebooks" | "docs" | "childDocs"
  let selectedNotebookForDoc = null // 当前选中的笔记本
  let rootDocsList: any[] = [] // 当前笔记本下的根文档列表
  let childDocsList: any[] = [] // 当前文档的子文档列表
  let docNavigationStack: any[] = [] // 文档导航栈，记录导航历史
  let showManualInput = false // 是否显示手动输入框
  let manualInputId = "" // 手动输入的ID
  
  let title = pluginInstance.i18n.welcomeTitle
  let tips = pluginInstance.i18n.welcomeTips
  let fullTips = pluginInstance.i18n.welcomeTips // 完整的tips内容，包含诗意部分
  let currentRndId
  let unReviewedCount = 0
  let content = ""
  let toNotebookId = "" // 当前选中的笔记本ID

  let sqlList: any[] = []
  let currentSql = ""
  let pr: IncrementalReviewer
  
  // 渐进模式相关
  let docMetrics = []
  let docPriority: { [key: string]: number } = {}
  
  // 漫游历史相关
  let protyleContainer: HTMLDivElement | null = null;
  let protyleInstance: any = null;
  let editableContent = "";
  let isEditing = false;
  let saveTimeout: any = null;

  // 新增：已访问文档列表弹窗相关
  let showVisitedDialog = false
  let visitedDocs: Array<{id: string, content: string, lastTime?: string}> = []
  let visitedLoading = false

  // 新增：优先级排序弹窗相关
  let showPriorityDialog = false
  let priorityLoading = false
  let priorityList: any[] = []

  // 新增：移动端指标弹窗相关
  let showMobileMetricsDialog = false

  // 拖动排序相关
  let draggedItem: any = null
  let draggedIndex = -1
  let dragOverIndex = -1

  // 设置优先级输入框的值 - 不再需要
  function setPriorityInputValue(docId: string, value: number) {
    // 不再使用这个函数来存储值
  }

  // 处理输入步进，修复小数点问题
  function handleInputStep(e: Event) {
    const input = e.target as HTMLInputElement
    const value = parseFloat(input.value)
    if (!isNaN(value)) {
      // 确保保留两位小数
      input.value = value.toFixed(2)
    }
  }

  // 处理拖动开始
  function handleDragStart(e: DragEvent, item: any, index: number) {
    draggedItem = item
    draggedIndex = index
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', '') // 必须设置数据才能开始拖动
  }

  // 处理拖动悬停
  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedIndex !== index) {
      dragOverIndex = index
    }
  }

  // 处理拖动进入
  function handleDragEnter(e: DragEvent, index: number) {
    e.preventDefault()
    if (draggedIndex !== index) {
      dragOverIndex = index
    }
  }

  // 处理拖动离开
  function handleDragLeave(e: DragEvent) {
    e.preventDefault()
    // 只有在真正离开元素时才清除悬停状态
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      dragOverIndex = -1
    }
  }

  // 处理拖动放下
  async function handleDrop(e: DragEvent, dropIndex: number) {
    e.preventDefault()
    if (draggedIndex === -1 || draggedIndex === dropIndex) {
      draggedItem = null
      draggedIndex = -1
      dragOverIndex = -1
      return
    }

    try {
      // 暂时禁用所有输入，防止中间状态出现错误
      const inputFields = document.querySelectorAll('.priority-sortable-list input[type="number"]')
      inputFields.forEach((input: HTMLInputElement) => {
        input.disabled = true
      })
      
      // 记录被拖动的文档ID
      const draggedDocId = draggedItem.id
      
      // 计算新的优先级（上下两个条目的平均值）
      let newPriority = 5.0 // 默认值
      
      if (dropIndex === 0) {
        // 拖到第一位，优先级设为当前第一位的优先级 + 1
        newPriority = priorityList[0].priority + 1
      } else if (dropIndex === priorityList.length) {
        // 拖到最后一位，优先级设为当前最后一位的优先级 - 1
        newPriority = priorityList[priorityList.length - 1].priority - 1
      } else {
        // 拖到中间位置，优先级设为上下两个条目的平均值
        const upperPriority = priorityList[dropIndex - 1].priority
        const lowerPriority = priorityList[dropIndex].priority
        newPriority = (upperPriority + lowerPriority) / 2
      }

      // 确保优先级在合理范围内
      newPriority = Math.max(0, Math.min(10, newPriority))

      // 更新文档的指标参数
      await updateDocPriorityByValue(draggedDocId, newPriority)

      // 更新列表中的优先级
      const draggedItemIndex = priorityList.findIndex(d => d.id === draggedDocId)
      if (draggedItemIndex !== -1) {
        priorityList[draggedItemIndex].priority = newPriority
      }
      
      // 重新排序列表前进行深拷贝，确保数据引用完全刷新
      const sortedList = JSON.parse(JSON.stringify(priorityList))
      sortedList.sort((a, b) => b.priority - a.priority)
      
      // 设置新的列表（触发Svelte更新）
      priorityList = sortedList
      
      // 等待DOM更新完成
      await tick()
      
      // 重新启用所有输入
      document.querySelectorAll('.priority-sortable-list input[type="number"]').forEach((input: HTMLInputElement) => {
        input.disabled = false
      })

      // 如果当前文档也在列表中，刷新点图
      if (draggedDocId === currentRndId) {
        await refreshPriorityBarPoints()
        if (typeof pr.getDocPriorityData === 'function') {
          const docPriorityData = await pr.getDocPriorityData(currentRndId)
          docPriority = docPriorityData.metrics
        }
      }
    } catch (err) {
      pluginInstance.logger.error("拖动排序失败", err)
      showMessage("拖动排序失败: " + err.message, 3000, "error")
      
      // 重新启用所有输入
      document.querySelectorAll('.priority-sortable-list input[type="number"]').forEach((input: HTMLInputElement) => {
        input.disabled = false
      })
    } finally {
      draggedItem = null
      draggedIndex = -1
      dragOverIndex = -1
    }
  }

  // 更新文档优先级（按值设置）
  async function updateDocPriorityByValue(docId: string, newPriority: number) {
    if (!pr) return
    
    try {
      // 获取所有指标
      const metrics = pr.getMetrics()
      // 按权重分配每个指标的值，使归一化优先级等于 newPriority
      await Promise.all(metrics.map(metric => {
        return pr.updateDocMetric(docId, metric.id, newPriority)
      }))
      
      // 同时更新文档的priority属性
      if (typeof pr.updateDocPriority === 'function') {
        await pr.updateDocPriority(docId, newPriority)
      }
    } catch (err) {
      pluginInstance.logger.error("更新文档优先级失败", err)
      throw err
    }
  }

  // 增加优先级
  async function increasePriorityInList(docId: string) {
    const doc = priorityList.find(d => d.id === docId)
    if (!doc) return
    
    // 增加0.1并确保保留两位小数
    let newValue = Math.min(10, parseFloat((doc.priority + 0.1).toFixed(2)))
    await handlePriorityInputInList(docId, newValue)
  }

  // 减少优先级
  async function decreasePriorityInList(docId: string) {
    const doc = priorityList.find(d => d.id === docId)
    if (!doc) return
    
    // 减少0.1并确保保留两位小数
    let newValue = Math.max(0, parseFloat((doc.priority - 0.1).toFixed(2)))
    await handlePriorityInputInList(docId, newValue)
  }

  // 处理优先级输入
  async function handlePriorityInputInList(docId: string, newValue: number) {
    if (!pr) return
    
    try {
      // 确保保留两位小数
      newValue = parseFloat(newValue.toFixed(2))
      
      // 暂时禁用所有输入，防止中间状态出现错误
      const inputFields = document.querySelectorAll('.priority-sortable-list input[type="number"]')
      inputFields.forEach((input: HTMLInputElement) => {
        input.disabled = true
      })
      
      // 更新数据库中的优先级
      await updateDocPriorityByValue(docId, newValue)
      
      // 找到并更新当前文档的优先级
      const docIndex = priorityList.findIndex(d => d.id === docId)
      if (docIndex !== -1) {
        priorityList[docIndex].priority = newValue
      }
      
      // 重新排序列表前进行深拷贝，确保数据引用完全刷新
      const sortedList = JSON.parse(JSON.stringify(priorityList))
      sortedList.sort((a, b) => b.priority - a.priority)
      
      // 设置新的列表（触发Svelte完全重新渲染）
      priorityList = sortedList
      
      // 等待DOM更新完成
      await tick()
      
      // 重新启用所有输入
      document.querySelectorAll('.priority-sortable-list input[type="number"]').forEach((input: HTMLInputElement) => {
        input.disabled = false
      })
      
      // 如果当前文档也在列表中，刷新点图
      if (docId === currentRndId) {
        await refreshPriorityBarPoints()
        if (typeof pr.getDocPriorityData === 'function') {
          const docPriorityData = await pr.getDocPriorityData(currentRndId)
          docPriority = docPriorityData.metrics
        }
      }
    } catch (err) {
      pluginInstance.logger.error("设置优先级失败", err)
      showMessage("设置优先级失败: " + err.message, 3000, "error")
      
      // 重新启用所有输入
      document.querySelectorAll('.priority-sortable-list input[type="number"]').forEach((input: HTMLInputElement) => {
        input.disabled = false
      })
    }
  }

  // 优先级分布点图相关
  let priorityBarPoints: Array<{ id: string; title?: string; priority: number }> = []
  let priorityBarMin = 0
  let priorityBarMax = 10
  let currentDocPriority: number | undefined = undefined;

  // methods
  // 删除doRandomDoc方法及所有相关调用，所有漫游逻辑只保留doIncrementalRandomDoc
  /**
   * 渐进模式下的文档漫游
   */
  export const doIncrementalRandomDoc = async () => {
    // 每次漫游前强制刷新配置，确保概率配置为最新
    storeConfig = await pluginInstance.safeLoad(storeName)
    isLoading = true
    title = "漫游中..."
    content = ""
    tips = "加载中..."
    let result = undefined // 修复linter错误，提升result作用域
    
    // 清空当前文档ID和指标数据，避免显示上一篇文章的数据
    currentRndId = undefined
    docPriority = {}
    docMetrics = []

    try {
      // 检查是否启用了自定义SQL模式
      if (storeConfig?.customSqlEnabled && storeConfig?.currentSql) {
        // 使用自定义SQL模式
        const docId = await handleCustomSqlMode()
        if (docId) {
          currentRndId = docId
          
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
          
          // 初始化可编辑内容
          await initEditableContent()
          
          setTips(`展卷乃无言的情意：通过自定义SQL查询邂逅此文，穿越星辰遇见你，三秋霜雪印马蹄。`)
          
          isLoading = false
          return
        }
      }
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
        result = await pr.getRandomDoc()
        let newDocId, isAbsolutePriority = false
        if (typeof result === 'object' && result !== null && 'docId' in result) {
          newDocId = result.docId
          isAbsolutePriority = result.isAbsolutePriority
        } else {
          newDocId = result
        }
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
        
        // 初始化可编辑内容
        await initEditableContent()
        
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
      const visitedCount = await pr.getVisitedCount()
      const remainingCount = total - visitedCount
      
      // 优先级顺序漫游提示

      if (typeof result === 'object' && result.isAbsolutePriority) {
        let rankText = "未知"
        try {
          const priorityList = await pr.getPriorityList()
          const rank = priorityList.findIndex(doc => doc.id === currentRndId)
          if (rank !== -1) {
            rankText = (rank + 1).toString()
          }
        } catch (error) {
          pluginInstance.logger.error("获取优先级排序位次失败:", error)
          rankText = "计算出错"
        }
        setTips(`展卷乃无言的情意：缘自优先级第${rankText}的顺序，穿越星辰遇见你，三秋霜雪印马蹄。${total}篇文档已剩${remainingCount}。`)
      } else {
        setTips(`展卷乃无言的情意：以${selectionProbabilityText}的机遇，穿越星辰遇见你，三秋霜雪印马蹄。${total}篇文档已剩${remainingCount}。`)
      }
      
      // 增加文档的漫游次数
      try {
        await pr.incrementRoamingCount(currentRndId)
      } catch (error) {
        pluginInstance.logger.error("增加漫游次数失败:", error)
        // 不影响主要功能，只记录错误
      }
      
    } catch (e) {
      pluginInstance.logger.error("渐进复习出错:", e)
      content = "渐进复习出错: " + (e.message || e)
      tips = "发生了意外错误，请检查控制台日志获取详细信息。"
    } finally {
      isLoading = false
    }
  }

  /**
   * 漫游指定文档
   * 在渐进阅读面板中显示指定的文档
   * 
   * @param docId 要漫游的文档ID
   */
  export const roamSpecificDocument = async (docId: string) => {
    if (isLoading) {
      pluginInstance.logger.warn("上次操作还未结束，忽略")
      return
    }

    try {
      isLoading = true
      title = "加载中..."
      content = ""
      tips = "正在加载指定文档..."
      
      // 清空当前文档ID和指标数据，避免显示上一篇文章的数据
      currentRndId = undefined
      docPriority = {}
      docMetrics = []

      pluginInstance.logger.info(`开始漫游指定文档: ${docId}`)

      // 验证文档是否存在
      const blockResult = await pluginInstance.kernelApi.getBlockByID(docId)
      if (!blockResult) {
        content = "指定的文档不存在"
        tips = "或许文档已被删除，请检查文档ID是否正确。"
        isLoading = false
        return
      }

      // 设置当前文档ID
      currentRndId = docId
      
      // 设置标题
      title = blockResult.content || "无标题"
      
      // 获取文档详细内容
      const docResult = await pluginInstance.kernelApi.getDoc(docId)
      
      if (!docResult || docResult.code !== 0) {
        content = "获取文档详情失败"
        tips = "或许文档已被删除，请检查文档ID是否正确。"
        isLoading = false
        return
      }
      
      // 设置内容
      const doc = docResult.data as any
      content = doc.content || ""
      
      // 初始化可编辑内容
      await initEditableContent()
      
      // 处理空文档
      if (isContentEmpty(content)) {
        content = "该文档内容为空"
        tips = "白纸素笺无墨迹，且待片刻焕新篇。"
        isLoading = false
        return
      }

      // 如果是渐进模式，获取文档的优先级数据
      if (storeConfig.reviewMode === "incremental") {
        try {
          // 检查渐进复习器是否已初始化
          if (!pr) {
            pr = new IncrementalReviewer(storeConfig, pluginInstance)
            await pr.initIncrementalConfig()
          }
          
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
              tips = "无法加载指标配置，但可以继续阅读。"
              isLoading = false
              return
            }
          }
        } catch (error) {
          pluginInstance.logger.error("获取文档优先级数据失败:", error)
          content = "获取文档优先级数据失败: " + error.message
          tips = "无法加载优先级数据，但可以继续阅读。"
        }
      }
      
      setTips(`展卷乃无言的情意：穿越星辰遇见你，三秋霜雪印马蹄。正在漫游指定文档。`)
      
      // 增加文档的漫游次数
      try {
        if (pr) {
          await pr.incrementRoamingCount(currentRndId)
        }
      } catch (error) {
        pluginInstance.logger.error("增加漫游次数失败:", error)
        // 不影响主要功能，只记录错误
      }
      
    } catch (error) {
      pluginInstance.logger.error("漫游指定文档失败:", error)
      content = "漫游指定文档失败: " + error.message
      tips = "发生错误，请检查日志获取详细信息。"
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
      await pr.resetVisited()
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
      await pr.resetVisited(filterCondition)
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

  // 新增：已访问文档列表弹窗相关
  async function openVisitedDocs() {
    showVisitedDialog = true
    visitedLoading = true
    if (!pr) {
      pr = new IncrementalReviewer(storeConfig, pluginInstance)
      await pr.initIncrementalConfig()
    }
    // 获取已访问文档及其上次漫游时间
    const docs = await pr.getVisitedDocs()
    // 并发获取每个文档的上次漫游时间
    visitedDocs = await Promise.all(docs.map(async doc => {
      const lastTime = await pr.getRoamingLastTime(doc.id)
      return { ...doc, lastTime }
    }))
    // 按lastTime从新到旧排序
    visitedDocs.sort((a, b) => {
      if (!a.lastTime && !b.lastTime) return 0
      if (!a.lastTime) return 1
      if (!b.lastTime) return -1
      return b.lastTime.localeCompare(a.lastTime)
    })
    visitedLoading = false
  }

  function closeVisitedDialog() {
    showVisitedDialog = false
  }

  async function resetVisitedAndRefresh() {
    await resetAllVisitCounts()
    // 刷新已访问文档列表
    if (showVisitedDialog) {
      await openVisitedDocs()
    }
  }

  // 新增：用于弹窗中点击文档标题打开文档
  function openDoc(docId: string) {
    openTab({
      app: pluginInstance.app,
      doc: { id: docId }
    })
  }

  // 新增：格式化文档ID为日期（如需更复杂格式可后续完善）
  function formatDocIdToDate(docId: string): string {
    // 这里简单返回 docId，可根据实际需求格式化
    return docId
  }

  // 新增：格式化ISO时间为年月日时分
  function formatRoamingTime(isoTime?: string): string {
    if (!isoTime) return ''
    const date = new Date(isoTime)
    if (isNaN(date.getTime())) return ''
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${date.getFullYear()}年${pad(date.getMonth()+1)}月${pad(date.getDate())}日${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  // 打开优先级排序弹窗
  async function openPriorityDialog() {
    showPriorityDialog = true
    priorityLoading = true
    priorityList = []
    
    try {
      // 初始化审阅器
      if (!pr) {
        pr = new IncrementalReviewer(storeConfig, pluginInstance)
        await pr.initIncrementalConfig()
      }
      // 获取所有文档ID
      const total = await pr.getTotalDocCount(storeConfig)
      if (total === 0) {
        priorityList = []
        priorityLoading = false
        return
      }
      // 复用pr内部分页SQL逻辑，手动获取所有文档ID
      const filterCondition = pr.buildFilterCondition(storeConfig)
      const pageSize = 50
      let allDocs: Array<{id: string}> = []
      for (let offset = 0; offset < total; offset += pageSize) {
        const sql = `SELECT id FROM blocks WHERE type = 'd' ${filterCondition} LIMIT ${pageSize} OFFSET ${offset}`
        const res = await pluginInstance.kernelApi.sql(sql)
        if (res.code !== 0) break
        allDocs = allDocs.concat(res.data as any[])
        if (!Array.isArray(res.data) || res.data.length === 0) break
      }
      // 获取已访问文档ID集合
      const visitedDocs = await pr.getVisitedDocs()
      const visitedSet = new Set(visitedDocs.map(d => d.id))
      // 批量获取文档优先级属性
      const docIds = allDocs.map(doc => doc.id)
      const docPriorities = await pr.batchGetDocumentPriorities(docIds)
      
      // 并发获取标题
      const batchSize = 3000
      let tempList: Array<{id: string, title: string, priority: number, visited: boolean}> = []
      for (let i = 0; i < allDocs.length; i += batchSize) {
        const batch = allDocs.slice(i, i + batchSize)
        const batchResults = await Promise.all(batch.map(async doc => {
          try {
            // 从批量查询结果中获取优先级
            const priorityInfo = docPriorities.find(p => p.docId === doc.id)
            const priority = priorityInfo ? priorityInfo.priority : 5.0
            
            // 获取标题
            const block = await pluginInstance.kernelApi.getBlockByID(doc.id)
            return {
              id: doc.id,
              title: block?.content || '(无标题)',
              priority: priority,
              visited: visitedSet.has(doc.id)
            }
          } catch {
            return {
              id: doc.id,
              title: '(无标题)',
              priority: 5.0,
              visited: visitedSet.has(doc.id)
            }
          }
        }))
        tempList.push(...batchResults)
      }
      // 按优先级降序
      tempList.sort((a, b) => b.priority - a.priority)
      
      // 设置排序后的列表
      priorityList = tempList
    } finally {
      priorityLoading = false
    }
  }
  function closePriorityDialog() {
    showPriorityDialog = false
  }

  // 移动端指标弹窗相关函数
  function openMobileMetricsDialog() {
    showMobileMetricsDialog = true
  }

  function closeMobileMetricsDialog() {
    showMobileMetricsDialog = false
  }

  // 处理tips显示的函数
  function setTips(fullTipsContent: string) {
    fullTips = fullTipsContent
    if (pluginInstance.isMobile) {
      // 移动端：移除诗意部分，只保留核心信息
      tips = fullTipsContent.replace(/展卷乃无言的情意：/, '').replace(/，穿越星辰遇见你，三秋霜雪印马蹄。/, '')
    } else {
      // 桌面端：显示完整内容
      tips = fullTipsContent
    }
  }

  // 热力色条：优先级归一化，红-高，蓝-低
  function getHeatColor(priority: number, min: number, max: number) {
    if (max === min) return 'rgb(128,128,255)';
    const t = (priority - min) / (max - min)
    // t=1红，t=0蓝
    const r = Math.round(255 * t)
    const g = 64
    const b = Math.round(255 * (1 - t))
    return `rgb(${r},${g},${b})`
  }
  // 优先级排序弹窗渲染辅助变量
  $: priorityMin = (priorityList as any[]).length > 0 ? Math.min(...(priorityList as any[]).map(d => d.priority)) : 0;
  $: priorityMax = (priorityList as any[]).length > 0 ? Math.max(...(priorityList as any[]).map(d => d.priority)) : 1;

  // 刷新优先级分布点图数据
  async function refreshPriorityBarPoints() {
    if (!pr) return;
    
    // 保存当前文档的优先级（如果存在），以便在刷新后能够恢复
    currentDocPriority = priorityBarPoints.find(p => p.id === currentRndId)?.priority;
    
    try {
      // 使用新的getPriorityList方法获取所有文档的优先级
      const latestPriorityList = await pr.getPriorityList();
      
      // 如果存在currentRndId但列表中不存在，则可能是新文档，需要添加到列表中
      if (currentRndId && !latestPriorityList.some(p => p.id === currentRndId)) {
        const currentDoc = await pr.getDocInfo(currentRndId);
        if (currentDoc) {
          latestPriorityList.push({
            id: currentDoc.id,
            title: currentDoc.title,
            priority: 5.0 // 默认优先级
          });
        }
      }
      
      // 如果正在拖动，保持当前拖动的优先级
      if (draggingPriorityId && draggingPriority !== null) {
        const index = latestPriorityList.findIndex(p => p.id === draggingPriorityId);
        if (index >= 0) {
          latestPriorityList[index].priority = draggingPriority;
        }
      } 
      // 如果当前文档存在但没有拖动，保持之前的优先级，避免刷新时红点抖动
      else if (currentRndId && currentDocPriority !== undefined) {
        const index = latestPriorityList.findIndex(p => p.id === currentRndId);
        // 当前文档优先级可能已经在数据库中更新，所以只有当差异很小时才使用之前的优先级
        if (index >= 0 && Math.abs(latestPriorityList[index].priority - currentDocPriority) < 0.01) {
          latestPriorityList[index].priority = currentDocPriority;
        }
      }
      
      // 更新点图数据
      priorityBarPoints = latestPriorityList;
      
      // 始终将拖动范围设置为完整的0-10，不受现有文档优先级范围限制
      priorityBarMin = 0;
      priorityBarMax = 10;
    } catch (err) {
      pluginInstance.logger.error("刷新优先级点图失败", err);
    }
  }

  // 拖动优先级点时的回调
  let draggingPriority = null;
  let draggingPriorityId = null;
  function handlePriorityBarDragging(e) {
    draggingPriority = e.detail.priority;
    draggingPriorityId = e.detail.id;
  }

  async function handlePriorityBarChange(e) {
    const newPriority = e.detail.priority;
    const docId = e.detail.id;
    
    if (!docId || !pr) return;
    
    // 保存更新前的优先级数据，用于恢复（如果更新失败）
    const originalPriority = priorityBarPoints.find(p => p.id === docId)?.priority;
    
    try {
      // 立即更新UI上点的位置，确保拖动后无延迟
      const pointIndex = priorityBarPoints.findIndex(p => p.id === docId);
      if (pointIndex >= 0) {
        priorityBarPoints[pointIndex].priority = newPriority;
        // 创建新数组触发Svelte更新
        priorityBarPoints = [...priorityBarPoints];
      }
      
      // 后台异步更新数据库
      // 获取当前文档的优先级数据
      const docPriorityData = await pr.getDocPriorityData(docId);
      const metrics = pr.getMetrics();
      const currentPriority = await pr["calculatePriority"](docPriorityData);
      
      // 使用与MetricsPanel相同的等比例调整逻辑
      if (currentPriority.priority === 0) {
        // 全部设为新优先级/权重和
        let totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0);
        for (const metric of metrics) {
          const v = totalWeight > 0 ? newPriority * (metric.weight / totalWeight) : newPriority;
          await pr.updateDocMetric(docId, metric.id, v);
        }
      } else {
        // 等比例调整所有指标
        const ratio = newPriority / currentPriority.priority;
        for (const metric of metrics) {
          const oldVal = docPriorityData.metrics[metric.id] || 0;
          let v = oldVal * ratio;
          v = Math.max(0, Math.min(10, v));
          await pr.updateDocMetric(docId, metric.id, v);
        }
      }
      
      // 同时更新文档的priority属性
      if (typeof pr.updateDocPriority === 'function') {
        await pr.updateDocPriority(docId, newPriority);
      }
      
      // 如果更新的是当前文档，立即刷新当前文档优先级数据，同步到 MetricsPanel
      if (docId === currentRndId && typeof pr.getDocPriorityData === 'function') {
        const updatedData = await pr.getDocPriorityData(currentRndId);
        docPriority = updatedData.metrics;
      }
      
      // 后台刷新完整点图数据，但不影响用户体验
      setTimeout(() => {
        refreshPriorityBarPoints();
      }, 500);
    } catch (err) {
      pluginInstance.logger.error("设置优先级失败", err);
      showMessage("设置优先级失败: " + err.message, 3000, "error");
      
      // 恢复UI到拖动前的状态（如果保存了原始状态）
      const pointIndex = priorityBarPoints.findIndex(p => p.id === docId);
      if (pointIndex >= 0 && originalPriority !== undefined) {
        priorityBarPoints[pointIndex].priority = originalPriority;
        // 创建新数组触发Svelte更新
        priorityBarPoints = [...priorityBarPoints];
      }
    }
    draggingPriority = null;
    draggingPriorityId = null;
  }

  // 处理点击点图上的点打开文档
  async function handleOpenDocument(e) {
    const docId = e.detail.id;
    if (!docId) return;
    
    try {
      // 使用新标签页打开文档
      await openTab({
        app: pluginInstance.app,
        doc: {
          id: docId,
        },
      });
    } catch (err) {
      pluginInstance.logger.error("打开文档失败", err);
      showMessage("打开文档失败: " + err.message, 3000, "error");
    }
  }

  // 监听 MetricsPanel 的优先级变化事件
  async function handleMetricsPanelPriorityChange(e) {
    // 获取当前优先级
    const newPriority = e.detail.priority;
    
    // 立即更新当前文档在点图中的位置
    const updatedPointIndex = priorityBarPoints.findIndex(p => p.id === currentRndId);
    if (updatedPointIndex >= 0) {
      priorityBarPoints[updatedPointIndex].priority = newPriority;
      // 创建新数组触发Svelte更新
      priorityBarPoints = [...priorityBarPoints];
    }
    
    // 全量刷新点图数据（异步操作，确保数据完整性）
    await refreshPriorityBarPoints();
  }

  // events
  const clearDoc = () => {
    currentRndId = undefined
    content = ""
    tips = "条件已改变，请重新漫游！待从头，收拾旧山河，朝天阙！"
  }

  const onNotebookChange = async function () {
    // 笔记本选择切换
    storeConfig.notebookId = selectedNotebooks.join(',') // 使用逗号分隔的ID字符串
    await pluginInstance.saveData(storeName, storeConfig)
    
    // 重置文档
    clearDoc()
    
    // 如果当前是渐进模式，需要重新初始化reviewer以更新笔记本过滤条件
    if (storeConfig.reviewMode === "incremental") {
      pluginInstance.logger.info("笔记本变更后重新初始化渐进模式...")
      pr = new IncrementalReviewer(storeConfig, pluginInstance)
      await pr.initIncrementalConfig()
      
      // 自动开始新的漫游，避免用户手动点击
      await doIncrementalRandomDoc()
    }
    
    pluginInstance.logger.info("storeConfig saved notebookIds =>", selectedNotebooks)
  }

  const onSqlChange = async function () {
    // 显示当前选择的名称
    storeConfig.currentSql = currentSql
    await pluginInstance.saveData(storeName, storeConfig)
    // 重置文档
    clearDoc()
    pluginInstance.logger.info("storeConfig saved currentSql =>", storeConfig)
  }

  const onFilterModeChange = async function () {
    // 模式切换
    storeConfig.filterMode = filterMode
    await pluginInstance.saveData(storeName, storeConfig)
    
    // 重置文档
    clearDoc()
    
    // 🎯 关键修复：如果切换到标签模式，自动加载可用标签
    if (filterMode === FilterMode.Tag) {
      try {
        await loadAvailableTags()
      } catch (error) {
        console.error("❌ 自动加载标签失败:", error)
      }
    }
    
    // 如果当前是渐进模式，需要重新初始化reviewer以更新筛选条件
    if (storeConfig.reviewMode === "incremental") {
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
    if (storeConfig.reviewMode === "incremental") {
      pluginInstance.logger.info("根文档ID变更后重新初始化渐进模式...")
      pr = new IncrementalReviewer(storeConfig, pluginInstance)
      await pr.initIncrementalConfig()
      
      // 自动开始新的漫游，避免用户手动点击
      await doIncrementalRandomDoc()
    }
    
    pluginInstance.logger.info("storeConfig saved rootId =>", storeConfig)
  }

  const onTagsChange = async function () {
    console.log("🔄 onTagsChange 被调用")
    console.log("📋 当前 selectedTags:", selectedTags)
    console.log("🏷️ selectedTags 类型:", typeof selectedTags)
    console.log("📊 Array.isArray(selectedTags):", Array.isArray(selectedTags))

    // 保存标签配置
    storeConfig.tags = selectedTags
    console.log("💾 保存到 storeConfig.tags:", storeConfig.tags)
    await pluginInstance.saveData(storeName, storeConfig)
    
    // 重置文档
    clearDoc()
    
    // 如果当前是渐进模式，需要重新初始化reviewer以更新标签筛选条件
    if (storeConfig.reviewMode === "incremental") {
      console.log("🔄 标签变更后重新初始化渐进模式...")
      pluginInstance.logger.info("标签变更后重新初始化渐进模式...")
      pr = new IncrementalReviewer(storeConfig, pluginInstance)
      await pr.initIncrementalConfig()
      
      // 自动开始新的漫游，避免用户手动点击
      await doIncrementalRandomDoc()
    }
    
    pluginInstance.logger.info("storeConfig saved tags =>", storeConfig)
  }

  // 根文档选择器相关方法
  
  // 开始文档选择流程 - 显示笔记本列表
  const startDocumentSelection = async function () {
    if (isDocsLoading) return
    
    showDocSelector = true
    currentLevel = "notebooks"
    selectedNotebookForDoc = null
    rootDocsList = []
    childDocsList = []
    docNavigationStack = []
  }

  // 选择笔记本，加载其下的根文档
  const selectNotebookForDoc = async function (notebook: any) {
    if (isDocsLoading) return
    
    isDocsLoading = true
    selectedNotebookForDoc = notebook
    currentLevel = "docs"
    childDocsList = []
    docNavigationStack = [] // 重置导航栈
    
    try {
      const result = await pluginInstance.kernelApi.getRootDocs(notebook.id)
      
      if (result.code !== 0) {
        pluginInstance.logger.error(`获取文档列表失败，错误码: ${result.code}, 错误信息: ${result.msg}`)
        rootDocsList = []
        return
      }

      const actualData = result.data || []
      rootDocsList = (actualData as any[]).map(doc => ({
        id: doc.id,
        title: doc.title || '(无标题)'
      }))
      
      pluginInstance.logger.info(`获取到 ${rootDocsList.length} 个根文档`)
    } catch (error) {
      pluginInstance.logger.error("获取根文档列表失败", error)
      rootDocsList = []
    } finally {
      isDocsLoading = false
    }
  }

  // 返回笔记本选择
  const backToNotebookSelection = function () {
    currentLevel = "notebooks"
    selectedNotebookForDoc = null
    rootDocsList = []
    childDocsList = []
    docNavigationStack = []
  }

  // 深入文档 - 查看子文档
  const exploreDocument = async function (docId: string, docTitle: string) {
    if (isDocsLoading) return
    
    isDocsLoading = true
    
    // 将当前状态压入导航栈
    docNavigationStack.push({
      level: currentLevel,
      data: currentLevel === "docs" ? [...rootDocsList] : [...childDocsList],
      parentInfo: { id: docId, title: docTitle }
    })
    
    currentLevel = "childDocs"
    
    try {
      const result = await pluginInstance.kernelApi.getChildDocs(docId, selectedNotebookForDoc.id)
      
      if (result.code !== 0) {
        pluginInstance.logger.error(`获取子文档列表失败，错误码: ${result.code}, 错误信息: ${result.msg}`)
        childDocsList = []
        return
      }

      const actualData = result.data || []
      childDocsList = (actualData as any[]).map(doc => ({
        id: doc.id,
        title: doc.title || '(无标题)'
      }))
      
      pluginInstance.logger.info(`获取到 ${childDocsList.length} 个子文档`)
    } catch (error) {
      pluginInstance.logger.error("获取子文档列表失败", error)
      childDocsList = []
    } finally {
      isDocsLoading = false
    }
  }

  // 返回上一级
  const backToPreviousLevel = function () {
    if (docNavigationStack.length > 0) {
      const previousState = docNavigationStack.pop()
      currentLevel = previousState.level
      
      if (currentLevel === "docs") {
        rootDocsList = previousState.data
        childDocsList = []
      } else if (currentLevel === "childDocs") {
        childDocsList = previousState.data
      }
    } else {
      // 如果没有导航历史，回到根文档列表
      currentLevel = "docs"
      childDocsList = []
    }
  }

  // 选择文档
  const selectDocument = async function (docId: string, docTitle: string) {
    rootId = docId
    selectedDocTitle = docTitle
    showDocSelector = false
    
    // 保存配置
    storeConfig.rootId = rootId
    if (selectedDocTitle) {
      storeConfig.rootDocTitle = selectedDocTitle
    }
    await pluginInstance.saveData(storeName, storeConfig)
    
    pluginInstance.logger.info(`已设置根文档为: ${docId} - ${docTitle}`)
  }

  // 响应式计算当前选中文档的标题
  $: currentDocTitle = (() => {
    if (!rootId) {
      return "请选择文档"
    }
    
    // 优先显示已缓存的文档标题
    if (selectedDocTitle) {
      return selectedDocTitle
    }
    
    // 其次尝试从文档列表中查找
    const doc = rootDocsList.find(d => d.id === rootId)
    if (doc && doc.title) {
      return doc.title
    }
    
    // 如果都没有标题，显示ID片段作为临时占位符
    return rootId.substring(0, 8) + "..."
  })()

  // 切换到手动输入模式
  const switchToManualInput = function () {
    showManualInput = true
    showDocSelector = false
    manualInputId = rootId || ""
  }

  // 处理手动输入ID的确认
  const confirmManualInput = async function () {
    if (!manualInputId || manualInputId.trim() === "") {
      showMessage("请输入有效的文档ID", 3000, "error")
      return
    }
    
    const trimmedId = manualInputId.trim()
    
    try {
      // 尝试获取文档标题进行验证
      const title = await pluginInstance.kernelApi.getDocTitle(trimmedId)
      
      if (title) {
        // 文档存在，设置为根文档
        await selectDocument(trimmedId, title)
        showManualInput = false
        showMessage(`已设置根文档: ${title}`, 2000, "info")
      } else {
        // 文档不存在或无标题，询问用户是否仍要使用
        const confirmed = confirm(`无法找到文档标题，文档ID可能无效。是否仍要使用 "${trimmedId}" 作为根文档？`)
        if (confirmed) {
          await selectDocument(trimmedId, "")
          showManualInput = false
          showMessage(`已设置根文档ID: ${trimmedId}`, 2000, "info")
        }
      }
    } catch (error) {
      pluginInstance.logger.error("验证文档ID失败:", error)
      const confirmed = confirm(`验证文档ID时出错。是否仍要使用 "${trimmedId}" 作为根文档？`)
      if (confirmed) {
        await selectDocument(trimmedId, "")
        showManualInput = false
        showMessage(`已设置根文档ID: ${trimmedId}`, 2000, "info")
      }
    }
  }

  // 取消手动输入
  const cancelManualInput = function () {
    showManualInput = false
    manualInputId = ""
  }

  const openDocEditor = async () => {
    await openTab({
      app: pluginInstance.app,
      doc: {
        id: currentRndId,
      },
    })
  }

  // 处理内容区域点击事件
  const handleContentClick = async (event: MouseEvent | KeyboardEvent) => {
    // 如果点击的是按钮或其他交互元素，不处理
    const target = event.target as HTMLElement
    if (target.closest('button') || target.closest('.action-btn-group') || target.closest('.metrics-panel')) {
      return
    }
    
    // 如果有当前文档ID，打开可编辑的文档标签页
    if (currentRndId) {
      await openDocEditor()
    }
  }

  const openHelpDoc = () => {
    window.open("https://github.com/ebAobS/roaming-mode-incremental-reading/blob/main/README_zh_CN.md")
  }

  // 切换笔记本选择
  function toggleNotebook(notebookId) {
    if (selectedNotebooks.includes(notebookId)) {
      selectedNotebooks = selectedNotebooks.filter(id => id !== notebookId)
    } else {
      selectedNotebooks = [...selectedNotebooks, notebookId]
    }
    // 不再自动触发保存，等待用户点击确定
  }

  // 移除默认全选的响应式逻辑，改为在初始化时处理

  // 根据笔记本ID获取笔记本名称
  function getNotebookName(notebookId) {
    const notebook = notebooks.find(n => n.id === notebookId)
    return notebook ? notebook.name : '未知笔记本'
  }

  // 获取所有可用标签
  const loadAvailableTags = async function () {
    if (isTagsLoading) return

    isTagsLoading = true
    try {
      if (!pr) {
        pr = new IncrementalReviewer(storeConfig, pluginInstance)
        await pr.initIncrementalConfig()
      }
      availableTags = await pr.getAllAvailableTags()
      pluginInstance.logger.info("成功加载标签列表", availableTags)
    } catch (error) {
      pluginInstance.logger.error("加载可用标签失败:", error)
      availableTags = []
    } finally {
      isTagsLoading = false
    }
  }

  // 切换标签选择
  const toggleTag = function (tag: string) {
    console.log("🏷️ toggleTag被调用 - 标签:", tag)
    console.log("📋 点击前selectedTags:", selectedTags)
    const index = selectedTags.indexOf(tag)
    console.log("🔍 标签在数组中的索引:", index)

    if (index > -1) {
      selectedTags = selectedTags.filter(t => t !== tag)
      console.log("❌ 移除标签后:", selectedTags)
    } else {
      selectedTags = [...selectedTags, tag]
      console.log("✅ 添加标签后:", selectedTags)
    }
    console.log("📊 最终selectedTags数量:", selectedTags.length)
  }

  // 关闭标签下拉框
  const closeTagDropdown = function () {
    showTagDropdown = false
  }

  // 确定标签选择
  const confirmTagSelection = function () {
    // 触发标签变更保存
    onTagsChange()
    closeTagDropdown()
  }

  // 全部取消标签选择
  const clearAllTags = function () {
    selectedTags = []
    closeTagDropdown()
    onTagsChange()
  }

  // 导出函数，让外部可以调用
  export const resetAndRefresh = async () => {
    try {
      await resetAllVisitCounts()
      
      // 重置后立即重新漫游
      if (storeConfig.reviewMode === "incremental") {
        await doIncrementalRandomDoc()
      } else {
        // 如果当前不是渐进模式，则不进行任何操作，因为doIncrementalRandomDoc是唯一漫游方法
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
  
  // 防抖保存函数
  const debouncedSave = (content: string) => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(async () => {
      await saveContent(content);
    }, 1000); // 1秒后保存
  };

  // HTML转Markdown的简单转换函数
  const htmlToMarkdown = (html: string): string => {
    if (!html) return "";
    
    let markdown = html;
    
    // 移除所有HTML标签，保留文本内容
    markdown = markdown.replace(/<[^>]*>/g, '');
    
    // 处理换行
    markdown = markdown.replace(/\n/g, '\n\n');
    
    // 处理特殊字符
    markdown = markdown.replace(/&nbsp;/g, ' ');
    markdown = markdown.replace(/&lt;/g, '<');
    markdown = markdown.replace(/&gt;/g, '>');
    markdown = markdown.replace(/&amp;/g, '&');
    markdown = markdown.replace(/&quot;/g, '"');
    
    return markdown.trim();
  };

  // Markdown转HTML的简单转换函数
  const markdownToHtml = (markdown: string): string => {
    if (!markdown) return "";
    
    let html = markdown;
    
    // 处理换行
    html = html.replace(/\n\n/g, '<br><br>');
    html = html.replace(/\n/g, '<br>');
    
    // 处理特殊字符
    html = html.replace(/&/g, '&amp;');
    html = html.replace(/</g, '&lt;');
    html = html.replace(/>/g, '&gt;');
    html = html.replace(/"/g, '&quot;');
    
    return html;
  };

  // 保存内容到源文档
  const saveContent = async (content: string) => {
    if (!currentRndId) return;
    
    try {
      // 使用思源API更新文档内容，使用DOM格式
      const result = await pluginInstance.kernelApi.updateBlock(currentRndId, content, "dom");
      
      if (result && result.code === 0) {
        pluginInstance.logger.info("内容已保存到源文档");
      } else {
        pluginInstance.logger.error("保存失败:", result?.msg);
      }
    } catch (error) {
      pluginInstance.logger.error("保存内容时出错:", error);
    }
  };

  // 处理内容编辑
  const handleContentEdit = (event: Event) => {
    const target = event.target as HTMLElement;
    editableContent = target.innerHTML;
    debouncedSave(editableContent);
  };

  // 初始化可编辑内容
const initEditableContent = async () => {
  if (!currentRndId) return;
  
  try {
    // 获取文档内容
    const docResult = await pluginInstance.kernelApi.getDoc(currentRndId);
    if (docResult && docResult.code === 0) {
      const doc = docResult.data as any;
      editableContent = doc.content || "";
    }
  } catch (error) {
    pluginInstance.logger.error("获取文档内容失败:", error);
    editableContent = content; // 回退到原有内容
  }
};

  // 刷新编辑区内容 - 用于实时同步源文档变化
  const refreshEditableContent = async () => {
    if (!currentRndId) return;
    
    try {
      // 重新获取最新的文档内容
      const docResult = await pluginInstance.kernelApi.getDoc(currentRndId);
      if (docResult && docResult.code === 0) {
        const doc = docResult.data as any;
        const newContent = doc.content || "";
        
        // 只有在内容确实发生变化时才更新，避免不必要的重新渲染
        if (newContent !== editableContent) {
          editableContent = newContent;
          pluginInstance.logger.info("编辑区内容已刷新，与源文档同步");
        }
      }
    } catch (error) {
      pluginInstance.logger.error("刷新编辑区内容失败:", error);
    }
  };

  // 当文档ID变化时初始化可编辑内容
  $: if (currentRndId) {
    initEditableContent();
  }

  // 在漫游、切换文档、初始化等时刷新点图
  $: if (pr && currentRndId) {
    refreshPriorityBarPoints()
  }

  onDestroy(() => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
  });

  // lifecycle
  onMount(async () => {
    // 读取配置
    storeConfig = await pluginInstance.safeLoad(storeName)

    // 根据配置设置默认锁定状态
    if (storeConfig?.defaultLocked) {
      setLocked(true)
    }

    // 读取笔记本
    const res = await pluginInstance.kernelApi.lsNotebooks()
    notebooks = (res?.data as any)?.notebooks ?? []
    // 用户指南不应该作为可以写入的笔记本
    const hiddenNotebook: Set<string> = new Set(["思源笔记用户指南", "SiYuan User Guide"])
    // 没有必要把所有笔记本都列出来
    notebooks = notebooks.filter((notebook) => !notebook.closed && !hiddenNotebook.has(notebook.name))
    
    // 从配置中恢复选中的笔记本
    if (storeConfig?.notebookId) {
      // 如果配置中有保存的笔记本ID，则恢复选择
      selectedNotebooks = storeConfig.notebookId.split(',').filter(id => id.trim() !== '')
    }
    // 如果没有保存的配置或配置为空，则默认全选（仅在首次使用时）
    if (selectedNotebooks.length === 0 && notebooks.length > 0) {
      selectedNotebooks = notebooks.map(notebook => notebook.id)
      // 保存默认全选状态到配置
      storeConfig.notebookId = selectedNotebooks.join(',')
      await pluginInstance.saveData(storeName, storeConfig)
    }

    // 处理标签数据，确保数组格式正确
    if (storeConfig?.tags) {
      if (Array.isArray(storeConfig.tags)) {
        selectedTags = [...storeConfig.tags]
      } else if (typeof storeConfig.tags === 'string') {
        // 兼容处理：将字符串格式的tags转换为数组格式
        selectedTags = (storeConfig.tags as string).split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
        // 更新配置格式
        storeConfig.tags = selectedTags
        await pluginInstance.saveData(storeName, storeConfig)
      } else {
        selectedTags = []
      }
    } else {
      selectedTags = []
    }
    
    // 选中，若是没保存，获取第一个
    toNotebookId = storeConfig?.notebookId ?? notebooks[0].id

    // 筛选模式
    if (!storeConfig?.filterMode) {
      storeConfig.filterMode = FilterMode.Notebook
    }
    filterMode = storeConfig.filterMode
    rootId = storeConfig?.rootId ?? ""
    selectedDocTitle = storeConfig?.rootDocTitle ?? ""

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
    if (storeConfig.reviewMode === "incremental") {
      pr = new IncrementalReviewer(storeConfig, pluginInstance)
      await pr.initIncrementalConfig()
      // 检查是否需要启动时自动重置
      if (storeConfig?.autoResetOnStartup) {
        try {
          pluginInstance.logger.info("检测到启动时自动重置设置，开始重置已访问文档记录...")
          const filterCondition = pr.buildFilterCondition(storeConfig)
          await pr.resetVisited(filterCondition)
          showMessage("启动时自动重置已访问文档记录完成", 3000)
        } catch (error) {
          pluginInstance.logger.error("启动时自动重置失败:", error)
          showMessage("启动时自动重置失败: " + error.message, 5000, "error")
        }
      }
    }

    // 检查是否已经有内容，如果有则不自动开始漫游
    // 避免在标签页激活时覆盖已有的文档内容
    if (!currentRndId && !content) {
      // 开始漫游
      await doIncrementalRandomDoc()
    }
  })
</script>

<div class="fn__flex-1 protyle" data-loading="finished">
  <!-- 移除Loading组件 -->
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
      style="padding: 16px 96px 281.5px;"
      data-doc-type="NodeDocument"
    >
      <div class="action-btn-group">
        <span class="filter-label">筛选:</span>
        <select
          bind:value={filterMode}
          class="action-item b3-select fn__flex-center fn__size100"
          on:change={onFilterModeChange}
        >
          <option value={FilterMode.Notebook}>笔记本</option>
          <option value={FilterMode.Root}>根文档</option>
          <option value={FilterMode.Tag}>标签</option>
        </select>
        {#if filterMode === FilterMode.Notebook}
          <div class="notebook-selector">
            <button
              class="action-item b3-select fn__flex-center fn__size150"
              on:click={() => showNotebookSelector = !showNotebookSelector}
            >
              {#if selectedNotebooks.length === 0}
                笔记本：请选择
              {:else if selectedNotebooks.length === 1}
                {getNotebookName(selectedNotebooks[0])}
              {:else}
                已选{selectedNotebooks.length}个笔记本
              {/if}
            </button>
            {#if showNotebookSelector}
              <div class="notebook-list">
                {#each notebooks as notebook (notebook.id)}
                  <label class="notebook-item">
                    <input
                      type="checkbox"
                      checked={selectedNotebooks.includes(notebook.id)}
                      on:change={() => toggleNotebook(notebook.id)}
                    />
                    {notebook.name}
                  </label>
                {/each}
                <div class="confirm-button-container">
                  <button
                    class="b3-button b3-button--outline fn__size150"
                    on:click={() => {
                      showNotebookSelector = false;
                      onNotebookChange();
                    }}
                  >
                    确定
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {:else if filterMode === FilterMode.Root}
          <!-- 根文档选择器 -->
          <button
            class="action-item b3-select fn__flex-center fn__size150"
            on:click={startDocumentSelection}
          >
            {currentDocTitle}
          </button>
        {:else if filterMode === FilterMode.Tag}
          <!-- 标签选择器 -->
          <div class="tag-selector">
            <button
              class="action-item b3-select fn__flex-center fn__size150"
              on:click={loadAvailableTags}
              on:click={() => showTagDropdown = !showTagDropdown}
            >
              {#if selectedTags.length === 0}
                请选择标签
              {:else if selectedTags.length === 1}
                {selectedTags[0]}
              {:else}
                已选{selectedTags.length}个标签
              {/if}
            </button>
            {#if showTagDropdown && !isTagsLoading}
              <div class="tag-list">
                {#if availableTags.length > 0}
                  {#each availableTags as tag}
                    <label class="tag-item">
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag)}
                        on:change={() => toggleTag(tag)}
                      />
                      #{tag}
                    </label>
                  {/each}
                {:else}
                  <div class="tag-empty">没有找到标签</div>
                {/if}
                <div class="confirm-button-container">
                  <button
                    class="b3-button b3-button--outline fn__size150"
                    on:click={clearAllTags}
                  >
                    清空所有
                  </button>
                  <button
                    class="b3-button b3-button--outline fn__size150"
                    on:click={confirmTagSelection}
                  >
                    确定
                  </button>
                </div>
              </div>
            {/if}
            {#if isTagsLoading}
              <div class="tag-loading">加载中...</div>
            {/if}
          </div>
        {/if}
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
          <button class="action-item b3-button primary-btn btn-small" on:click={doIncrementalRandomDoc}>
            {#if isLoading}
              <span class="button-loading-icon"></span> 漫游中...
            {:else}
              继续漫游
            {/if}
          </button>
          <!-- 桌面端显示打开文档按钮 -->
          {#if !pluginInstance.isMobile}
            <button class="action-item b3-button primary-btn btn-small" on:click={openDocEditor}>打开该文档</button>
          {/if}
          <!-- 移动端显示查看指标按钮 -->
          {#if pluginInstance.isMobile}
            <button class="action-item b3-button b3-button--outline btn-small" on:click={openMobileMetricsDialog} title="查看文档指标和统计信息">
              查看指标
            </button>
          {/if}
          <button class="action-item b3-button b3-button--outline btn-small reset-button" on:click={openVisitedDocs} title="查看已漫游文档列表">
            已漫游文档
          </button>
          <button class="action-item b3-button b3-button--outline btn-small" on:click={openPriorityDialog} title="优先级排序列表">
            优先级排序表
          </button>
          <button
            class="action-item b3-button b3-button--outline btn-small light-btn help-icon"
            on:click={() => showSettingMenu(pluginInstance)}
            title={pluginInstance.i18n.setting}
          >
            {@html icons.iconSetting}
          </button>
        {/if}
      </div>

      <!-- 已访问文档弹窗 -->
      {#if showVisitedDialog}
        <div class="visited-dialog-mask" on:click={closeVisitedDialog}></div>
        <div class="visited-dialog">
          <div class="visited-dialog-header">
            <span>已漫游文档列表</span>
            <button class="close-btn" on:click={closeVisitedDialog}>×</button>
          </div>
          <!-- 移动重置按钮到列表上方 -->
          <button class="action-item b3-button b3-button--outline btn-small reset-button" on:click={resetVisitedAndRefresh} title="清空已漫游的文档记录">
            重置已漫游
          </button>
          <div class="visited-list">
            {#if visitedLoading}
              <div>加载中...</div>
            {:else if visitedDocs.length === 0}
              <div>暂无已漫游文档</div>
            {:else}
              <ul>
                {#each visitedDocs as doc}
                  <li>
                    <span class="visited-title" title={doc.id} on:click={() => openDoc(doc.id)}>{doc.content || '(无标题)'}</span>
                    <small style="color:#888">{formatRoamingTime(doc.lastTime)}</small>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>
      {/if}

      {#if showPriorityDialog}
        <div class="visited-dialog-mask" on:click={closePriorityDialog}></div>
        <div class="visited-dialog">
          <div class="visited-dialog-header">
            <span>优先级排序列表</span>
            <button class="close-btn" on:click={closePriorityDialog}>×</button>
          </div>
          <div class="visited-list">
            {#if priorityLoading}
              <div>加载中...</div>
            {:else if priorityList.length === 0}
              <div>暂无文档</div>
            {:else}
              <ul class="priority-sortable-list">
                {#each priorityList as doc, index (doc.id)}
                  {@const isDragging = draggedItem?.id === doc.id}
                  {@const isDragOver = dragOverIndex === index}
                  <li 
                    class="priority-sortable-item"
                    class:dragging={isDragging}
                    class:drag-over={isDragOver}
                    draggable="true"
                    on:dragstart={(e) => handleDragStart(e, doc, index)}
                    on:dragover={(e) => handleDragOver(e, index)}
                    on:dragenter={(e) => handleDragEnter(e, index)}
                    on:dragleave={handleDragLeave}
                    on:drop={(e) => handleDrop(e, index)}
                    style="align-items:center;display:flex;gap:8px;padding:8px 0;cursor:grab;border:1px solid transparent;border-radius:4px;transition:all 0.2s;"
                  >
                    <!-- 拖动指示器 -->
                    <span class="drag-handle" style="cursor:grab;color:#999;font-size:16px;margin-right:4px;">⋮⋮</span>
                    
                    <span style="display:inline-block;width:8px;height:24px;border-radius:4px;background:{getHeatColor(doc.priority, priorityMin, priorityMax)}"></span>
                    <span class="visited-title" title={doc.id} on:click={() => openDoc(doc.id)} style="flex:1;">{doc.title}</span>
                    
                    <!-- 优先级调整控件 -->
                    <div class="priority-edit-group" style="display:flex;align-items:center;gap:4px;margin-left:8px;">
                      <button 
                        class="priority-btn" 
                        on:click={() => decreasePriorityInList(doc.id)}
                        style="width:24px;height:24px;border-radius:3px;border:1px solid var(--b3-theme-primary);background-color:var(--b3-theme-background);cursor:pointer;font-size:14px;line-height:1;padding:0;color:var(--b3-theme-primary);font-weight:bold;"
                      >-</button>
                      <input 
                        type="number" 
                        min="0" 
                        max="10" 
                        step="0.01"
                        value={doc.priority.toFixed(2)}
                        on:input={handleInputStep}
                        on:blur={(e) => handlePriorityInputInList(doc.id, parseFloat(e.currentTarget.value))}
                        on:keydown={(e) => e.key === 'Enter' && handlePriorityInputInList(doc.id, parseFloat(e.currentTarget.value))}
                        style="width:50px;text-align:center;margin:0 4px;padding:2px 4px;border-radius:3px;border:1px solid var(--b3-theme-primary);font-weight:bold;font-size:13px;background-color:var(--b3-theme-surface);color:var(--b3-theme-primary);"
                      />
                      <button 
                        class="priority-btn" 
                        on:click={() => increasePriorityInList(doc.id)}
                        style="width:24px;height:24px;border-radius:3px;border:1px solid var(--b3-theme-primary);background-color:var(--b3-theme-background);cursor:pointer;font-size:14px;line-height:1;padding:0;color:var(--b3-theme-primary);font-weight:bold;"
                      >+</button>
                    </div>
                    
                    <span title={doc.visited ? '已访问' : '未访问'} style="font-size:18px;margin-left:8px;">{doc.visited ? '✔️' : '⭕'}</span>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>
      {/if}

      {#if currentRndId && !pluginInstance.isMobile}
        <MetricsPanel
          pluginInstance={pluginInstance}
          docId={currentRndId}
          reviewer={pr}
          metrics={docMetrics}
          {docPriority}
          on:priorityChange={handleMetricsPanelPriorityChange}
        />
        <!-- 优先级分布点图 -->
        <PriorityBarChart
          points={priorityBarPoints}
          currentId={currentRndId}
          minPriority={priorityBarMin}
          maxPriority={priorityBarMax}
          height={48}
          on:dragging={handlePriorityBarDragging}
          on:change={handlePriorityBarChange}
          on:openDocument={handleOpenDocument}
        />
      {/if}

      <!-- 移动端指标弹窗 -->
      {#if showMobileMetricsDialog && pluginInstance.isMobile}
        <div class="visited-dialog-mask" on:click={closeMobileMetricsDialog}></div>
        <div class="mobile-metrics-dialog">
          <div class="visited-dialog-header">
            <span>文档指标信息</span>
            <button class="close-btn" on:click={closeMobileMetricsDialog}>×</button>
          </div>
          <div class="mobile-metrics-content">
            {#if currentRndId}
              
              <!-- 文档指标面板 -->
              <div class="mobile-metrics-panel">
                <MetricsPanel
                  pluginInstance={pluginInstance}
                  docId={currentRndId}
                  reviewer={pr}
                  metrics={docMetrics}
                  {docPriority}
                  on:priorityChange={handleMetricsPanelPriorityChange}
                />
              </div>
              
              <!-- 优先级分布图 -->
              <div class="mobile-priority-chart">
                <h4>优先级分布图</h4>
                <PriorityBarChart
                  points={priorityBarPoints}
                  currentId={currentRndId}
                  minPriority={priorityBarMin}
                  maxPriority={priorityBarMax}
                  height={48}
                  on:dragging={handlePriorityBarDragging}
                  on:change={handlePriorityBarChange}
                  on:openDocument={handleOpenDocument}
                />
              </div>
            {:else}
              <div class="no-metrics-info">
                <p>当前没有选中的文档，无法显示指标信息。</p>
              </div>
            {/if}
          </div>
        </div>
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
      <div class="editable-area-container">
        <div class="editable-header">
          <span class="editable-title">编辑区域</span>
          <button class="lock-toggle-btn" on:click={toggleLock} title={$isLocked ? pluginInstance.i18n.unlockEditArea : pluginInstance.i18n.lockEditArea}>
            {#if $isLocked}
              🔒 {pluginInstance.i18n.editAreaLocked}
            {:else}
              🔓 {pluginInstance.i18n.editAreaUnlocked}
            {/if}
          </button>
        </div>
        {#if $isLocked}
          <div 
            class="editable-content-area locked"
            contenteditable="false"
            spellcheck="false"
            bind:innerHTML={editableContent}
            on:click={refreshEditableContent}
          ></div>
        {:else}
          <div 
            class="editable-content-area"
            contenteditable="true"
            spellcheck="false"
            bind:innerHTML={editableContent}
            on:input={handleContentEdit}
            on:blur={() => {
              isEditing = false;
              // 立即保存
              if (saveTimeout) {
                clearTimeout(saveTimeout);
                saveContent(editableContent);
              }
            }}
            on:focus={async () => {
              isEditing = true;
              // 在聚焦时刷新内容，确保与源文档同步
              await refreshEditableContent();
            }}
            on:click={refreshEditableContent}
          ></div>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- 根文档选择器弹窗 -->
{#if showDocSelector}
  <div class="tree-selector-overlay" on:click={() => showDocSelector = false}>
    <div class="tree-selector-container" on:click|stopPropagation>
      <div class="tree-selector-header">
        <h3>选择根文档</h3>
        <button class="tree-close-btn" on:click={() => showDocSelector = false}>×</button>
      </div>
      
      <div class="tree-selector-body">
        {#if currentLevel === "notebooks"}
          <div class="tree-header">
            <span class="tree-title">选择笔记本</span>
          </div>
          <div class="tree-content">
            {#each notebooks as notebook}
              <div class="tree-item notebook-item" on:click={() => selectNotebookForDoc(notebook)}>
                <span class="tree-icon">📚</span>
                <span class="tree-label">{notebook.name}</span>
                <span class="tree-arrow">→</span>
              </div>
            {/each}
          </div>
        {:else if currentLevel === "docs"}
          <div class="tree-header">
            <button class="tree-back" on:click={backToNotebookSelection}>
              ← 返回
            </button>
            <span class="tree-title">{selectedNotebookForDoc?.name}</span>
            <button class="tree-manual-btn" on:click={switchToManualInput}>
              输入ID
            </button>
          </div>
          <div class="tree-content">
            {#if isDocsLoading}
              <div class="tree-loading">加载中...</div>
            {:else if rootDocsList.length > 0}
              {#each rootDocsList as doc}
                <div class="tree-item doc-item">
                  <span class="tree-icon">📄</span>
                  <span class="tree-label">{doc.title}</span>
                  <div class="tree-actions">
                    <button 
                      class="tree-action-btn explore-btn" 
                      on:click={() => exploreDocument(doc.id, doc.title)}
                      title="查看子文档"
                    >
                      🔍
                    </button>
                    <button 
                      class="tree-action-btn select-btn" 
                      on:click={() => selectDocument(doc.id, doc.title)}
                      title="选择此文档"
                    >
                      ✓
                    </button>
                  </div>
                </div>
              {/each}
            {:else}
              <div class="tree-empty">该笔记本下没有根文档</div>
            {/if}
          </div>
        {:else if currentLevel === "childDocs"}
          <div class="tree-header">
            <button class="tree-back" on:click={backToPreviousLevel}>
              ← 返回
            </button>
            <span class="tree-title">子文档</span>
            <button class="tree-manual-btn" on:click={switchToManualInput}>
              输入ID
            </button>
          </div>
          <div class="tree-content">
            {#if isDocsLoading}
              <div class="tree-loading">加载中...</div>
            {:else if childDocsList.length > 0}
              {#each childDocsList as doc}
                <div class="tree-item doc-item">
                  <span class="tree-icon">📄</span>
                  <span class="tree-label">{doc.title}</span>
                  <div class="tree-actions">
                    <button 
                      class="tree-action-btn explore-btn" 
                      on:click={() => exploreDocument(doc.id, doc.title)}
                      title="查看子文档"
                    >
                      🔍
                    </button>
                    <button 
                      class="tree-action-btn select-btn" 
                      on:click={() => selectDocument(doc.id, doc.title)}
                      title="选择此文档"
                    >
                      ✓
                    </button>
                  </div>
                </div>
              {/each}
            {:else}
              <div class="tree-empty">该文档下没有子文档</div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- 手动输入ID弹窗 -->
{#if showManualInput}
  <div class="tree-selector-overlay" on:click={cancelManualInput}>
    <div class="manual-input-container" on:click|stopPropagation>
      <div class="manual-input-header">
        <h3>手动输入文档ID</h3>
        <button class="tree-close-btn" on:click={cancelManualInput}>×</button>
      </div>
      
      <div class="manual-input-body">
        <div class="manual-input-group">
          <label for="manual-id-input">文档ID：</label>
          <input 
            id="manual-id-input"
            type="text" 
            class="b3-text-field"
            bind:value={manualInputId}
            placeholder="请输入文档ID"
            on:keydown={(e) => e.key === 'Enter' && confirmManualInput()}
          />
        </div>
        
        <div class="manual-input-actions">
          <button class="b3-button b3-button--outline" on:click={cancelManualInput}>
            取消
          </button>
          <button class="b3-button" on:click={confirmManualInput}>
            确定
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style lang="stylus">

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
    margin-left 2px
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
    max-width 90px
    height: 26px
    
  .fn__size100
    width: 80px !important
    
  .fn__size150
    width: 120px !important
    
  .fn__size180
    width: 140px !important
    
  .reset-button
    color: var(--b3-theme-on-background)
    background-color: var(--b3-theme-error-lighter) !important
    &:hover
      background-color: var(--b3-theme-error-light) !important
      
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

  /* 笔记本选择器样式 */
  .notebook-selector
    position: relative
    display: inline-block
    
    
  .notebook-list
    position: absolute
    top: 100%
    left: 0
    z-index: 100
    background: var(--b3-theme-background)
    border: 1px solid var(--b3-border-color)
    border-radius: 4px
    box-shadow: 0 2px 8px rgba(0,0,0,0.1)
    padding: 8px
    max-height: 300px
    overflow-y: auto
    width: 200px
    
  .notebook-item
    display: block
    padding: 6px 8px
    cursor: pointer
    font-size: 13px
    border-radius: 4px
    
    &:hover
      background-color: var(--b3-list-hover)
      
    input
      margin-right: 8px
      
  .confirm-button-container
    display: flex
    justify-content: center
    margin-top: 8px


  .editable-content-area
    min-height: 400px
    padding: 16px
    border-radius: 6px
    border: 1px solid var(--b3-border-color)
    margin: 16px 0
    background-color: var(--b3-theme-background)
    outline: none
    transition: border-color 0.2s ease
    
    &:focus
      border-color: var(--b3-theme-primary)
      box-shadow: 0 0 0 2px var(--b3-theme-primary-lighter)
    
    &:hover
      border-color: var(--b3-theme-primary-light)

  .visited-dialog-mask
    position fixed
    top 0
    left 0
    width 100vw
    height 100vh
    background rgba(0,0,0,0.2)
    z-index 1000

  .visited-dialog
    position fixed
    top 50%
    left 50%
    transform translate(-50%, -50%)
    background var(--b3-theme-background)
    border 1px solid var(--b3-border-color)
    border-radius 8px
    box-shadow 0 4px 24px rgba(0,0,0,0.15)
    z-index 1001
    min-width 350px
    max-width 90vw
    max-height 70vh
    overflow auto
    padding 20px

  .visited-dialog-header
    display flex
    justify-content space-between
    align-items center
    font-size 16px
    font-weight bold
    margin-bottom 10px

  .close-btn
    background none
    border none
    font-size 20px
    cursor pointer

  .visited-list
    margin-top 10px
    ul
      list-style none
      padding 0
      margin 0
      li
        padding 4px 0
        border-bottom 1px solid var(--b3-border-color)
        font-size 14px
        display flex
        justify-content space-between
        align-items center
        &:last-child
          border-bottom none

  .visited-title
    color var(--b3-theme-primary)
    cursor pointer
    text-decoration underline
    &:hover
      color var(--b3-theme-primary-light)

  /* 移动端指标弹窗样式 */
  .mobile-metrics-dialog
    position fixed
    top 50%
    left 50%
    transform translate(-50%, -50%)
    background var(--b3-theme-background)
    border 1px solid var(--b3-border-color)
    border-radius 6px
    box-shadow 0 4px 20px rgba(0, 0, 0, 0.15)
    z-index 1001
    width 90vw
    max-height 85vh
    overflow-y auto
    padding 20px

  .mobile-metrics-content
    margin-top 15px

  .mobile-metrics-panel
    margin-bottom 20px
    border 1px solid var(--b3-border-color)
    border-radius 6px
    padding 10px

  .mobile-priority-chart
    h4
      margin 0 0 10px 0
      color var(--b3-theme-on-surface)
      font-size 14px
      font-weight 500

  .no-metrics-info
    text-align center
    padding 40px 20px
    color var(--b3-theme-on-surface-light)
    
    p
      margin 0
      font-size 14px

  /* 优先级排序列表中的调整控件样式 */
  .priority-edit-group
    .priority-btn
      transition: background 0.2s
      &:hover
        background: var(--b3-theme-primary-light) !important
  .priority-sortable-list
    list-style: none
    padding: 0
    margin: 0
    li
      padding: 8px 0
      border-bottom: 1px solid var(--b3-border-color)
      display: flex
      align-items: center
      gap: 8px
      cursor: grab
      border: 1px solid transparent
      border-radius: 4px
      transition: all 0.2s
      &:last-child
        border-bottom: none
      &.dragging
        opacity: 0.5
        border-color: var(--b3-theme-primary)
        box-shadow: 0 0 10px rgba(0,0,0,0.1)
      &.drag-over
        border-color: var(--b3-theme-primary)
        background-color: var(--b3-theme-surface-light)
      .drag-handle
        cursor: grab
        color: #999
        font-size: 16px
        margin-right: 4px

  /* 按钮加载图标 */
  .button-loading-icon {
    display: inline-block;
    width: 14px;
    height: 14px;
    margin-right: 4px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: button-spin 1s linear infinite;
    vertical-align: text-top;
  }
  
  @keyframes button-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* 根文档选择器样式 */
  .tree-selector-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .tree-selector-container, .manual-input-container {
    background: var(--b3-theme-background);
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    width: 500px;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
  }

  .tree-selector-header, .manual-input-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--b3-theme-surface);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .tree-selector-header h3, .manual-input-header h3 {
    margin: 0;
    font-size: 16px;
    color: var(--b3-theme-on-surface);
  }

  .tree-close-btn {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: var(--b3-theme-on-surface-light);
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tree-close-btn:hover {
    color: var(--b3-theme-on-surface);
  }

  .tree-selector-body {
    padding: 0;
    overflow: hidden;
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .tree-header {
    padding: 12px 20px;
    border-bottom: 1px solid var(--b3-theme-surface);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--b3-theme-surface-light);
  }

  .tree-title {
    font-weight: 500;
    color: var(--b3-theme-on-surface);
  }

  .tree-back, .tree-manual-btn {
    background: none;
    border: none;
    color: var(--b3-theme-primary);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
  }

  .tree-back:hover, .tree-manual-btn:hover {
    background: var(--b3-theme-primary-light);
  }

  .tree-content {
    flex: 1;
    overflow-y: auto;
    padding: 0;
  }

  .tree-item {
    padding: 12px 20px;
    display: flex;
    align-items: center;
    cursor: pointer;
    border-bottom: 1px solid var(--b3-theme-surface);
    transition: background-color 0.2s;
  }

  .tree-item:hover {
    background: var(--b3-theme-surface-light);
  }

  .tree-item:last-child {
    border-bottom: none;
  }

  .tree-icon {
    margin-right: 8px;
    font-size: 14px;
  }

  .tree-label {
    flex: 1;
    color: var(--b3-theme-on-surface);
    font-size: 14px;
  }

  .tree-arrow {
    color: var(--b3-theme-on-surface-light);
    font-size: 12px;
  }

  .tree-actions {
    display: flex;
    gap: 4px;
  }

  .tree-action-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 3px;
    font-size: 12px;
    transition: background-color 0.2s;
  }

  .tree-action-btn:hover {
    background: var(--b3-theme-surface);
  }

  .explore-btn {
    color: var(--b3-theme-primary);
  }

  .select-btn {
    color: var(--b3-theme-success);
  }

  .tree-loading, .tree-empty {
    padding: 20px;
    text-align: center;
    color: var(--b3-theme-on-surface-light);
    font-size: 14px;
  }

  /* 手动输入弹窗样式 */
  .manual-input-body {
    padding: 20px;
  }

  .manual-input-group {
    margin-bottom: 16px;
  }

  .manual-input-group label {
    display: block;
    margin-bottom: 8px;
    color: var(--b3-theme-on-surface);
    font-size: 14px;
  }

  .manual-input-group input {
    width: 100%;
  }

  .manual-input-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  /* 标签选择器样式 - 完全参照笔记本选择器 */
  .tag-selector
    position: relative
    display: inline-block
  
  .tag-list
    position: absolute
    top: 100%
    left: 0
    z-index: 100
    background: var(--b3-theme-background)
    border: 1px solid var(--b3-border-color)
    border-radius: 4px
    box-shadow: 0 2px 8px rgba(0,0,0,0.1)
    padding: 8px
    max-height: 300px
    overflow-y: auto
    width: 200px
  
  .tag-item
    display: block
    padding: 6px 8px
    cursor: pointer
    font-size: 13px
    border-radius: 4px
    
    &:hover
      background-color: var(--b3-list-hover)
      
    input
      margin-right: 8px
  
  .tag-empty
    padding: 12px
    text-align: center
    color: var(--b3-theme-on-surface-light)
    font-size: 13px
  
  .tag-loading
    padding: 12px
    text-align: center
    color: var(--b3-theme-on-surface-light)
    font-size: 13px

  // 编辑区域样式
  .editable-area-container
    margin-top: 8px
    border: 1px solid var(--b3-border-color)
    border-radius: 6px
    overflow: hidden

  .editable-header
    display: flex
    justify-content: space-between
    align-items: center
    padding: 8px 12px
    background-color: var(--b3-theme-surface)
    border-bottom: 1px solid var(--b3-border-color)
    
  .editable-title
    font-size: 14px
    font-weight: 500
    color: var(--b3-theme-on-background)

  .lock-toggle-btn
    background: none
    border: 1px solid var(--b3-border-color)
    padding: 4px 8px
    border-radius: 4px
    cursor: pointer
    font-size: 12px
    transition: all 0.2s ease
    
    &:hover
      background-color: var(--b3-theme-surface-light)
      border-color: var(--b3-theme-primary)

  .editable-content-area
    min-height: 200px
    padding: 12px
    background-color: var(--b3-theme-background)
    outline: none
    transition: all 0.2s ease
    
    &.locked
      background-color: var(--b3-theme-surface-light)
      color: var(--b3-theme-on-surface-light)
      cursor: not-allowed
      
    &:focus:not(.locked)
      box-shadow: inset 0 0 0 1px var(--b3-theme-primary)
</style>
