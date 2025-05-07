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
 * 3. 触发文档漫游
 * 打开漫游标签页并启动漫游功能
 *
 * @param pluginInstance 插件实例
 */
const triggerRandomDoc = async (pluginInstance: RandomDocPlugin) => {
  // 3.1 检查标签页是否已存在
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
  } else {
    // 3.2 标签页已存在，根据模式继续漫游
    if (pluginInstance.tabContentInstance.doIncrementalRandomDoc && 
        (await pluginInstance.safeLoad(storeName)).reviewMode === ReviewMode.Incremental) {
      // 3.2.1 渐进模式漫游
      await pluginInstance.tabContentInstance.doIncrementalRandomDoc()
    } else {
      // 3.2.2 一遍过模式漫游
      await pluginInstance.tabContentInstance.doRandomDoc()
    }
    pluginInstance.logger.info("再次点击或者重复触发")
  }
}

/**
 * 4. 注册快捷键
 * 为插件功能注册快捷键
 *
 * @param pluginInstance 插件实例
 */
export async function registerCommand(pluginInstance: RandomDocPlugin) {
  // 4.1 注册漫游快捷键
  pluginInstance.addCommand({
    langKey: "startRandomDoc",
    hotkey: "⌥⌘M",
    callback: async () => {
      pluginInstance.logger.info("快捷键已触发 ⌥⌘M")
      await triggerRandomDoc(pluginInstance)
    },
  })
  pluginInstance.logger.info("文档漫步快捷键已注册为 ⌥⌘M")
  
  // 4.2 注册重置今日漫游记录快捷键
  pluginInstance.addCommand({
    langKey: "resetAllVisits",
    hotkey: "⌥⌘V",
    callback: async () => {
      pluginInstance.logger.info("快捷键已触发 ⌥⌘V")
      // 4.2.1 调用重置并刷新方法
      if (pluginInstance.tabContentInstance && pluginInstance.tabContentInstance.resetAndRefresh) {
        await pluginInstance.tabContentInstance.resetAndRefresh()
      } else {
        showMessage("请先打开漫游面板", 3000)
      }
    }
  })
  pluginInstance.logger.info("重置所有访问记录快捷键已注册为⌥⌘V")
}
