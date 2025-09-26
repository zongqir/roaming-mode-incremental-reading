/**
 * ========================================
 * 漫游式渐进阅读插件 - 主页面浮动按钮
 * ========================================
 * 
 * 本文件实现了在思源笔记主页面添加浮动快捷按钮的功能，
 * 为手机端用户提供更便捷的漫游功能访问方式。
 * 
 * ## 功能特点
 * 1. 主页面浮动按钮 - 始终可见的快速启动入口
 * 2. 手机端优化 - 大按钮设计，便于触摸操作
 * 3. 智能隐藏 - 在非主页面时自动隐藏
 * 4. 状态同步 - 显示当前漫游状态
 */

import type RandomDocPlugin from "./index"
import { showMessage } from "siyuan"
import { icons } from "./utils/svg"

/**
 * 初始化主页面浮动按钮
 * 在思源笔记的主页面添加一个浮动的快速启动按钮
 *
 * @param pluginInstance 插件实例
 */
export async function initFloatingButton(pluginInstance: RandomDocPlugin) {
  try {
    // 只在手机端显示浮动按钮
    if (!pluginInstance.isMobile) {
      pluginInstance.logger.info("桌面端不显示浮动按钮，请使用顶栏按钮")
      return
    }

    // 创建浮动按钮
    const floatingButton = createFloatingButton(pluginInstance)
    
    // 添加到页面
    document.body.appendChild(floatingButton)
    
    // 保存引用
    pluginInstance.floatingButton = floatingButton
    
    // 监听页面变化，在主页面显示，在其他页面隐藏
    setupPageVisibilityControl(pluginInstance, floatingButton)
    
    pluginInstance.logger.info("主页面浮动按钮初始化成功")
    
    // 延迟显示提示
    setTimeout(() => {
      showMessage("💡 新功能：主页面右下角新增渐进式阅读快速启动按钮！", 4000, "info")
    }, 3000)
    
  } catch (error) {
    pluginInstance.logger.error("初始化浮动按钮失败:", error)
    showMessage("快速启动按钮初始化失败，请使用顶栏按钮", 3000, "warning")
  }
}

/**
 * 创建浮动按钮元素
 */
