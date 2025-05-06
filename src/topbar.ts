import RandomDocPlugin from "./index"
import { icons } from "./utils/svg"
import { Dialog, Menu, openTab, showMessage } from "siyuan"
import RandomDocContent from "./libs/RandomDocContent.svelte"
import RandomDocSetting from "./libs/RandomDocSetting.svelte"
import IncrementalConfigPanel from "./libs/IncrementalConfigPanel.svelte"
import { ReviewMode } from "./models/RandomDocConfig"
import { storeName } from "./Constants"

/**
 * 顶栏按钮
 *
 * @param pluginInstance - 插件实例
 * @author terwer
 * @version 0.0.1
 * @since 0.0.1
 */
export async function initTopbar(pluginInstance: RandomDocPlugin) {
  const TAB_TYPE = "random_doc_custom_tab"
  pluginInstance.customTabObject = pluginInstance.addTab({
    type: TAB_TYPE,
    async init() {},
    beforeDestroy() {
      delete pluginInstance.tabInstance
      pluginInstance.logger.info("tabInstance destroyed")
    },
  })

  const topBarElement = pluginInstance.addTopBar({
    icon: icons.iconTopbar,
    title: pluginInstance.i18n.randomDoc,
    position: "right",
    callback: () => {},
  })

  topBarElement.addEventListener("click", async () => {
    await triggerRandomDoc(pluginInstance)
  })

  // 添加右键菜单
  topBarElement.addEventListener("contextmenu", () => {
    let rect = topBarElement.getBoundingClientRect()
    // 如果获取不到宽度，则使用更多按钮的宽度
    if (rect.width === 0) {
      rect = document.querySelector("#barMore").getBoundingClientRect()
    }
    initContextMenu(pluginInstance, rect)
  })
}

const initContextMenu = async (pluginInstance: RandomDocPlugin, rect: DOMRect) => {
  const menu = new Menu("slugContextMenu")

  menu.addItem({
    iconHTML: icons.iconSetting,
    label: pluginInstance.i18n.setting,
    click: () => {
      showSettingMenu(pluginInstance)
    },
  })
  
  // 加载当前配置
  const storeConfig = await pluginInstance.safeLoad(storeName)
  
  // 添加渐进模式配置菜单项，无论当前模式如何都显示
  menu.addItem({
    iconHTML: '<svg class="b3-menu__icon" style="color: var(--b3-theme-primary)"><use xlink:href="#iconSettings"></use></svg>',
    label: "渐进式模式配置",
    click: () => {
      showIncrementalConfigMenu(pluginInstance)
    },
  })

  // 添加重置今日访问记录菜单项
  if (storeConfig.reviewMode === ReviewMode.Progressive) {
    menu.addItem({
      iconHTML: '<svg class="b3-menu__icon" style="color: var(--b3-theme-primary)"><use xlink:href="#iconRefresh"></use></svg>',
      label: "重置所有访问记录",
      click: async () => {
        try {
          // 获取RandomDocContent实例，调用它的resetAndRefresh方法
          if (pluginInstance.tabContentInstance && pluginInstance.tabContentInstance.resetAndRefresh) {
            await pluginInstance.tabContentInstance.resetAndRefresh()
          } else {
            showMessage("请先打开漫游面板", 3000)
          }
        } catch (error) {
          pluginInstance.logger.error("重置访问记录失败", error)
          showMessage("重置失败: " + error.message, 5000, "error")
        }
      },
    })
  }

  if (pluginInstance.isMobile) {
    menu.fullscreen()
  } else {
    menu.open({
      x: rect.right,
      y: rect.bottom,
      isLeft: true,
    })
  }
}

export const showSettingMenu = (pluginInstance: RandomDocPlugin) => {
  const settingId = "siyuan-random-doc-setting"
  const d = new Dialog({
    title: `${pluginInstance.i18n.setting} - ${pluginInstance.i18n.randomDoc}`,
    content: `<div id="${settingId}"></div>`,
    width: pluginInstance.isMobile ? "92vw" : "720px",
  })
  new RandomDocSetting({
    target: document.getElementById(settingId) as HTMLElement,
    props: {
      pluginInstance: pluginInstance,
      dialog: d,
    },
  })
}

/**
 * 显示渐进模式配置界面
 * @param pluginInstance 插件实例
 */
export const showIncrementalConfigMenu = async (pluginInstance: RandomDocPlugin) => {
  try {
    // 加载配置
    const storeConfig = await pluginInstance.safeLoad(storeName)
    
    const configId = "siyuan-incremental-config"
    const d = new Dialog({
      title: "渐进式模式配置",
      content: `<div id="${configId}"></div>`,
      width: pluginInstance.isMobile ? "92vw" : "720px",
    })
    
    new IncrementalConfigPanel({
      target: document.getElementById(configId) as HTMLElement,
      props: {
        pluginInstance: pluginInstance,
        storeConfig: storeConfig,
        dialog: d,
      },
    })
  } catch (error) {
    pluginInstance.logger.error("打开渐进模式配置失败", error)
    showMessage("打开配置失败: " + error.message, 5000, "error")
  }
}

/**
 * 触发打开tab以及开始漫游
 *
 * @param pluginInstance
 */
const triggerRandomDoc = async (pluginInstance: RandomDocPlugin) => {
  // 自定义tab
  if (!pluginInstance.tabInstance) {
    const tabInstance = openTab({
      app: pluginInstance.app,
      custom: {
        title: pluginInstance.i18n.randomDoc,
        icon: "iconRefresh",
        fn: pluginInstance.customTabObject,
      } as any,
    })

    // 修复后续API改动
    if (tabInstance instanceof Promise) {
      pluginInstance.tabInstance = await tabInstance
    } else {
      pluginInstance.tabInstance = tabInstance
    }

    // 加载内容
    pluginInstance.tabContentInstance = new RandomDocContent({
      target: pluginInstance.tabInstance.panelElement as HTMLElement,
      props: {
        pluginInstance: pluginInstance,
      },
    })
  } else {
    if (pluginInstance.tabContentInstance.doProgressiveRandomDoc && 
        (await pluginInstance.safeLoad(storeName)).reviewMode === ReviewMode.Progressive) {
      await pluginInstance.tabContentInstance.doProgressiveRandomDoc()
    } else {
      await pluginInstance.tabContentInstance.doRandomDoc()
    }
    console.log("再次点击或者重复触发")
  }
}

/**
 * 注册快捷键
 *
 * @param pluginInstance
 */
export async function registerCommand(pluginInstance: RandomDocPlugin) {
  //添加快捷键
  pluginInstance.addCommand({
    langKey: "startRandomDoc",
    hotkey: "⌥⌘M",
    callback: async () => {
      pluginInstance.logger.info("快捷键已触发 ⌥⌘M")
      await triggerRandomDoc(pluginInstance)
    },
  })
  pluginInstance.logger.info("文档漫步快捷键已注册为 ⌥⌘M")
  
  //添加快捷键-重置今日漫游记录
  pluginInstance.addCommand({
    langKey: "resetAllVisits",
    hotkey: "⌥⌘V",
    callback: async () => {
      pluginInstance.logger.info("快捷键已触发 ⌥⌘V")
      // 获取RandomDocContent实例，调用它的resetAndRefresh方法
      if (pluginInstance.tabContentInstance && pluginInstance.tabContentInstance.resetAndRefresh) {
        await pluginInstance.tabContentInstance.resetAndRefresh()
      } else {
        showMessage("请先打开漫游面板", 3000)
      }
    }
  })
  pluginInstance.logger.info("重置所有访问记录快捷键已注册为⌥⌘V")
}
