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
import PageUtil from "./utils/pageUtil"

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
  
  // 2.2.3 实例化设置组件
  new RandomDocSetting({
    target: document.getElementById(settingId) as HTMLElement,
    props: {
      pluginInstance: pluginInstance,
      dialog: d,
    },
  })
}

/**
 * 2.3 显示移动端漫游对话框
 * 在移动端以对话框形式显示漫游功能
 *
 * @param pluginInstance 插件实例
 */
export const showMobileRoamingDialog = (pluginInstance: RandomDocPlugin) => {
  // 2.3.1 设置对话框元素ID
  const roamingId = "siyuan-mobile-roaming"

  // 2.3.2 创建对话框
  const d = new Dialog({
    title: `${pluginInstance.i18n.randomDoc}`,
    content: `<div id="${roamingId}"></div>`,
    width: "95vw",
    height: "80vh",
  })

  // 2.3.3 实例化漫游组件
  new RandomDocContent({
    target: document.getElementById(roamingId) as HTMLElement,
    props: {
      pluginInstance: pluginInstance,
      dialog: d,  // 传递弹窗实例，支持组件内关闭弹窗和文档跳转
    },
  })
}

/**
 * 3. 触发文档漫游
 * 打开漫游标签页并启动漫游功能
 *
 * @param pluginInstance 插件实例
 */
const triggerRandomDoc = async (pluginInstance: RandomDocPlugin) => {
  // 3.1 移动端使用对话框，桌面端使用标签页
  if (pluginInstance.isMobile) {
    showMobileRoamingDialog(pluginInstance)
    return
  }

  // 3.2 检查标签页是否已存在
  if (!pluginInstance.tabInstance) {
    // 3.1.1 创建新标签页
    const tabInstance = openTab({
      app: pluginInstance.app,
      custom: {
        title: pluginInstance.i18n.randomDoc,
        icon: "iconRefresh",
        fn: pluginInstance.customTabObject,
      } as any,
    })

    // 3.1.2 处理Promise或直接对象返回
    if (tabInstance instanceof Promise) {
      pluginInstance.tabInstance = await tabInstance
    } else {
      pluginInstance.tabInstance = tabInstance
    }

    // 3.1.3 在标签页中加载漫游组件
    pluginInstance.tabContentInstance = new RandomDocContent({
      target: pluginInstance.tabInstance.panelElement as HTMLElement,
      props: {
        pluginInstance: pluginInstance,
      },
    })

    // 3.1.4 获取最近打开的文档并漫游
    await roamRecentDocument(pluginInstance)
  } else {
    // 3.2 标签页已存在，激活标签页并漫游最近打开的文档
        try {
      // 3.2.1 激活标签页
      pluginInstance.logger.info("开始激活标签页...")
      
      if (pluginInstance.tabInstance) {
        // 通过DOM操作激活标签页
        pluginInstance.logger.info("通过DOM操作激活标签页")
        
        // 查找标签页头部元素并点击
        const tabHead = document.querySelector(`[data-id="${pluginInstance.tabInstance.id}"]`)
        if (tabHead) {
          (tabHead as HTMLElement).click()
          pluginInstance.logger.info("通过DOM点击激活标签页成功")
        } else {
          // 尝试查找所有标签页头部，找到匹配的
          const allTabHeads = document.querySelectorAll('.item--focusable')
          for (const tabHead of allTabHeads) {
            const titleElement = tabHead.querySelector('.item__text')
            if (titleElement && titleElement.textContent === pluginInstance.i18n.randomDoc) {
              (tabHead as HTMLElement).click()
              pluginInstance.logger.info("通过标题匹配激活标签页成功")
              break
            }
          }
        }
      } else {
        pluginInstance.logger.warn("标签页实例不存在")
      }
    } catch (error) {
      pluginInstance.logger.error("激活标签页失败:", error)
    }
    
    // 3.2.2 等待一小段时间确保标签页完全激活后再漫游
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // 3.2.3 漫游最近打开的文档
    await roamRecentDocument(pluginInstance)
    pluginInstance.logger.info("再次点击，漫游最近打开的文档")
  }
}

/**
 * 3.3 漫游最近打开的文档
 * 获取当前打开的文档并在渐进阅读面板中显示
 *
 * @param pluginInstance 插件实例
 */
const roamRecentDocument = async (pluginInstance: RandomDocPlugin) => {
  try {
    // 3.3.1 获取最近打开的文档ID
    const recentDocId = await PageUtil.getRecentDocId(pluginInstance)
    
    if (!recentDocId) {
      showMessage("没有找到最近打开的文档", 4000, "info")
      pluginInstance.logger.warn("无法获取最近打开的文档")
      return
    }

    pluginInstance.logger.info(`获取到最近文档ID: ${recentDocId}`)

    // 3.3.2 验证文档是否存在
    const blockResult = await pluginInstance.kernelApi.getBlockByID(recentDocId)
    if (!blockResult) {
      showMessage("最近打开的文档不存在或已被删除", 4000, "info")
      pluginInstance.logger.warn("最近打开的文档不存在")
      return
    }

        // 3.3.3 设置当前文档为指标编辑目标，不改变筛选条件
        await pluginInstance.tabContentInstance.setCurrentDocForMetrics(recentDocId)
    
    // 3.3.4 显示成功消息
    showMessage(`已设置当前文档为指标编辑目标，点击"继续漫游"将使用之前的筛选条件进行漫游`, 4000, "info")
    
  } catch (error) {
    pluginInstance.logger.error("漫游最近文档失败:", error)
    showMessage("漫游最近文档失败: " + error.message, 4000, "error")
  }
}

/**
 * 3.4 继续漫游
 * 在当前渐进阅读面板中启动随机漫游
 *
 * @param pluginInstance 插件实例
 */
const continueRandomDoc = async (pluginInstance: RandomDocPlugin) => {
  try {
    if (!pluginInstance.tabInstance || !pluginInstance.tabContentInstance) {
      // 如果面板不存在，先创建面板
      await triggerRandomDoc(pluginInstance)
      return
    }
    
    // 确保标签页激活
    try {
      const tabHead = document.querySelector(`[data-id="${pluginInstance.tabInstance.id}"]`)
      if (tabHead) {
        (tabHead as HTMLElement).click()
      }
    } catch (error) {
      pluginInstance.logger.error("激活标签页失败:", error)
    }
    
    // 等待一小段时间确保标签页完全激活
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // 模拟点击"继续漫游"按钮
    try {
      // 找到"继续漫游"按钮并点击
      const buttons = pluginInstance.tabInstance.panelElement.querySelectorAll('button.primary-btn');
      let continueButtonFound = false;
      
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        // 查找按钮文本是"继续漫游"或包含"漫游中"的按钮
        if (btn.textContent.includes('继续漫游') || btn.textContent.includes('漫游中')) {
          (btn as HTMLElement).click();
          pluginInstance.logger.info("成功模拟点击继续漫游按钮");
          continueButtonFound = true;
          break;
        }
      }
      
      if (!continueButtonFound) {
        showMessage("未找到继续漫游按钮，请手动点击面板中的继续漫游按钮", 3000, "info");
      }
    } catch (error) {
      pluginInstance.logger.error("模拟点击继续漫游按钮失败:", error);
      showMessage("无法执行继续漫游，请手动点击面板中的继续漫游按钮", 3000, "info");
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
