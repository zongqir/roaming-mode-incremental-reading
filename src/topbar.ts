/**
 * ========================================
 * 漫游式渐进阅读插件 - 顶栏组件
 * ========================================
 * 
 * 本文件实现了插件在思源笔记顶栏的按钮及其功能，是用户与插件交互的主要入口。
 * 
 * ## 文件结构
 * 1. 顶栏按钮初始化 - 创建并配置顶栏按钮
 * 2. 上下文菜单与设置 - 处理右键菜单和设置界面
 * 3. 文档漫游触发 - 实现文档漫游功能的核心逻辑
 * 4. 快捷键注册 - 配置并注册插件快捷键
 */

import RandomDocPlugin from "./index"
import { icons } from "./utils/svg"
import { Dialog, Menu, openTab, showMessage } from "siyuan"
import RandomDocContent from "./libs/RandomDocContent.svelte"
import RandomDocSetting from "./libs/RandomDocSetting.svelte"
import { ReviewMode } from "./models/RandomDocConfig"
import { storeName } from "./Constants"

/**
 * 1. 初始化顶栏按钮
 * 创建顶栏图标并添加点击与右键菜单事件监听
 *
 * @param pluginInstance 插件实例
 */
export async function initTopbar(pluginInstance: RandomDocPlugin) {
  // 1.1 定义自定义标签页类型标识
  const TAB_TYPE = "random_doc_custom_tab"
  
  // 1.2 注册自定义标签页
  pluginInstance.customTabObject = pluginInstance.addTab({
    type: TAB_TYPE,
    async init() {},
    beforeDestroy() {
      // 1.2.1 清理标签页实例引用
      delete pluginInstance.tabInstance
      pluginInstance.logger.info("tabInstance destroyed")
    },
  })

  // 1.3 创建顶栏按钮
  const topBarElement = pluginInstance.addTopBar({
    icon: icons.iconTopbar,
    title: pluginInstance.i18n.randomDoc,
    position: "right",
    callback: () => {},
  })

  // 1.4 添加左键点击事件监听
  topBarElement.addEventListener("click", async () => {
    await triggerRandomDoc(pluginInstance)
  })

  // 1.5 添加右键菜单事件监听
  topBarElement.addEventListener("contextmenu", () => {
    let rect = topBarElement.getBoundingClientRect()
    // 1.5.1 如果获取不到宽度，则使用更多按钮的宽度
    if (rect.width === 0) {
      rect = document.querySelector("#barMore").getBoundingClientRect()
    }
    initContextMenu(pluginInstance, rect)
  })
}

/**
 * 2. 初始化上下文菜单
 * 创建右键菜单
 * 
 * @param pluginInstance 插件实例
 * @param rect 菜单位置矩形
 */
const initContextMenu = async (pluginInstance: RandomDocPlugin, rect: DOMRect) => {
  // 2.1 直接调用设置菜单，不显示额外的右键菜单
  showSettingMenu(pluginInstance)
}

/**
 * 2.2 显示设置菜单
 * 创建并显示插件设置对话框
 * 
 * @param pluginInstance 插件实例
 */
export const showSettingMenu = (pluginInstance: RandomDocPlugin) => {
  // 2.2.1 设置对话框元素ID
  const settingId = "siyuan-random-doc-setting"
  
  // 2.2.2 创建对话框
  const d = new Dialog({
    title: `${pluginInstance.i18n.setting} - ${pluginInstance.i18n.randomDoc}`,
    content: `<div id="${settingId}"></div>`,
    width: pluginInstance.isMobile ? "92vw" : "720px",
  })
  
  // 2.2.3 确保设置对话框在最大化窗口之上显示
  // 获取对话框元素并设置更高的z-index
  setTimeout(() => {
    const dialogElement = d.element
    if (dialogElement) {
      // 设置比最大化窗口容器更高的z-index（最大化窗口是9998）
      dialogElement.style.zIndex = '10000'
      
      // 同时设置dialog的backdrop（如果存在）
      const backdrop = dialogElement.previousElementSibling
      if (backdrop && backdrop.classList.contains('b3-dialog__backdrop')) {
        (backdrop as HTMLElement).style.zIndex = '9999'
      }
      
      pluginInstance.logger.info("设置对话框z-index已调整为最高层级")
    }
  }, 50)
  
  // 2.2.4 实例化设置组件
  new RandomDocSetting({
    target: document.getElementById(settingId) as HTMLElement,
    props: {
      pluginInstance: pluginInstance,
      dialog: d,
    },
  })
}

