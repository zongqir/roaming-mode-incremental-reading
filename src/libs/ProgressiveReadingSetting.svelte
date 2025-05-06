<script lang="ts">
  import ProgressiveReadingPlugin from "../index"
  import { onMount } from "svelte"
  import ProgressiveReadingConfig, { ReviewMode } from "../models/ProgressiveReadingConfig"
  import { storeName } from "../Constants"
  import { showMessage } from "siyuan"

  // props
  export let pluginInstance: ProgressiveReadingPlugin
  export let dialog

  let storeConfig: ProgressiveReadingConfig
  let showLoading = false
  let customSqlEnabled = false
  let sqlContent = JSON.stringify([])
  let reviewMode = ReviewMode.Progressive
  let excludeTodayVisited = true

  const onSaveSetting = async () => {
    dialog.destroy()

    storeConfig.showLoading = showLoading
    storeConfig.customSqlEnabled = customSqlEnabled
    storeConfig.sql = sqlContent
    storeConfig.reviewMode = reviewMode
    storeConfig.excludeTodayVisited = excludeTodayVisited
    await pluginInstance.saveData(storeName, storeConfig)

    showMessage(`${pluginInstance.i18n.settingConfigSaveSuccess}`, 2000, "info")
  }

  const onCancel = async () => {
    dialog.destroy()
  }

  onMount(async () => {
    storeConfig = await pluginInstance.loadData(storeName)
    showLoading = storeConfig?.showLoading ?? false
    customSqlEnabled = storeConfig?.customSqlEnabled ?? false
    reviewMode = storeConfig?.reviewMode ?? ReviewMode.Progressive
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
  })
</script>

<div class="roaming-mode-incremental-reading-setting">
  <div class="config__tab-container">
    <div class="fn__block form-item">
      {pluginInstance.i18n.showLoading}
      <div class="b3-label__text form-item-tip">{pluginInstance.i18n.showLoadingTip}</div>
      <span class="fn__hr" />
      <input class="b3-switch fn__flex-center" id="syncCss" type="checkbox" bind:checked={showLoading} />
    </div>

    <div class="fn__block form-item">
      复习模式
      <div class="b3-label__text form-item-tip">选择渐进阅读的复习模式</div>
      <span class="fn__hr" />
      <select bind:value={reviewMode} class="b3-select fn__block">
        <option value={ReviewMode.Progressive}>渐进模式</option>
        <option value={ReviewMode.Once}>一遍过模式</option>
      </select>
    </div>
    
    {#if reviewMode === ReviewMode.Progressive}
      <div class="fn__block form-item">
        排除今日已漫游的文档
        <div class="b3-label__text form-item-tip">勾选后，今日已访问过的文档将不会再次出现</div>
        <span class="fn__hr" />
        <input class="b3-switch fn__flex-center" id="excludeToday" type="checkbox" bind:checked={excludeTodayVisited} />
      </div>
      
      <div class="fn__block form-item">
        渐进模式配置
        <div class="b3-label__text form-item-tip">选择渐进模式后，可以通过顶栏按钮右键菜单中的"渐进式模式配置"来设置自定义指标</div>
      </div>
    {/if}

    <div class="fn__block form-item">
      {pluginInstance.i18n.customSqlEnabled}
      <div class="b3-label__text form-item-tip">{pluginInstance.i18n.customSqlEnabledTip}</div>
      <span class="fn__hr" />
      <input class="b3-switch fn__flex-center" id="syncCss" type="checkbox" bind:checked={customSqlEnabled} />
    </div>

    {#if customSqlEnabled}
      <div class="fn__block form-item">
        {pluginInstance.i18n.sqlContent}
        <div class="b3-label__text form-item-tip">{pluginInstance.i18n.sqlContentTip}</div>
        <span class="fn__hr" />
        <textarea
          class="b3-text-field fn__block"
          id="regCode"
          bind:value={sqlContent}
          rows="5"
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
    padding: 10px;
    width: 94%;
    margin: auto;
    font-size: 14px;
  }

  .form-item-tip {
    font-size: 12px !important;
    color: var(--b3-theme-on-background);
  }
</style> 