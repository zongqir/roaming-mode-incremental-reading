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
  let title = "漫游式渐进阅读"
  let tips = "信息提升"
  let currentRndId = ""
  let unReviewedCount = 0
  let content = "暂无内容"
  let reviewMode = ReviewMode.Progressive

  let sqlList: any[] = []
  let currentSql = ""
  let pr: IncrementalReviewer
  
  // 渐进模式相关
  let docMetrics = []
  let docPriority = 0

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
      if (storeConfig.reviewMode === ReviewMode.Progressive) {
        await doProgressiveRandomDoc()
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
        // 获取文档内容
        const rootBlock = await pluginInstance.kernelApi.getBlockByID(currentRndId)
        const doc = (await pluginInstance.kernelApi.getDoc(currentRndId)).data as any
        title = rootBlock.content
        content = doc.content ?? ""
        // 只读
        content = content.replace(/contenteditable="true"/g, 'contenteditable="false"')
        // 获取总文档数
        const total = await pluginInstance.kernelApi.getRootBlocksCount()
        tips = `哇哦，穿越大山，跨过大河，在${total}篇文档中，我又为您找到了一篇新的~`
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
        // 获取文档内容
        const rootBlock = await pluginInstance.kernelApi.getBlockByID(currentRndId)
        const doc = (await pluginInstance.kernelApi.getDoc(currentRndId)).data as any
        title = rootBlock.content
        content = doc.content ?? ""
        // 处理空文档
        if (isContentEmpty(content)) {
          clearDoc()
          tips = "当前文档正文为空，2s 后继续下一个"
          setTimeout(async () => {
            await doRandomDoc()
          }, 2000)
          return
        }
        // 只读
        content = content.replace(/contenteditable="true"/g, 'contenteditable="false"')
        
        // 获取总文档数
        const total = await getTotalDocCount()
        tips = `已漫游到新文档，共${total}篇文档，还有${unReviewedCount}篇文档尚未访问，加油💪~`
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
  export const doProgressiveRandomDoc = async () => {
    if (isLoading) {
      pluginInstance.logger.warn("上次随机还未结束，忽略")
      return
    }

    try {
      isLoading = true
      pluginInstance.logger.info("开始渐进式漫游...")
      
      // 初始化渐进模式
      if (!pr) {
        pluginInstance.logger.info("初始化渐进模式reviewer...")
        pr = new IncrementalReviewer(storeConfig, pluginInstance)
        await pr.initIncrementalConfig()
        pluginInstance.logger.info("渐进模式reviewer初始化完成")
      }
      
      // 尝试从存储中重新加载配置
      try {
        pluginInstance.logger.info("重新加载最新配置...")
        storeConfig = await pluginInstance.safeLoad(storeName)
        if (storeConfig?.reviewMode !== ReviewMode.Progressive) {
          pluginInstance.logger.info(`当前复习模式为: ${storeConfig?.reviewMode}，但调用了渐进模式漫游`)
          storeConfig.reviewMode = ReviewMode.Progressive
        }
      } catch (configError) {
        pluginInstance.logger.error("加载配置失败", configError)
      }
      
      pluginInstance.logger.info("开始获取随机文档...")
      // 获取随机文档ID
      currentRndId = await pr.getRandomDoc()
      
      if (!currentRndId) {
        pluginInstance.logger.error("获取文档ID失败，返回为空")
        clearDoc()
        throw new Error("没有找到符合条件的文档")
      }
      
      pluginInstance.logger.info(`已漫游到 ${currentRndId} ...`)
      
      // 获取文档详情
      try {
        const rootBlock = await pluginInstance.kernelApi.getBlockByID(currentRndId)
        if (!rootBlock) {
          pluginInstance.logger.error(`无法获取文档块: ${currentRndId}`)
          throw new Error(`无法获取文档块: ${currentRndId}`)
        }
        
        const docResult = await pluginInstance.kernelApi.getDoc(currentRndId)
        if (!docResult || docResult.code !== 0) {
          pluginInstance.logger.error(`获取文档内容失败: ${JSON.stringify(docResult)}`)
          throw new Error("获取文档内容失败")
        }
        
        const doc = docResult.data as any
        title = rootBlock.content
        content = doc.content ?? ""
        
        pluginInstance.logger.info(`文档标题: ${title}, 内容长度: ${content.length}`)
      } catch (docError) {
        pluginInstance.logger.error("获取文档详情失败", docError)
        clearDoc()
        throw docError
      }
      
      // 处理空文档
      if (isContentEmpty(content)) {
        pluginInstance.logger.warn("文档内容为空，将在2秒后继续下一个")
        clearDoc()
        tips = "当前文档正文为空，2s 后继续下一个"
        setTimeout(async () => {
          await doProgressiveRandomDoc()
        }, 2000)
        return
      }
      
      // 只读
      content = content.replace(/contenteditable="true"/g, 'contenteditable="false"')
      
      // 获取指标数据
      docMetrics = pr.getMetrics()
      pluginInstance.logger.info(`获取到 ${docMetrics.length} 个指标`)
      
      // 获取总文档数
      const total = await pr.getTotalDocCount()
      pluginInstance.logger.info(`符合条件的文档总数: ${total}`)
      
      tips = `已漫游到新文档，共${total}篇文档，请根据需要调整下方指标值`
      
    } catch (e) {
      pluginInstance.logger.error("漫游式渐进阅读失败", e)
      clearDoc()
      tips = "漫游式渐进阅读失败！=>" + e.toString()
      showMessage("漫游式渐进阅读失败: " + e.message, 5000, "error")
    } finally {
      isLoading = false
    }
  }

  // 一遍过模式获取文档
  const getOnceModeDoc = async () => {
    const filterCondition = buildFilterCondition()
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
      await resetAllVisitCounts()
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
    const filterCondition = buildFilterCondition()
    const sql = `SELECT COUNT(id) AS total FROM blocks WHERE type = 'd' ${filterCondition}`
    const result = await pluginInstance.kernelApi.sql(sql)
    return result.data?.[0]?.total || 0
  }

  // 重置所有访问计数
  const resetAllVisitCounts = async () => {
    const filterCondition = buildFilterCondition()
    let page = 1
    const pageSize = 50
    let hasMore = true
    let totalReset = 0

    try {
      while (hasMore) {
        const sql = `SELECT id FROM blocks 
                WHERE type = 'd' 
                ${filterCondition}
                AND id IN (
                  SELECT block_id FROM attributes 
                  WHERE name = 'custom-visit-count'
                )
                LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`

        const result = await pluginInstance.kernelApi.sql(sql)
        if (result.code !== 0) {
          showMessage(pluginInstance.i18n.docFetchError, 7000, "error")
          throw new Error(result.msg)
        }
        const data = result.data as any[]
        const docIds = data?.map((item) => item.id) || []

        await Promise.all(
          docIds.map(async (docId) => {
            await pluginInstance.kernelApi.setBlockAttrs(docId, {
              "custom-visit-count": "",
            })
          })
        )

        totalReset += docIds.length
        hasMore = docIds.length === pageSize
        page++
      }
      
      showMessage(`已重置 ${totalReset} 条访问记录，将继续漫游`, 3000)
    } catch (error) {
      pluginInstance.logger.error("重置访问记录失败", error)
      throw error
    }
  }

  // 构建过滤条件
  const buildFilterCondition = () => {
    // 处理旧配置的兼容性
    const filterMode = storeConfig.filterMode || FilterMode.Notebook
    const notebookId = storeConfig.notebookId || ""
    const rootId = storeConfig.rootId || ""

    if (filterMode === FilterMode.Root && rootId && rootId.length > 0) {
      return `AND path like '%${rootId}%'`
    }
    if (filterMode === FilterMode.Notebook && notebookId && notebookId.length > 0) {
      return `AND box = '${notebookId}'`
    }
    return ""
  }

  // events
  const clearDoc = () => {
    currentRndId = undefined
    content = ""
    tips = "条件已改变，请重新漫游！"
  }

  const notebookChange = async function () {
    // 显示当前选择的名称
    storeConfig.notebookId = toNotebookId
    await pluginInstance.saveData(storeName, storeConfig)
    // 重置文档
    clearDoc()
    pluginInstance.logger.info("storeConfig saved toNotebookId =>", storeConfig)
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
    if (reviewMode === ReviewMode.Progressive) {
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
    pluginInstance.logger.info("storeConfig saved filterMode =>", storeConfig)
  }

  const onRootIdChange = async function () {
    // 显示当前选择的名称
    storeConfig.rootId = rootId
    await pluginInstance.saveData(storeName, storeConfig)
    // 重置文档
    clearDoc()
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
    window.open("https://siyuan.wiki/s/20250421162737-l6p21h5")
  }

  // 导出函数，让外部可以调用
  export const resetAndRefresh = async () => {
    try {
      await resetAllVisitCounts()
      
      // 重置后立即重新漫游
      if (reviewMode === ReviewMode.Progressive) {
        await doProgressiveRandomDoc()
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
    docPriority = event.detail.priority
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
      storeConfig.reviewMode = ReviewMode.Progressive
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
    if (reviewMode === ReviewMode.Progressive) {
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
              on:change={notebookChange}
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
            <option value={ReviewMode.Progressive}>渐进</option>
            <option value={ReviewMode.Once}>一遍过</option>
          </select>
        {/if}

        <button class="action-item b3-button b3-button--outline btn-small" on:click={openDocEditor}>编辑</button>
        <button
          class="action-item b3-button b3-button--outline btn-small help-icon"
          on:click={openHelpDoc}
          title={pluginInstance.i18n.help}
        >
          ?
        </button>
        <button class="action-item b3-button btn-small" on:click={reviewMode === ReviewMode.Progressive ? doProgressiveRandomDoc : doRandomDoc}>
          {isLoading ? "漫游中..." : "继续漫游"}
        </button>
        <button class="action-item b3-button b3-button--outline btn-small reset-button" on:click={resetAndRefresh} title="清空已访问的文档记录">
          重置已访问
        </button>
      </div>

      {#if reviewMode === ReviewMode.Progressive && currentRndId}
        <MetricsPanel
          pluginInstance={pluginInstance}
          docId={currentRndId}
          reviewer={pr}
          metrics={docMetrics}
          bind:totalPriority={docPriority}
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
</style>