/**
 * 3.0 打开最大化窗口模式
 * 在移动端创建最大化漫游界面（非全屏）
 *
 * @param pluginInstance 插件实例
 */
const openFullscreenMode = async (pluginInstance: RandomDocPlugin) => {
  try {
    // 3.0.0 在创建新实例前，先清理所有已存在的实例
    pluginInstance.cleanupExistingInstances()
    
    // 3.0.1 创建最大化容器
    const fullscreenId = "fullscreen-random-doc"
    const fullscreenContainer = document.createElement('div')
    fullscreenContainer.id = fullscreenId
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
    
    // 3.0.2 创建全屏头部
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
    
    // 3.0.3 创建标题
    const title = document.createElement('h2')
    title.textContent = pluginInstance.i18n.randomDoc
    title.style.cssText = `
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--b3-theme-on-background);
    `
    
    // 3.0.4 创建返回按钮
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
    
    // 3.0.5 添加返回按钮事件
    backButton.addEventListener('click', () => {
      closeFullscreenMode(pluginInstance)
    })
    
    // 3.0.6 添加悬停效果
    backButton.addEventListener('mouseenter', () => {
      backButton.style.backgroundColor = 'var(--b3-theme-hover)'
    })
    backButton.addEventListener('mouseleave', () => {
      backButton.style.backgroundColor = 'transparent'
    })
    
    // 3.0.7 组装头部
    header.appendChild(backButton)
    header.appendChild(title)
    header.appendChild(document.createElement('div')) // 占位符，保持标题居中
    
    // 3.0.8 创建内容区域
    const contentArea = document.createElement('div')
    contentArea.id = "fullscreen-content"
    contentArea.style.cssText = `
      flex: 1;
      overflow: auto;
      padding: 0;
    `
    
    // 3.0.9 创建消息提示容器
    const messageContainer = document.createElement('div')
    messageContainer.id = "fullscreen-message-container"
    messageContainer.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
      pointer-events: none;
    `
    
    // 3.0.10 组装全屏容器
    fullscreenContainer.appendChild(header)
    fullscreenContainer.appendChild(contentArea)
    
    // 3.0.11 添加到页面
    document.body.appendChild(fullscreenContainer)
    document.body.appendChild(messageContainer)
    
    // 3.0.12 创建自定义消息显示函数
    const showFullscreenMessage = (message: string, duration: number = 3000, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
      // 创建消息元素
      const messageElement = document.createElement('div')
      messageElement.style.cssText = `
        background: ${type === 'error' ? '#ff4757' : type === 'success' ? '#2ed573' : type === 'warning' ? '#ffa502' : '#3742fa'};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        margin-bottom: 10px;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        opacity: 0;
        transform: translateY(-20px);
        transition: all 0.3s ease;
        pointer-events: auto;
        max-width: 80vw;
        word-wrap: break-word;
        text-align: center;
      `
      messageElement.textContent = message
      
      // 添加到消息容器
      messageContainer.appendChild(messageElement)
      
      // 显示动画
      setTimeout(() => {
        messageElement.style.opacity = '1'
        messageElement.style.transform = 'translateY(0)'
      }, 10)
      
      // 自动移除
      setTimeout(() => {
        messageElement.style.opacity = '0'
        messageElement.style.transform = 'translateY(-20px)'
        setTimeout(() => {
          if (messageElement.parentNode) {
            messageElement.parentNode.removeChild(messageElement)
          }
        }, 300)
      }, duration)
    }
    
    // 3.0.13 保存自定义消息函数到插件实例
    pluginInstance.showFullscreenMessage = showFullscreenMessage
    
    // 3.0.11 创建漫游内容组件
    pluginInstance.tabContentInstance = new RandomDocContent({
      target: contentArea,
      props: {
        pluginInstance: pluginInstance,
      },
    })
    
    // 3.0.12 保存最大化容器引用
    pluginInstance.fullscreenContainer = fullscreenContainer
    
    // 3.0.13 不请求全屏，直接以最大化窗口模式显示
    // 移除全屏API调用，只保留最大化窗口显示
    
    pluginInstance.logger.info("Maximized window roaming mode opened successfully")
    
  } catch (error) {
    pluginInstance.logger.error("Failed to open maximized window mode:", error)
    showMessage("打开最大化窗口模式失败: " + error.message, 3000, "error")
  }
}

/**
 * 3.0.1 关闭最大化窗口模式
 * 清理最大化界面和相关事件监听
 *
 * @param pluginInstance 插件实例
 */
const closeFullscreenMode = (pluginInstance: RandomDocPlugin) => {
  try {
    // 3.0.1.1 不需要退出全屏，直接清理容器即可
    
    // 3.0.1.2 清理消息容器
    const messageContainer = document.getElementById("fullscreen-message-container")
    if (messageContainer) {
      messageContainer.remove()
    }
    
    // 3.0.1.3 清理自定义消息函数
    if (pluginInstance.showFullscreenMessage) {
      delete pluginInstance.showFullscreenMessage
    }
    
    // 3.0.1.4 清理全屏容器
    if (pluginInstance.fullscreenContainer) {
      pluginInstance.fullscreenContainer.remove()
      pluginInstance.fullscreenContainer = null
    }
    
    // 3.0.1.5 清理组件实例
    if (pluginInstance.tabContentInstance) {
      pluginInstance.tabContentInstance.$destroy()
      pluginInstance.tabContentInstance = null
    }
    
    pluginInstance.logger.info("Maximized window mode closed successfully")
    
  } catch (error) {
    pluginInstance.logger.error("Failed to close maximized window mode:", error)
  }
}

/**
 * 3. 触发文档漫游
 * 打开漫游标签页并启动漫游功能
 *
 * @param pluginInstance 插件实例
 */
const triggerRandomDoc = async (pluginInstance: RandomDocPlugin) => {
  try {
    // 3.0 在创建新实例前，先清理所有已存在的实例
    pluginInstance.cleanupExistingInstances()
    
    // 3.1 移动端使用最大化窗口模式，桌面端使用标签页模式
    if (pluginInstance.isMobile) {
      // 移动端：使用最大化窗口模式替代对话框
      await openFullscreenMode(pluginInstance)
      
    } else {
      // 桌面端：使用标签页模式
      const tabInstance = openTab({
        app: pluginInstance.app,
        custom: {
          title: pluginInstance.i18n.randomDoc,
          icon: "iconRefresh",
          fn: pluginInstance.customTabObject,
        } as any,
      })

      // 3.2 处理Promise或直接对象返回
      if (tabInstance instanceof Promise) {
        pluginInstance.tabInstance = await tabInstance
      } else {
        pluginInstance.tabInstance = tabInstance
      }

      // 3.2.1 等待标签页完全初始化
      await new Promise(resolve => setTimeout(resolve, 200))

      // 3.3 在标签页中加载漫游组件
      // 添加空值检查以防止错误
      if (!pluginInstance.tabInstance || !pluginInstance.tabInstance.panelElement) {
        pluginInstance.logger.error("Tab instance or panelElement is not available", {
          hasTabInstance: !!pluginInstance.tabInstance,
          hasPanelElement: !!(pluginInstance.tabInstance && pluginInstance.tabInstance.panelElement),
          isMobile: pluginInstance.isMobile
        })
        showMessage("标签页初始化失败，请重试", 3000, "error")
        return
      }
      
      pluginInstance.tabContentInstance = new RandomDocContent({
        target: pluginInstance.tabInstance.panelElement as HTMLElement,
        props: {
          pluginInstance: pluginInstance,
        },
      })
    }
    
    pluginInstance.logger.info(`Roaming ${pluginInstance.isMobile ? 'dialog' : 'tab'} created successfully`)
    
  } catch (error) {
    pluginInstance.logger.error("Failed to create roaming interface:", error)
    showMessage("创建漫游界面失败: " + error.message, 3000, "error")
  }
}


/**
 * 3.3 继续漫游
 * 在当前渐进阅读面板中启动随机漫游
 *
 * @param pluginInstance 插件实例
 */
const continueRandomDoc = async (pluginInstance: RandomDocPlugin) => {
  try {
    // 检查是否存在漫游实例
    if (!pluginInstance.tabContentInstance) {
      // 如果面板不存在，先创建面板
      await triggerRandomDoc(pluginInstance)
      return
    }
    
    if (pluginInstance.isMobile) {
      // 移动端：检查最大化窗口容器是否存在
      if (!pluginInstance.fullscreenContainer) {
        await triggerRandomDoc(pluginInstance)
        return
      }
      
      // 移动端直接调用漫游实例的方法，无需激活标签页
      try {
        // 模拟点击"继续漫游"按钮 - 在最大化窗口容器内查找
        const fullscreenContent = document.getElementById("fullscreen-content")
        if (fullscreenContent) {
          const buttons = fullscreenContent.querySelectorAll('button.primary-btn');
          let continueButtonFound = false;
          
          for (let i = 0; i < buttons.length; i++) {
            const btn = buttons[i];
            if (btn.textContent && (btn.textContent.includes('继续漫游') || btn.textContent.includes('漫游中'))) {
              (btn as HTMLElement).click();
              pluginInstance.logger.info("移动端：成功模拟点击继续漫游按钮");
              continueButtonFound = true;
              break;
            }
          }
          
          if (!continueButtonFound) {
            showMessage("未找到继续漫游按钮，请手动点击最大化界面中的继续漫游按钮", 3000, "info");
          }
        } else {
          showMessage("移动端最大化界面未找到，请重新打开漫游功能", 3000, "error");
        }
      } catch (error) {
        pluginInstance.logger.error("移动端模拟点击继续漫游按钮失败:", error);
        showMessage("无法执行继续漫游，请手动点击最大化界面中的继续漫游按钮", 3000, "info");
      }
      
    } else {
      // 桌面端：标签页模式
      if (!pluginInstance.tabInstance) {
        await triggerRandomDoc(pluginInstance)
        return
      }
      
      // 确保标签页激活
      try {
        if (pluginInstance.tabInstance && pluginInstance.tabInstance.id) {
          const tabHead = document.querySelector(`[data-id="${pluginInstance.tabInstance.id}"]`)
          if (tabHead) {
            (tabHead as HTMLElement).click()
          }
        }
      } catch (error) {
        pluginInstance.logger.error("激活标签页失败:", error)
      }
      
      // 等待一小段时间确保标签页完全激活
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // 模拟点击"继续漫游"按钮
      try {
        // 检查 tabInstance 和 panelElement 是否存在
        if (!pluginInstance.tabInstance || !pluginInstance.tabInstance.panelElement) {
          pluginInstance.logger.error("Tab instance or panelElement is not available for button click")
          showMessage("面板未正确初始化，无法执行继续漫游", 3000, "error")
          return
        }
        
        // 找到"继续漫游"按钮并点击
        const buttons = pluginInstance.tabInstance.panelElement.querySelectorAll('button.primary-btn');
        let continueButtonFound = false;
        
        for (let i = 0; i < buttons.length; i++) {
          const btn = buttons[i];
          // 查找按钮文本是"继续漫游"或包含"漫游中"的按钮
          if (btn.textContent && (btn.textContent.includes('继续漫游') || btn.textContent.includes('漫游中'))) {
            (btn as HTMLElement).click();
            pluginInstance.logger.info("桌面端：成功模拟点击继续漫游按钮");
            continueButtonFound = true;
            break;
          }
        }
        
        if (!continueButtonFound) {
          showMessage("未找到继续漫游按钮，请手动点击面板中的继续漫游按钮", 3000, "info");
        }
      } catch (error) {
        pluginInstance.logger.error("桌面端模拟点击继续漫游按钮失败:", error);
        showMessage("无法执行继续漫游，请手动点击面板中的继续漫游按钮", 3000, "info");
      }
    }
  } catch (error) {
    pluginInstance.logger.error("继续漫游失败:", error);
    showMessage("继续漫游失败: " + error.message, 3000, "error");
  }
}

/**
 * 4. 注册快捷键
 * 为插件功能注册快捷键
 *
 * @param pluginInstance 插件实例
 */
export async function registerCommand(pluginInstance: RandomDocPlugin) {
  // 4.1 注册开始漫游快捷键
  pluginInstance.addCommand({
    langKey: "startRandomDoc",
    hotkey: "⌥⌘M",
    callback: async () => {
      pluginInstance.logger.info("快捷键已触发 ⌥⌘M")
      await triggerRandomDoc(pluginInstance)
    },
  })
  pluginInstance.logger.info("开始漫游快捷键已注册为 ⌥⌘M")
  
  // 4.2 注册继续漫游快捷键
  pluginInstance.addCommand({
    langKey: "continueRandomDoc",
    hotkey: "⌥⌘C",
    callback: async () => {
      pluginInstance.logger.info("快捷键已触发 ⌥⌘C")
      await continueRandomDoc(pluginInstance)
    },
  })
  pluginInstance.logger.info("继续漫游快捷键已注册为 ⌥⌘C")
  
  // 4.3 注册重置已访问记录快捷键
  pluginInstance.addCommand({
    langKey: "resetAllVisits",
    hotkey: "⌥⌘V",
    callback: async () => {
      pluginInstance.logger.info("快捷键已触发 ⌥⌘V")
      // 4.3.1 调用重置并刷新方法
      if (pluginInstance.tabContentInstance && pluginInstance.tabContentInstance.resetAndRefresh) {
        await pluginInstance.tabContentInstance.resetAndRefresh()
      } else {
        showMessage("请先打开漫游面板", 3000)
      }
    }
  })
  pluginInstance.logger.info("重置已访问记录快捷键已注册为 ⌥⌘V")
}
