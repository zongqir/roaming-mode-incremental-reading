<!--
  - 移动端浮窗操作按钮组件
  - 包含关闭、跳转到文档、漫游等操作
  -->

<script lang="ts">
  import { showMessage, openMobileFileById } from "siyuan"
  import type RandomDocPlugin from "../index"

  // Props
  export let pluginInstance: RandomDocPlugin
  export let currentRndId: string = ""
  export let isLoading: boolean = false
  export let onCloseAction: () => void = () => {}
  export let onRoamAction: () => void = () => {}

  // 浮动按钮拖拽相关变量
  let floatingBtn: HTMLElement
  let floatingRoamBtn: HTMLElement
  let hasActuallyDragged = false
  let hasRoamActuallyDragged = false

  // 智能消息显示函数：在全屏模式下使用自定义消息，否则使用SiYuan原生消息
  const smartShowMessage = (message: string, duration: number = 3000, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    if (pluginInstance.isMobile && pluginInstance.showFullscreenMessage) {
      // 全屏模式下使用自定义消息显示
      pluginInstance.showFullscreenMessage(message, duration, type)
    } else {
      // 普通模式下使用SiYuan原生消息显示，只支持info和error类型
      const siyuanType: 'info' | 'error' = (type === 'error') ? 'error' : 'info'
      showMessage(message, duration, siyuanType)
    }
  }

  // 关闭渐进阅读并跳转到当前文档
  async function closeIncrementalAndOpenDoc() {
    if (!currentRndId) {
      smartShowMessage("当前没有正在阅读的文档", 3000, 'warning')
      return
    }

    try {
      pluginInstance.logger.info("开始执行关闭渐进阅读并跳转到文档:", currentRndId)
      
      // 1. 先记录当前文档ID
      const docToOpen = currentRndId
      
      // 2. 执行关闭操作
      onCloseAction()
      
      // 3. 稍微延迟后打开目标文档，确保关闭操作完成
      setTimeout(async () => {
        try {
          pluginInstance.logger.info("准备打开文档:", docToOpen)
          
          // 使用移动端专用API打开文档
          const result = await openMobileFileById(pluginInstance.app, docToOpen)
          pluginInstance.logger.info("openMobileFileById 调用成功:", result)
          
          smartShowMessage("已跳转到当前文档", 2000, 'success')
          
        } catch (openError) {
          pluginInstance.logger.error("打开文档失败:", openError)
          smartShowMessage("打开文档失败: " + openError.message, 3000, 'error')
        }
      }, 300)
      
    } catch (error) {
      pluginInstance.logger.error("关闭渐进阅读并跳转文档失败:", error)
      smartShowMessage("操作失败: " + error.message, 3000, 'error')
    }
  }

  // 拖拽相关函数
  function startDrag(e) {
    hasActuallyDragged = false
    // 拖拽逻辑可以根据需要实现
  }

  function startRoamDrag(e) {
    hasRoamActuallyDragged = false
    // 拖拽逻辑可以根据需要实现
  }

  // 处理关闭按钮点击
  function handleCloseClick(e) {
    if (hasActuallyDragged) {
      e.preventDefault()
      return
    }
    onCloseAction()
  }

  // 处理漫游按钮点击
  function handleRoamClick(e) {
    if (hasRoamActuallyDragged) {
      e.preventDefault()
      return
    }
    onRoamAction()
  }
</script>

<!-- 手机端浮动按钮组 -->
{#if pluginInstance.isMobile}
  <!-- 关闭按钮 -->
  <button 
    class="mobile-floating-back-btn" 
    bind:this={floatingBtn}
    on:click={handleCloseClick}
    on:mousedown={startDrag}
    on:touchstart={startDrag}
  >
    ✕
  </button>

  <!-- 跳转到文档按钮 -->
  {#if currentRndId}
    <button 
      class="mobile-floating-jump-btn" 
      on:click={(e) => {
        e.preventDefault()
        closeIncrementalAndOpenDoc()
      }}
      title="关闭渐进阅读并跳转到当前文档"
    >
      📖
    </button>
  {/if}

  <!-- 漫游按钮 -->
  <button 
    class="mobile-floating-roam-btn" 
    bind:this={floatingRoamBtn}
    on:click={handleRoamClick}
    on:mousedown={startRoamDrag}
    on:touchstart={startRoamDrag}
    disabled={isLoading}
  >
    {#if isLoading}
      ⏳
    {:else}
      🎲
    {/if}
  </button>
{/if}

<style lang="stylus">
  /* 手机端浮动按钮共同样式 */
  .mobile-floating-back-btn,
  .mobile-floating-roam-btn,
  .mobile-floating-jump-btn
    position: fixed !important
    width: 40px !important
    height: 40px !important
    border-radius: 20px !important
    color: white !important
    border: none !important
    font-size: 14px !important
    cursor: move !important
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important
    z-index: 9999 !important
    transition: background-color 0.2s ease !important
    display: flex !important
    align-items: center !important
    justify-content: center !important
    user-select: none !important
    -webkit-user-select: none !important
    touch-action: none !important

  /* 关闭按钮 - 红色，右下角 */
  .mobile-floating-back-btn
    bottom: 30px !important
    right: 30px !important
    background-color: #dc3545 !important
    
    &:hover
      background-color: #c82333 !important
    
    &:active
      background-color: #bd2130 !important

  /* 跳转到文档按钮 - 绿色，右下角中间位置 */
  .mobile-floating-jump-btn
    bottom: 130px !important
    right: 30px !important
    background-color: #28a745 !important
    
    &:hover
      background-color: #218838 !important
    
    &:active
      background-color: #1e7e34 !important

  /* 漫游按钮 - 蓝色，右下角偏上 */
  .mobile-floating-roam-btn
    bottom: 80px !important
    right: 30px !important
    background-color: var(--b3-theme-primary) !important
    
    &:hover
      background-color: var(--b3-theme-primary-light) !important
    
    &:active
      background-color: var(--b3-theme-primary-dark) !important
      
    &:disabled
      background-color: #6c757d !important
      cursor: not-allowed !important
      opacity: 0.8 !important
</style>