function createFloatingButton(pluginInstance: RandomDocPlugin): HTMLElement {
  const button = document.createElement('div')
  button.id = 'incremental-reading-floating-btn'
  button.className = 'incremental-reading-floating'
  
  // 按钮样式
  button.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 50%;
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
    cursor: pointer;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    user-select: none;
    opacity: 0.9;
  `
  
  // 按钮图标
  button.innerHTML = `
    <div style="
      color: white;
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    ">
      ${icons.iconTopbar}
    </div>
  `
  
  // 添加悬停效果
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.1)'
    button.style.boxShadow = '0 6px 25px rgba(102, 126, 234, 0.6)'
  })
  
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)'
    button.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.4)'
  })
  
  // 桌面端点击事件（移动端在touchend中处理）
  button.addEventListener('click', async (e) => {
    // 只在非移动端处理点击事件
    if (!pluginInstance.isMobile) {
      await handleFloatingButtonClick(pluginInstance, button)
    }
  })
  
  // 触摸拖拽和长按功能（手机端）
  let pressTimer: NodeJS.Timeout | null = null
  let isDragging = false
  let startX = 0
  let startY = 0
  let initialX = 0
  let initialY = 0
  let hasMoved = false
  
  button.addEventListener('touchstart', (e) => {
    e.preventDefault()
    
    const touch = e.touches[0]
    startX = touch.clientX
    startY = touch.clientY
    
    // 获取按钮当前位置
    const rect = button.getBoundingClientRect()
    initialX = rect.left
    initialY = rect.top
    
    isDragging = false
    hasMoved = false
    
    // 长按定时器
    pressTimer = setTimeout(() => {
      if (!hasMoved) {
        showQuickMenu(pluginInstance, button)
      }
    }, 800)
  })
  
  button.addEventListener('touchmove', (e) => {
    e.preventDefault()
    
    if (pressTimer) {
      clearTimeout(pressTimer)
      pressTimer = null
    }
    
    const touch = e.touches[0]
    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY
    
    // 如果移动距离超过阈值，开始拖拽
    if (!isDragging && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      isDragging = true
      button.style.transition = 'none' // 拖拽时禁用过渡动画
    }
    
    if (isDragging) {
      hasMoved = true
      const newX = initialX + deltaX
      const newY = initialY + deltaY
      
      // 限制在屏幕范围内
      const maxX = window.innerWidth - 60
      const maxY = window.innerHeight - 60
      const constrainedX = Math.max(20, Math.min(maxX, newX))
      const constrainedY = Math.max(20, Math.min(maxY, newY))
      
      button.style.left = constrainedX + 'px'
      button.style.top = constrainedY + 'px'
      button.style.right = 'auto'
      button.style.bottom = 'auto'
    }
  })
  
  button.addEventListener('touchend', (e) => {
    e.preventDefault()
    
    if (pressTimer) {
      clearTimeout(pressTimer)
      pressTimer = null
    }
    
    // 恢复过渡动画
    button.style.transition = 'all 0.3s ease'
    
    // 如果没有拖拽且没有移动，触发点击
    if (!isDragging && !hasMoved) {
      handleFloatingButtonClick(pluginInstance, button)
    }
    
    // 拖拽结束后吸附到边缘
    if (isDragging) {
      const rect = button.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const screenWidth = window.innerWidth
      
      // 吸附到左边或右边
      if (centerX < screenWidth / 2) {
        button.style.left = '20px'
      } else {
        button.style.left = 'auto'
        button.style.right = '20px'
      }
      
      // 保存位置到localStorage
      const position = {
        left: button.style.left,
        right: button.style.right,
        top: button.style.top,
        bottom: button.style.bottom
      }
      localStorage.setItem('floating-button-position', JSON.stringify(position))
    }
    
    isDragging = false
    hasMoved = false
  })
  
  // 恢复上次保存的位置
  try {
    const savedPosition = localStorage.getItem('floating-button-position')
    if (savedPosition) {
      const position = JSON.parse(savedPosition)
      if (position.left && position.left !== 'auto') {
        button.style.left = position.left
        button.style.right = 'auto'
      } else if (position.right && position.right !== 'auto') {
        button.style.right = position.right
        button.style.left = 'auto'
      }
      
      if (position.top && position.top !== 'auto') {
        button.style.top = position.top
        button.style.bottom = 'auto'
      } else if (position.bottom && position.bottom !== 'auto') {
        button.style.bottom = position.bottom
        button.style.top = 'auto'
      }
    }
  } catch (error) {
    pluginInstance.logger.warn('恢复浮动按钮位置失败:', error)
  }
  
  return button
}

/**
 * 处理浮动按钮点击事件
 */
async function handleFloatingButtonClick(pluginInstance: RandomDocPlugin, button: HTMLElement) {
  try {
    // 检查是否已经在漫游中
    const isRoaming = !!(pluginInstance.tabContentInstance || pluginInstance.fullscreenContainer)
    
    if (isRoaming) {
      showMessage('漫游已在进行中', 2000, 'info')
      return
    }
    
    // 添加点击动画
    button.style.transform = 'scale(0.95)'
    setTimeout(() => {
      button.style.transform = 'scale(1)'
    }, 150)
    
    // 启动漫游功能
    await startRoamingFromFloatingButton(pluginInstance)
    
  } catch (error) {
    pluginInstance.logger.error("浮动按钮启动漫游失败:", error)
    showMessage("启动漫游失败: " + error.message, 3000, "error")
  }
}

/**
 * 从浮动按钮启动漫游功能
 */
async function startRoamingFromFloatingButton(pluginInstance: RandomDocPlugin) {
  try {
    // 在创建新实例前，先清理所有已存在的实例
    pluginInstance.cleanupExistingInstances()
    
    // 导入topbar模块中的triggerRandomDoc函数
    const topbarModule = await import('./topbar')
    
    // 由于triggerRandomDoc是内部函数，我们需要调用initTopbar中的逻辑
    // 这里我们重新实现移动端的最大化窗口逻辑
    
    // 创建最大化容器
    const fullscreenContainer = document.createElement('div')
    fullscreenContainer.id = "fullscreen-random-doc"
    fullscreenContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: var(--b3-theme-background);
      z-index: 9998;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `
    
    // 创建头部
    const header = document.createElement('div')
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: var(--b3-theme-surface);
      border-bottom: 1px solid var(--b3-theme-border);
      flex-shrink: 0;
    `
    
    // 创建标题
    const title = document.createElement('h2')
    title.textContent = pluginInstance.i18n.randomDoc || "渐进式阅读漫游"
    title.style.cssText = `
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--b3-theme-on-background);
    `
    
    // 创建返回按钮
    const backButton = document.createElement('button')
    backButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    `
    backButton.style.cssText = `
      background: none;
      border: none;
      padding: 8px;
      cursor: pointer;
      border-radius: 6px;
      color: var(--b3-theme-on-background);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s;
    `
    
    // 返回按钮事件
    backButton.addEventListener('click', () => {
      closeFullscreenModeFromFloating(pluginInstance, fullscreenContainer)
    })
    
    // 组装头部
    header.appendChild(backButton)
    header.appendChild(title)
    header.appendChild(document.createElement('div')) // 占位符
    
    // 创建内容区域
    const contentArea = document.createElement('div')
    contentArea.id = "fullscreen-content"
    contentArea.style.cssText = `
      flex: 1;
      overflow: auto;
      padding: 0;
    `
    
    // 组装容器
    fullscreenContainer.appendChild(header)
    fullscreenContainer.appendChild(contentArea)
    
    // 添加到页面
    document.body.appendChild(fullscreenContainer)
    
    // 动态导入RandomDocContent组件
    const { default: RandomDocContent } = await import('./libs/RandomDocContent.svelte')
    
    // 创建漫游内容组件
    pluginInstance.tabContentInstance = new RandomDocContent({
      target: contentArea,
      props: {
        pluginInstance: pluginInstance,
      },
    })
    
    // 保存引用
    pluginInstance.fullscreenContainer = fullscreenContainer
    
    showMessage('渐进式阅读漫游已启动', 2000, 'info')
    
  } catch (error) {
    throw new Error('启动漫游失败: ' + error.message)
  }
}

/**
 * 关闭从浮动按钮启动的最大化模式
 */
function closeFullscreenModeFromFloating(pluginInstance: RandomDocPlugin, container: HTMLElement) {
  try {
    // 清理容器
    container.remove()
    
    // 清理组件实例
    if (pluginInstance.tabContentInstance) {
      pluginInstance.tabContentInstance.$destroy()
      pluginInstance.tabContentInstance = null
    }
    
    // 清理引用
    pluginInstance.fullscreenContainer = null
    
    pluginInstance.logger.info("从浮动按钮启动的漫游已关闭")
    
  } catch (error) {
    pluginInstance.logger.error("关闭浮动按钮漫游失败:", error)
  }
}

/**
 * 显示快速菜单（长按触发）
 */
function showQuickMenu(pluginInstance: RandomDocPlugin, button: HTMLElement) {
  // 简单的震动反馈（如果支持）
  if (navigator.vibrate) {
    navigator.vibrate(50)
  }
  
  // 显示快速菜单选项
  const menu = document.createElement('div')
  menu.style.cssText = `
    position: fixed;
    bottom: 150px;
    right: 20px;
    background: var(--b3-theme-surface);
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    padding: 8px 0;
    z-index: 1001;
    min-width: 120px;
  `
  
  // 菜单项：打开设置
  const settingItem = document.createElement('div')
  settingItem.textContent = '插件设置'
  settingItem.style.cssText = `
    padding: 12px 16px;
    cursor: pointer;
    color: var(--b3-theme-on-surface);
    transition: background-color 0.2s;
  `
  
  settingItem.addEventListener('click', async () => {
    menu.remove()
    try {
      const { showSettingMenu } = await import('./topbar')
      showSettingMenu(pluginInstance)
    } catch (error) {
      showMessage('打开设置失败', 3000, 'error')
    }
  })
  
  menu.appendChild(settingItem)
  document.body.appendChild(menu)
  
  // 点击其他地方关闭菜单
  setTimeout(() => {
    const closeMenu = () => {
      menu.remove()
      document.removeEventListener('click', closeMenu)
    }
    document.addEventListener('click', closeMenu)
  }, 100)
}

/**
 * 设置页面可见性控制
 * 在主页面显示按钮，在其他页面隐藏
 */
function setupPageVisibilityControl(pluginInstance: RandomDocPlugin, button: HTMLElement) {
  // 检查当前是否在主页面的函数
  const checkIsHomePage = () => {
    // 检查URL或DOM结构来判断是否在主页面
    const isHome = !document.querySelector('.layout-tab-container .protyle') && 
                   !document.querySelector('.sy__file') &&
                   document.querySelector('.b3-list')
    return isHome
  }
  
  // 更新按钮可见性
  const updateButtonVisibility = () => {
    const isHome = checkIsHomePage()
    button.style.display = isHome ? 'flex' : 'none'
  }
  
  // 初始检查
  updateButtonVisibility()
  
  // 监听DOM变化
  const observer = new MutationObserver(() => {
    updateButtonVisibility()
  })
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
  
  // 监听路由变化
  window.addEventListener('popstate', updateButtonVisibility)
  
  // 保存observer引用以便清理
  pluginInstance.pageObserver = observer
}

/**
 * 移除浮动按钮
 */
export function removeFloatingButton(pluginInstance: RandomDocPlugin) {
  try {
    if (pluginInstance.floatingButton) {
      pluginInstance.floatingButton.remove()
      pluginInstance.floatingButton = null
    }
    
    if (pluginInstance.pageObserver) {
      pluginInstance.pageObserver.disconnect()
      pluginInstance.pageObserver = null
    }
    
    pluginInstance.logger.info("浮动按钮已移除")
    
  } catch (error) {
    pluginInstance.logger.error("移除浮动按钮失败:", error)
  }
}

